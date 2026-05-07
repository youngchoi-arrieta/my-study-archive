'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────
type PathDef = { id: string; label: string; color: string; x: number }
type NodeDef = { id: string; pathId: string; label: string; sub: string; desc: string; y: number; preset: string }
type EdgeDef = { id: string; from: string; to: string; cross: boolean; label: string }
type TreeConfig = { paths: PathDef[]; nodes: NodeDef[]; edges: EdgeDef[] }
type Activations = Record<string, boolean>

const genId = () => Math.random().toString(36).slice(2, 10)
const PAD   = 80
const CANVAS_W = 1080
const CANVAS_H = 880

// ── Default configs ────────────────────────────────────────────────────────
const DEFAULT_CAREER: TreeConfig = {
  paths: [
    { id: 'korea',     label: '⚔ 한국의 길',   color: '#f87171', x: 115 },
    { id: 'japan',     label: '⛩ 일본의 길',   color: '#fbbf24', x: 355 },
    { id: 'canada',    label: '🍁 캐나다의 길', color: '#60a5fa', x: 625 },
    { id: 'australia', label: '🦘 호주의 길',   color: '#34d399', x: 910 },
  ],
  nodes: [
    {id:'k1',pathId:'korea',    label:'전기기능사',       sub:'76점 취득',     y:720,preset:'done',    desc:'2025년 1회 취득. 76점 합격.'},
    {id:'k2',pathId:'korea',    label:'전기기사 필기',    sub:'96점',          y:600,preset:'done',    desc:'2025년 1회. 96점 합격.'},
    {id:'k3',pathId:'korea',    label:'전기기사 실기',    sub:'가채점 80점',   y:480,preset:'progress',desc:'4/18 응시. 결과 6/12.'},
    {id:'k4',pathId:'korea',    label:'전기기사 취득',    sub:'결과 6/12',     y:360,preset:'pending', desc:'합격 시 취득. 高度専門職 포인트 기여.'},
    {id:'k5',pathId:'korea',    label:'전기공사사 2종',   sub:'학과 5/28',     y:240,preset:'progress',desc:'학과시험 5/28 하카타 CBT.'},
    {id:'k6',pathId:'korea',    label:'보호계전\n엔지니어',sub:'Data Center',  y:90, preset:'',        desc:'보호계전 설계. 외국계 데이터센터 FM 직군.'},
    {id:'j1',pathId:'japan',    label:'JLPT N4 등록',    sub:'7월 2026',      y:720,preset:'done',    desc:'2026년 7월 등록 완료.'},
    {id:'j2',pathId:'japan',    label:'第2種工事士\n学科試験',sub:'5/28 하카타',y:610,preset:'progress',desc:'CBT 학과시험. 5/28 후쿠오카.'},
    {id:'j3',pathId:'japan',    label:'第2種工事士\n取得', sub:'',             y:490,preset:'',        desc:'기술시험 합격 후 취득.'},
    {id:'j4',pathId:'japan',    label:'JLPT N4',          sub:'',             y:375,preset:'',        desc:'N4 합격. 기인국 비자 기반.'},
    {id:'j5',pathId:'japan',    label:'電験3종',           sub:'',             y:260,preset:'',        desc:'第三種電気主任技術者. 고도기술 포인트 기여.'},
    {id:'j6',pathId:'japan',    label:'JLPT N2',           sub:'',             y:170,preset:'',        desc:'N2 합격. 高度専門職 필수 조건.'},
    {id:'j7',pathId:'japan',    label:'高度専門職 1호',    sub:'~80pt',        y:80, preset:'',        desc:'KAIST+전기기사+N2 ≈ 80pt. 1년 내 PR 가능.'},
    {id:'j8',pathId:'japan',    label:'電験2종',            sub:'',             y:5,  preset:'',        desc:'第二種電気主任技術者. 大型 설비 주임.'},
    {id:'c1',pathId:'canada',   label:'워홀 초청장',       sub:'W313314277',   y:720,preset:'done',    desc:'캐나다 WH 초청장 수령.'},
    {id:'c2',pathId:'canada',   label:'지문 등록',          sub:'4/17 완료',    y:600,preset:'done',    desc:'생체정보 등록 완료.'},
    {id:'c3',pathId:'canada',   label:'캐나다 입국',        sub:'',             y:480,preset:'',        desc:'비자 발급 후 입국.'},
    {id:'c4',pathId:'canada',   label:'전기직 취업',        sub:'Equinix/CBRE', y:360,preset:'',        desc:'외국계 데이터센터 FM/전기 직군.'},
    {id:'c5',pathId:'canada',   label:'Red Seal',           sub:'준비',         y:230,preset:'',        desc:'캐나다 전국 통용 전기자격.'},
    {id:'c6',pathId:'canada',   label:'PR 신청',            sub:'Express Entry',y:100,preset:'',        desc:'영주권 신청.'},
    {id:'a1',pathId:'australia',label:'워홀 지원',          sub:'',             y:720,preset:'',        desc:'호주 WH 비자 신청.'},
    {id:'a2',pathId:'australia',label:'호주 입국',          sub:'',             y:600,preset:'',        desc:'비자 발급 후 입국.'},
    {id:'a3',pathId:'australia',label:'RPL 인증',           sub:'',             y:480,preset:'',        desc:'기취득 자격 인증.'},
    {id:'a4',pathId:'australia',label:'호주 전기 면허',     sub:'',             y:360,preset:'',        desc:'주별 전기 면허 취득.'},
    {id:'a5',pathId:'australia',label:'PR 신청',            sub:'Skills 186',   y:220,preset:'',        desc:'영주권 신청.'},
  ],
  edges: [
    {id:'e1', from:'k1',to:'k2',cross:false,label:''},
    {id:'e2', from:'k2',to:'k3',cross:false,label:''},
    {id:'e3', from:'k3',to:'k4',cross:false,label:''},
    {id:'e4', from:'k4',to:'k5',cross:false,label:''},
    {id:'e5', from:'k5',to:'k6',cross:false,label:''},
    {id:'e6', from:'j1',to:'j2',cross:false,label:''},
    {id:'e7', from:'j2',to:'j3',cross:false,label:''},
    {id:'e8', from:'j3',to:'j4',cross:false,label:''},
    {id:'e9', from:'j4',to:'j5',cross:false,label:''},
    {id:'e10',from:'j5',to:'j6',cross:false,label:''},
    {id:'e11',from:'j6',to:'j7',cross:false,label:''},
    {id:'e12',from:'j7',to:'j8',cross:false,label:''},
    {id:'e13',from:'c1',to:'c2',cross:false,label:''},
    {id:'e14',from:'c2',to:'c3',cross:false,label:''},
    {id:'e15',from:'c3',to:'c4',cross:false,label:''},
    {id:'e16',from:'c4',to:'c5',cross:false,label:''},
    {id:'e17',from:'c5',to:'c6',cross:false,label:''},
    {id:'e18',from:'a1',to:'a2',cross:false,label:''},
    {id:'e19',from:'a2',to:'a3',cross:false,label:''},
    {id:'e20',from:'a3',to:'a4',cross:false,label:''},
    {id:'e21',from:'a4',to:'a5',cross:false,label:''},
    {id:'x1', from:'k5',to:'j2',cross:true, label:'동일 시험'},
    {id:'x2', from:'k4',to:'j7',cross:true, label:'+pt 기여'},
    {id:'x3', from:'c1',to:'a1',cross:true, label:'대안 루트'},
    {id:'x4', from:'k6',to:'c4',cross:true, label:'역량 연계'},
  ],
}

const DEFAULT_TECHNICAL: TreeConfig = {
  paths: [
    { id: 'pe',   label: '⚡ 전력전자',    color: '#f472b6', x: 110 },
    { id: 'mc',   label: '🔄 모터제어',    color: '#fb923c', x: 330 },
    { id: 'ps',   label: '🔌 전력계통',    color: '#4ade80', x: 570 },
    { id: 're',   label: '☀ 신재생에너지', color: '#facc15', x: 790 },
    { id: 'ic',   label: '🖥 계측제어',    color: '#38bdf8', x: 1000 },
  ],
  nodes: [
    {id:'pe1',pathId:'pe',label:'기초 회로이론', sub:'KAIST 물리',y:720,preset:'done',   desc:'회로이론, 전자기학 기초. KAIST 물리학과 과정.'},
    {id:'pe2',pathId:'pe',label:'전력변환 기초', sub:'',         y:580,preset:'',       desc:'AC-DC, DC-AC 변환 기초 개념.'},
    {id:'pe3',pathId:'pe',label:'DC-DC 컨버터',  sub:'',         y:440,preset:'',       desc:'Buck, Boost, Flyback 컨버터 설계.'},
    {id:'pe4',pathId:'pe',label:'인버터 설계',   sub:'',         y:300,preset:'',       desc:'3상 인버터. PWM 방식. 데드타임 설계.'},
    {id:'pe5',pathId:'pe',label:'SiC/GaN 소자',  sub:'',         y:160,preset:'',       desc:'와이드밴드갭 반도체 적용 고효율 전력변환.'},
    {id:'mc1',pathId:'mc',label:'전기기기 기초',  sub:'전기기사', y:720,preset:'done',   desc:'변압기, 유도전동기, 동기기 이론.'},
    {id:'mc2',pathId:'mc',label:'BLDC 드라이브', sub:'',         y:580,preset:'',       desc:'홀센서/센서리스 BLDC 제어.'},
    {id:'mc3',pathId:'mc',label:'벡터 제어 FOC', sub:'',         y:440,preset:'',       desc:'Field Oriented Control. dq 변환.'},
    {id:'mc4',pathId:'mc',label:'PMSM 제어',     sub:'',         y:300,preset:'',       desc:'영구자석 동기전동기 고성능 제어.'},
    {id:'mc5',pathId:'mc',label:'전류제어기\n설계',sub:'',        y:160,preset:'',       desc:'PI 전류제어기 대역폭 설계. 디지털 구현.'},
    {id:'ps1',pathId:'ps',label:'계통 기초',      sub:'전기기사', y:720,preset:'done',   desc:'전력조류, 단락계산 기초. 전기기사 수준.'},
    {id:'ps2',pathId:'ps',label:'단락전류 해석',  sub:'',         y:580,preset:'',       desc:'대칭좌표법. 단락전류 계산 및 차단기 선정.'},
    {id:'ps3',pathId:'ps',label:'보호계전',       sub:'관심 분야',y:440,preset:'progress',desc:'OCR/DOCR/87T 설계. CT 결선 및 정정. 관심분야.'},
    {id:'ps4',pathId:'ps',label:'파워플로우',     sub:'',         y:300,preset:'',       desc:'Newton-Raphson, Gauss-Seidel 해법.'},
    {id:'ps5',pathId:'ps',label:'PSCAD\n시뮬레이션',sub:'',       y:160,preset:'',       desc:'PSCAD/EMTDC 이용 전력계통 시뮬레이션.'},
    {id:'re1',pathId:'re',label:'태양광 PV 기초', sub:'',         y:720,preset:'',       desc:'PV 셀 특성. 전기기사 태양광 설비 설계.'},
    {id:'re2',pathId:'re',label:'MPPT 제어',      sub:'',         y:560,preset:'',       desc:'P&O, INC 알고리즘. 최대전력 추종.'},
    {id:'re3',pathId:'re',label:'계통연계\n인버터',sub:'',         y:380,preset:'',       desc:'PLL, 무효전력 보상, 계통 동기화.'},
    {id:'re4',pathId:'re',label:'풍력 발전',       sub:'',         y:220,preset:'',       desc:'DFIG/PMSG 기반 풍력 시스템.'},
    {id:'ic1',pathId:'ic',label:'PLC 기초',        sub:'XG5000',  y:720,preset:'done',   desc:'PLC 사다리 논리. XG5000 프로그래밍. 오송 실습.'},
    {id:'ic2',pathId:'ic',label:'시퀀스 제어',     sub:'',         y:570,preset:'progress',desc:'MC, 인터록, 타이머 시퀀스 설계.'},
    {id:'ic3',pathId:'ic',label:'SCADA/HMI',      sub:'',         y:410,preset:'',       desc:'산업용 감시제어 시스템 설계.'},
    {id:'ic4',pathId:'ic',label:'PID 제어',        sub:'',         y:250,preset:'',       desc:'산업용 PID 튜닝. Ziegler-Nichols 등.'},
    {id:'ic5',pathId:'ic',label:'분산제어\nDCS',   sub:'',         y:100,preset:'',       desc:'분산형 제어 시스템. 대형 플랜트 적용.'},
  ],
  edges: [
    {id:'e1', from:'pe1',to:'pe2',cross:false,label:''},
    {id:'e2', from:'pe2',to:'pe3',cross:false,label:''},
    {id:'e3', from:'pe3',to:'pe4',cross:false,label:''},
    {id:'e4', from:'pe4',to:'pe5',cross:false,label:''},
    {id:'e5', from:'mc1',to:'mc2',cross:false,label:''},
    {id:'e6', from:'mc2',to:'mc3',cross:false,label:''},
    {id:'e7', from:'mc3',to:'mc4',cross:false,label:''},
    {id:'e8', from:'mc4',to:'mc5',cross:false,label:''},
    {id:'e9', from:'ps1',to:'ps2',cross:false,label:''},
    {id:'e10',from:'ps2',to:'ps3',cross:false,label:''},
    {id:'e11',from:'ps3',to:'ps4',cross:false,label:''},
    {id:'e12',from:'ps4',to:'ps5',cross:false,label:''},
    {id:'e13',from:'re1',to:'re2',cross:false,label:''},
    {id:'e14',from:'re2',to:'re3',cross:false,label:''},
    {id:'e15',from:'re3',to:'re4',cross:false,label:''},
    {id:'e16',from:'ic1',to:'ic2',cross:false,label:''},
    {id:'e17',from:'ic2',to:'ic3',cross:false,label:''},
    {id:'e18',from:'ic3',to:'ic4',cross:false,label:''},
    {id:'e19',from:'ic4',to:'ic5',cross:false,label:''},
    {id:'x1', from:'pe4',to:'mc3',cross:true, label:'인버터↔FOC'},
    {id:'x2', from:'ps3',to:'pe4',cross:true, label:'보호↔인버터'},
    {id:'x3', from:'re3',to:'pe4',cross:true, label:'공통 기술'},
    {id:'x4', from:'ic2',to:'mc2',cross:true, label:'시퀀스↔드라이브'},
  ],
}

// ── Visual state helper ────────────────────────────────────────────────────
function visual(node: NodeDef, activations: Activations, pathColor: string) {
  const on = !!activations[node.id]
  if (on && node.preset === 'done')     return {bg:'#451a03',bd:'#f59e0b',glow:'#f59e0b',ic:'✦',tc:'#fef3c7',ring:false,anim:true}
  if (on && node.preset === 'progress') return {bg:'#0c1a2e',bd:'#60a5fa',glow:'#60a5fa',ic:'◐',tc:'#bfdbfe',ring:true, anim:true}
  if (on)                               return {bg:pathColor+'28',bd:pathColor,glow:pathColor,ic:'★',tc:'#ffffff',ring:false,anim:false}
  if (node.preset === 'done')           return {bg:'#2c1700',bd:'#78350f',glow:'#78350f',ic:'✓',tc:'#92400e',ring:false,anim:false}
  if (node.preset === 'progress')       return {bg:'#0a1220',bd:'#1e3a8a',glow:'#1e3a8a',ic:'◐',tc:'#3b82f6',ring:true, anim:false}
  if (node.preset === 'pending')        return {bg:'#111827',bd:'#374151',glow:null,      ic:'○',tc:'#6b7280',ring:false,anim:false}
  return                                       {bg:'#06060e',bd:'#1e293b',glow:null,      ic:'·',tc:'#374151',ring:false,anim:false}
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SkillTreePage() {
  const params = useParams()
  const treeType = params.type as string

  const isCareer = treeType === 'career'
  const pageTitle = isCareer ? '⚔ 경력 마일스톤' : '⚙ 기술 스택'
  const defaultConfig = isCareer ? DEFAULT_CAREER : DEFAULT_TECHNICAL
  const canvasW = isCareer ? CANVAS_W : 1150

  const [config, setConfig]           = useState<TreeConfig>(defaultConfig)
  const [activations, setActivations] = useState<Activations>({})
  const [editMode, setEditMode]       = useState(false)
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [linkFrom, setLinkFrom]       = useState<string | null>(null)
  const [tooltip, setTooltip]         = useState<{node: NodeDef; x: number; y: number} | null>(null)
  const [saving, setSaving]           = useState(false)
  const [loaded, setLoaded]           = useState(false)
  const [showPathEditor, setShowPathEditor] = useState(false)

  const dragRef = useRef<{nodeId: string; startMouseY: number; startNodeY: number} | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('skilltree_configs')
      .select('config, activations')
      .eq('tree_type', treeType)
      .single()
      .then(({ data }) => {
        if (data?.config && (data.config as TreeConfig).nodes?.length > 0) {
          setConfig(data.config as TreeConfig)
        }
        if (data?.activations) {
          setActivations(data.activations as Activations)
        } else {
          // seed default activations
          const init: Activations = {}
          defaultConfig.nodes.forEach(n => {
            if (n.preset === 'done' || n.preset === 'progress') init[n.id] = true
          })
          setActivations(init)
        }
        setLoaded(true)
      })
  }, [treeType])

  // ── Save (debounced) ───────────────────────────────────────────────────
  const scheduleSave = useCallback((cfg: TreeConfig, acts: Activations) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await supabase.from('skilltree_configs').upsert({
        tree_type: treeType,
        config: cfg,
        activations: acts,
        updated_at: new Date().toISOString(),
      })
      setSaving(false)
    }, 900)
  }, [treeType])

  const updateConfig = useCallback((next: TreeConfig) => {
    setConfig(next)
    scheduleSave(next, activations)
  }, [activations, scheduleSave])

  const toggleActivation = useCallback((id: string) => {
    setActivations(prev => {
      const next = { ...prev, [id]: !prev[id] }
      scheduleSave(config, next)
      return next
    })
  }, [config, scheduleSave])

  // ── Node drag ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const { nodeId, startMouseY, startNodeY } = dragRef.current
      const dy = e.clientY - startMouseY
      setConfig(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === nodeId
          ? { ...n, y: Math.round(Math.max(0, Math.min(780, startNodeY + dy))) }
          : n
        )
      }))
    }
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        setConfig(prev => { scheduleSave(prev, activations); return prev })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [activations, scheduleSave])

  // ── Node operations ────────────────────────────────────────────────────
  const handleNodeClick = (nodeId: string) => {
    if (linkFrom !== null) {
      if (linkFrom !== nodeId) {
        const fn = config.nodes.find(n => n.id === linkFrom)!
        const tn = config.nodes.find(n => n.id === nodeId)!
        const isCross = fn.pathId !== tn.pathId
        const newEdge: EdgeDef = { id: genId(), from: linkFrom, to: nodeId, cross: isCross, label: '' }
        updateConfig({ ...config, edges: [...config.edges, newEdge] })
      }
      setLinkFrom(null)
      return
    }
    if (editMode) {
      setSelectedId(prev => prev === nodeId ? null : nodeId)
    } else {
      toggleActivation(nodeId)
    }
  }

  const updateNodeField = (id: string, field: keyof NodeDef, value: string | number) => {
    updateConfig({
      ...config,
      nodes: config.nodes.map(n => n.id === id ? { ...n, [field]: value } : n)
    })
  }

  const deleteNode = (id: string) => {
    updateConfig({
      ...config,
      nodes: config.nodes.filter(n => n.id !== id),
      edges: config.edges.filter(e => e.from !== id && e.to !== id),
    })
    setSelectedId(null)
  }

  const addNode = (pathId: string) => {
    const newNode: NodeDef = {
      id: genId(), pathId,
      label: '새 마일스톤', sub: '', desc: '',
      y: 400, preset: '',
    }
    const next = { ...config, nodes: [...config.nodes, newNode] }
    updateConfig(next)
    setSelectedId(newNode.id)
  }

  const deleteEdge = (id: string) => {
    updateConfig({ ...config, edges: config.edges.filter(e => e.id !== id) })
  }

  const addPath = () => {
    const colors = ['#e879f9','#fb7185','#34d399','#38bdf8','#a78bfa','#fbbf24']
    const newPath: PathDef = {
      id: genId(),
      label: '새 경로',
      color: colors[config.paths.length % colors.length],
      x: Math.max(...config.paths.map(p => p.x)) + 240,
    }
    updateConfig({ ...config, paths: [...config.paths, newPath] })
  }

  const updatePath = (id: string, field: keyof PathDef, value: string | number) => {
    updateConfig({
      ...config,
      paths: config.paths.map(p => p.id === id ? { ...p, [field]: value } : p)
    })
  }

  const deletePath = (id: string) => {
    updateConfig({
      ...config,
      paths: config.paths.filter(p => p.id !== id),
      nodes: config.nodes.filter(n => n.pathId !== id),
      edges: config.edges.filter(e => {
        const fn = config.nodes.find(n => n.id === e.from)
        const tn = config.nodes.find(n => n.id === e.to)
        return fn?.pathId !== id && tn?.pathId !== id
      }),
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  const getPath = (id: string) => config.paths.find(p => p.id === id)
  const getNode = (id: string) => config.nodes.find(n => n.id === id)
  const nodeX = (node: NodeDef) => getPath(node.pathId)?.x ?? 0
  const nodeScreenY = (node: NodeDef) => node.y + PAD

  if (!loaded) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-500 text-sm">불러오는 중...</p>
    </main>
  )

  const selectedNode = selectedId ? getNode(selectedId) : null

  return (
    <main
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0b1e 0%, #04040a 60%)', color: 'white' }}
    >
      {/* CSS */}
      <style>{`
        @keyframes glow-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes ring-out { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
        .ring-pulse::before {
          content:''; position:absolute; inset:-5px; border-radius:50%;
          border:2px solid currentColor; animation:ring-out 1.6s ease-out infinite; pointer-events:none;
        }
        .node-circle:hover { transform: scale(1.12); }
        .node-wrap:hover .node-tooltip { opacity:1; }
      `}</style>

      {/* Header */}
      <div className="px-5 pt-3 pb-2 border-b border-gray-800 shrink-0 flex items-center gap-3">
        <Link href="/dashboard/career" className="text-gray-500 hover:text-white text-sm shrink-0">← 진로</Link>
        <h1 className="text-sm font-bold" style={{ fontFamily: 'Georgia, serif', color: '#d4af37', letterSpacing: '2px' }}>
          {pageTitle}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {saving && <span className="text-[10px] text-gray-600">저장 중...</span>}

          {editMode && (
            <>
              <button onClick={() => setShowPathEditor(p => !p)}
                className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
                경로 관리
              </button>
              {linkFrom ? (
                <button onClick={() => setLinkFrom(null)}
                  className="text-xs px-2.5 py-1 bg-purple-700 text-purple-200 rounded-lg animate-pulse">
                  연결 중... (취소)
                </button>
              ) : (
                <button onClick={() => { setSelectedId(null); setLinkFrom('__pending__') }}
                  className="text-xs px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-purple-300 rounded-lg transition">
                  연결 추가
                </button>
              )}
            </>
          )}

          <button
            onClick={() => { setEditMode(p => !p); setSelectedId(null); setLinkFrom(null) }}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
              editMode ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            {editMode ? '✓ 편집중' : '✏ 편집'}
          </button>
        </div>
      </div>

      {/* Path editor panel */}
      {showPathEditor && editMode && (
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {config.paths.map(path => (
              <div key={path.id} className="flex items-center gap-1.5 bg-gray-800 rounded-xl px-2.5 py-1.5">
                <input type="color" value={path.color}
                  onChange={e => updatePath(path.id, 'color', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                <input value={path.label}
                  onChange={e => updatePath(path.id, 'label', e.target.value)}
                  className="bg-transparent text-xs outline-none w-24 text-gray-200" />
                <span className="text-gray-600 text-xs">x:</span>
                <input type="number" value={path.x} step={10}
                  onChange={e => updatePath(path.id, 'x', Number(e.target.value))}
                  className="bg-transparent text-xs outline-none w-14 text-gray-400" />
                <button onClick={() => deletePath(path.id)} className="text-gray-700 hover:text-red-400 text-xs transition">✕</button>
              </div>
            ))}
            <button onClick={addPath}
              className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-xl transition text-gray-300">
              + 경로 추가
            </button>
          </div>
        </div>
      )}

      {/* Main canvas area */}
      <div className="flex-1 overflow-auto relative" onClick={() => { if (linkFrom === '__pending__') setLinkFrom(null) }}>
        <div style={{ position: 'relative', width: canvasW, minHeight: CANVAS_H, margin: '0 auto' }}>

          {/* SVG lines */}
          <svg width={canvasW} height={CANVAS_H}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
            {/* Spine */}
            {config.paths.map(path => {
              const ys = config.nodes.filter(n => n.pathId === path.id).map(n => n.y + PAD)
              if (ys.length < 2) return null
              return <line key={path.id} x1={path.x} y1={Math.min(...ys)} x2={path.x} y2={Math.max(...ys)}
                stroke={path.color + '18'} strokeWidth="3" />
            })}

            {/* Within-path edges */}
            {config.edges.filter(e => !e.cross).map(e => {
              const fn = getNode(e.from), tn = getNode(e.to)
              if (!fn || !tn) return null
              const fp = getPath(fn.pathId)!
              const both = activations[e.from] && activations[e.to]
              return <line key={e.id}
                x1={fp.x} y1={fn.y + PAD} x2={fp.x} y2={tn.y + PAD}
                stroke={both ? fp.color : '#1e293b'} strokeWidth={both ? 2.5 : 1.5}
                strokeOpacity={both ? 0.9 : 0.35} strokeDasharray={both ? undefined : '4,4'} />
            })}

            {/* Cross edges */}
            {config.edges.filter(e => e.cross).map(e => {
              const fn = getNode(e.from), tn = getNode(e.to)
              if (!fn || !tn) return null
              const fp = getPath(fn.pathId)!, tp = getPath(tn.pathId)!
              const fx = fp.x, fy = fn.y + PAD, tx = tp.x, ty = tn.y + PAD
              const mx = (fx + tx) / 2
              const both = activations[e.from] && activations[e.to]
              const col = both ? '#a78bfa' : '#1e1b2e'
              return (
                <g key={e.id}>
                  <path d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`}
                    fill="none" stroke={col} strokeWidth={both ? 2 : 1}
                    strokeDasharray="6,4" strokeOpacity={both ? .9 : .5} />
                  {e.label && <text x={mx} y={(fy + ty) / 2 - 4}
                    fill={both ? '#a78bfa' : '#374151'} fontSize="9"
                    textAnchor="middle" fontFamily="sans-serif">{e.label}</text>}
                  {editMode && (
                    <circle cx={mx} cy={(fy + ty) / 2} r={9} fill="#1e1b2e" fillOpacity=".7"
                      stroke="#4b5563" strokeWidth="1" style={{ cursor: 'pointer', pointerEvents: 'all' }}
                      onClick={() => deleteEdge(e.id)} />
                  )}
                  {editMode && (
                    <text x={mx} y={(fy + ty) / 2 + 3.5} fill="#9ca3af" fontSize="8"
                      textAnchor="middle" fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>✕</text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Path headers */}
          {config.paths.map(path => (
            <div key={`h-${path.id}`} style={{
              position: 'absolute', left: path.x, top: 14,
              transform: 'translateX(-50%)',
              color: path.color, fontSize: 11, fontWeight: 'bold',
              letterSpacing: 2, textAlign: 'center',
              whiteSpace: 'nowrap', fontFamily: 'sans-serif',
              textShadow: `0 0 12px ${path.color}70`,
            }}>{path.label}</div>
          ))}

          {/* Add node buttons (edit mode) */}
          {editMode && config.paths.map(path => {
            const pathNodes = config.nodes.filter(n => n.pathId === path.id)
            const maxY = pathNodes.length > 0 ? Math.max(...pathNodes.map(n => n.y + PAD)) : 400
            return (
              <button key={`add-${path.id}`}
                onClick={() => addNode(path.id)}
                style={{
                  position: 'absolute',
                  left: path.x, top: Math.min(maxY + 50, CANVAS_H - 30),
                  transform: 'translate(-50%, 0)',
                  background: path.color + '22', border: `1px dashed ${path.color}60`,
                  color: path.color, borderRadius: '50%',
                  width: 28, height: 28, fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', zIndex: 5, fontFamily: 'sans-serif',
                }}
              >+</button>
            )
          })}

          {/* Nodes */}
          {config.nodes.map(node => {
            const path = getPath(node.pathId)
            if (!path) return null
            const v = visual(node, activations, path.color)
            const cx = path.x
            const cy = nodeScreenY(node)
            const isSelected = selectedId === node.id
            const isLinkTarget = linkFrom !== null && linkFrom !== '__pending__' && linkFrom !== node.id

            return (
              <div key={node.id} style={{
                position: 'absolute', left: cx, top: cy,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 30 : 10,
                cursor: linkFrom !== null ? (isLinkTarget ? 'cell' : 'default') : (editMode ? 'grab' : 'pointer'),
              }}
                onClick={e => { e.stopPropagation(); handleNodeClick(node.id) }}
                onMouseDown={e => {
                  if (!editMode || linkFrom !== null) return
                  e.preventDefault()
                  const nd = getNode(node.id)!
                  dragRef.current = { nodeId: node.id, startMouseY: e.clientY, startNodeY: nd.y }
                }}
                onMouseEnter={() => !editMode && setTooltip({ node, x: cx, y: cy })}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Ring pulse */}
                {v.ring && <div style={{
                  position: 'absolute', inset: -5, borderRadius: '50%',
                  border: `2px solid ${v.bd}`, animation: 'ring-out 1.6s ease-out infinite',
                  pointerEvents: 'none', color: v.bd,
                }} />}

                {/* Circle */}
                <div className="node-circle" style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: v.bg, border: `2px solid ${isSelected ? '#ffffff' : v.bd}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: v.tc, position: 'relative',
                  boxShadow: v.glow
                    ? `0 0 ${activations[node.id] ? 18 : 7}px ${v.glow}${activations[node.id] ? '88' : '33'}`
                    : isSelected ? '0 0 0 2px white' : undefined,
                  animation: v.anim ? 'glow-pulse 2s ease-in-out infinite' : undefined,
                  transition: 'transform 0.15s',
                  outline: isLinkTarget ? `2px solid #a78bfa` : undefined,
                  outlineOffset: 2,
                }}>{v.ic}</div>

                {/* Label */}
                <div style={{
                  position: 'absolute', top: 28, left: '50%',
                  transform: 'translateX(-50%)', width: 112,
                  textAlign: 'center', pointerEvents: 'none', fontFamily: 'sans-serif',
                }}>
                  <div style={{
                    color: activations[node.id] ? '#e5e7eb' : v.tc,
                    fontSize: 10, fontWeight: 'bold', lineHeight: 1.3, whiteSpace: 'pre-line',
                  }}>{node.label}</div>
                  {node.sub && <div style={{
                    color: activations[node.id] ? '#9ca3af' : '#374151',
                    fontSize: 9, fontStyle: 'italic', marginTop: 1,
                  }}>{node.sub}</div>}
                </div>
              </div>
            )
          })}

          {/* Link mode indicator */}
          {linkFrom && linkFrom !== '__pending__' && (() => {
            const fn = getNode(linkFrom)
            if (!fn) return null
            const fp = getPath(fn.pathId)!
            return (
              <div style={{
                position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
                background: '#1e1b2e', border: '1px solid #a78bfa',
                borderRadius: 10, padding: '6px 14px',
                color: '#a78bfa', fontSize: 11, zIndex: 50,
                fontFamily: 'sans-serif',
              }}>
                <span style={{ color: fp.color }}>{fn.label.replace('\n', ' ')}</span>
                {' '} → 연결할 노드를 클릭
              </div>
            )
          })()}
        </div>

        {/* Tooltip (view mode) */}
        {tooltip && !editMode && (
          <div style={{
            position: 'fixed',
            left: tooltip.x > window.innerWidth / 2 ? tooltip.x - 240 : tooltip.x + 36,
            top: Math.max(8, tooltip.y - 40),
            background: '#09091a', borderRadius: 10,
            padding: '10px 14px', maxWidth: 220,
            border: `1px solid ${(getPath(tooltip.node.pathId)?.color || '#4b5563') + '50'}`,
            zIndex: 999, pointerEvents: 'none', fontFamily: 'sans-serif',
            boxShadow: '0 6px 28px #000000cc',
          }}>
            <div style={{
              color: getPath(tooltip.node.pathId)?.color,
              fontWeight: 'bold', fontSize: 12, marginBottom: 5,
            }}>{tooltip.node.label.replace('\n', ' ')}</div>
            <div style={{ color: '#9ca3af', fontSize: 10, lineHeight: 1.65 }}>{tooltip.node.desc}</div>
            {tooltip.node.sub && <div style={{ color: '#6b7280', fontSize: 9, fontStyle: 'italic', marginTop: 4 }}>{tooltip.node.sub}</div>}
          </div>
        )}
      </div>

      {/* Edit sidebar */}
      {editMode && selectedNode && (() => {
        const path = getPath(selectedNode.pathId)!
        return (
          <div style={{
            position: 'fixed', right: 12, top: 70,
            width: 256, background: '#0f0f1e',
            border: `1px solid ${path.color}40`,
            borderRadius: 16, padding: 16, zIndex: 50,
            boxShadow: `0 8px 32px #000000cc, 0 0 16px ${path.color}20`,
            fontFamily: 'sans-serif',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: path.color, fontWeight: 'bold', fontSize: 12 }}>노드 편집</span>
              <button onClick={() => setSelectedId(null)} style={{ color: '#6b7280', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>

            {[
              { field: 'label' as const, label: '이름', type: 'input' },
              { field: 'sub'   as const, label: '부제 (날짜·점수)', type: 'input' },
              { field: 'desc'  as const, label: '설명', type: 'textarea' },
            ].map(({ field, label, type }) => (
              <div key={field} style={{ marginBottom: 8 }}>
                <div style={{ color: '#6b7280', fontSize: 9, marginBottom: 3 }}>{label}</div>
                {type === 'textarea' ? (
                  <textarea value={selectedNode[field] as string}
                    onChange={e => updateNodeField(selectedNode.id, field, e.target.value)}
                    rows={2} style={{
                      width: '100%', background: '#1a1a2e', border: '1px solid #1e293b',
                      borderRadius: 8, padding: '6px 8px', color: '#e5e7eb',
                      fontSize: 11, outline: 'none', resize: 'none', fontFamily: 'sans-serif',
                    }} />
                ) : (
                  <input value={selectedNode[field] as string}
                    onChange={e => updateNodeField(selectedNode.id, field, e.target.value)}
                    style={{
                      width: '100%', background: '#1a1a2e', border: '1px solid #1e293b',
                      borderRadius: 8, padding: '6px 8px', color: '#e5e7eb',
                      fontSize: 11, outline: 'none', fontFamily: 'sans-serif',
                    }} />
                )}
              </div>
            ))}

            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#6b7280', fontSize: 9, marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
                <span>높이 (낮을수록 고급)</span>
                <span style={{ color: '#4b5563' }}>{selectedNode.y}</span>
              </div>
              <input type="range" min={0} max={780} value={selectedNode.y}
                onChange={e => updateNodeField(selectedNode.id, 'y', Number(e.target.value))}
                style={{ width: '100%', accentColor: path.color }} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ color: '#6b7280', fontSize: 9, marginBottom: 3 }}>상태</div>
              <select value={selectedNode.preset}
                onChange={e => updateNodeField(selectedNode.id, 'preset', e.target.value)}
                style={{
                  width: '100%', background: '#1a1a2e', border: '1px solid #1e293b',
                  borderRadius: 8, padding: '6px 8px', color: '#e5e7eb',
                  fontSize: 11, outline: 'none', fontFamily: 'sans-serif',
                }}>
                <option value="">미착수</option>
                <option value="pending">예정</option>
                <option value="progress">진행중</option>
                <option value="done">완료</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#6b7280', fontSize: 9, marginBottom: 3 }}>경로</div>
              <select value={selectedNode.pathId}
                onChange={e => updateNodeField(selectedNode.id, 'pathId', e.target.value)}
                style={{
                  width: '100%', background: '#1a1a2e', border: '1px solid #1e293b',
                  borderRadius: 8, padding: '6px 8px', color: '#e5e7eb',
                  fontSize: 11, outline: 'none', fontFamily: 'sans-serif',
                }}>
                {config.paths.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setLinkFrom(selectedNode.id)
                setSelectedId(null)
              }} style={{
                flex: 1, padding: '7px 0', background: '#1e1b2e',
                border: '1px solid #4c1d95', borderRadius: 8,
                color: '#a78bfa', fontSize: 10, cursor: 'pointer', fontFamily: 'sans-serif',
              }}>연결 추가</button>
              <button onClick={() => deleteNode(selectedNode.id)} style={{
                flex: 1, padding: '7px 0', background: '#1a0505',
                border: '1px solid #450a0a', borderRadius: 8,
                color: '#f87171', fontSize: 10, cursor: 'pointer', fontFamily: 'sans-serif',
              }}>삭제</button>
            </div>
          </div>
        )
      })()}

      {/* Legend */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
        padding: '5px 8px', borderTop: '1px solid #0f172a',
        fontFamily: 'sans-serif', fontSize: 10, color: '#6b7280', flexShrink: 0,
      }}>
        {[
          {bg:'#451a03',bd:'#f59e0b',ic:'✦',label:'완료'},
          {bg:'#0c1a2e',bd:'#60a5fa',ic:'◐',label:'진행중'},
          {bg:'#111827',bd:'#374151',ic:'○',label:'예정'},
          {bg:'#180c30',bd:'#a78bfa',ic:'★',label:'클릭 달성'},
          {bg:'#06060e',bd:'#1e293b',ic:'·',label:'미착수'},
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: item.bg, border: `1.5px solid ${item.bd}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: item.bd,
            }}>{item.ic}</div>
            <span>{item.label}</span>
          </div>
        ))}
        {editMode && <span style={{ borderLeft: '1px solid #1f2937', paddingLeft: 12 }}>드래그로 높이 조정 · ✕ 클릭으로 연결 삭제</span>}
      </div>
    </main>
  )
}
