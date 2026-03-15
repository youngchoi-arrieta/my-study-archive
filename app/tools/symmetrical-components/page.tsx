'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

// 복소수 타입
type Complex = { re: number; im: number }

const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im })
const scale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s })
const rotate = (a: Complex, deg: number): Complex => {
  const r = deg * Math.PI / 180
  return {
    re: a.re * Math.cos(r) - a.im * Math.sin(r),
    im: a.re * Math.sin(r) + a.im * Math.cos(r),
  }
}
const mag = (a: Complex) => Math.sqrt(a.re * a.re + a.im * a.im)
const ang = (a: Complex) => Math.atan2(a.im, a.re) * 180 / Math.PI

// 대칭좌표 변환
// V0 = (Va + Vb + Vc) / 3
// V1 = (Va + a*Vb + a²*Vc) / 3
// V2 = (Va + a²*Vb + a*Vc) / 3
function symmetricalComponents(Va: Complex, Vb: Complex, Vc: Complex) {
  const aVb = rotate(Vb, 120)
  const a2Vb = rotate(Vb, 240)
  const aVc = rotate(Vc, 120)
  const a2Vc = rotate(Vc, 240)

  const V0 = scale(add(add(Va, Vb), Vc), 1 / 3)
  const V1 = scale(add(add(Va, aVb), a2Vc), 1 / 3)
  const V2 = scale(add(add(Va, a2Vb), aVc), 1 / 3)

  return { V0, V1, V2, aVb, a2Vb, aVc, a2Vc }
}

// SVG 페이저 그리기 헬퍼
const CENTER = 160
const SCALE = 100

function toSVG(c: Complex) {
  return { x: CENTER + c.re * SCALE, y: CENTER - c.im * SCALE }
}

type Phasor = { re: number; im: number; color: string; label: string; dashed?: boolean }

function PhasorArrow({ phasor, origin = { x: CENTER, y: CENTER }, opacity = 1 }: {
  phasor: Phasor
  origin?: { x: number; y: number }
  opacity?: number
}) {
  const end = { x: origin.x + phasor.re * SCALE, y: origin.y - phasor.im * SCALE }
  const dx = end.x - origin.x
  const dy = end.y - origin.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 2) return null
  const ux = dx / len, uy = dy / len
  const arrowSize = 8
  const ax = end.x - ux * arrowSize
  const ay = end.y - uy * arrowSize
  const px = -uy * arrowSize * 0.4
  const py = ux * arrowSize * 0.4

  return (
    <g opacity={opacity}>
      <line
        x1={origin.x} y1={origin.y} x2={end.x} y2={end.y}
        stroke={phasor.color} strokeWidth={phasor.dashed ? 1.5 : 2}
        strokeDasharray={phasor.dashed ? '5,4' : undefined}
      />
      <polygon
        points={`${end.x},${end.y} ${ax + px},${ay + py} ${ax - px},${ay - py}`}
        fill={phasor.color}
      />
      <text x={end.x + ux * 12} y={end.y - uy * 12}
        fill={phasor.color} fontSize="12" fontWeight="bold" textAnchor="middle">
        {phasor.label}
      </text>
    </g>
  )
}

// 애니메이션 단계 정의
type AnimStep = {
  label: string
  desc: string
}

const ANIM_STEPS: AnimStep[] = [
  { label: '①', desc: 'Va, Vb, Vc — 원래 3상 전압' },
  { label: '②', desc: 'a²Vb 계산 (Vb를 240° 회전)' },
  { label: '③', desc: 'aVc 계산 (Vc를 120° 회전)' },
  { label: '④', desc: 'V1 = (Va + aVb + a²Vc) / 3 조립' },
  { label: '⑤', desc: 'aVb 계산 (Vb를 120° 회전)' },
  { label: '⑥', desc: 'a²Vc 계산 (Vc를 240° 회전)' },
  { label: '⑦', desc: 'V2 = (Va + a²Vb + aVc) / 3 조립' },
  { label: '⑧', desc: 'V0 = (Va + Vb + Vc) / 3 조립' },
  { label: '⑨', desc: '✅ 변환 완료: V0, V1, V2' },
]

export default function SymmetricalComponents() {
  // 초기 3상 전압 (불평형 가능)
  const [Va, setVa] = useState<Complex>({ re: 1, im: 0 })
  const [Vb, setVb] = useState<Complex>({ re: -0.5, im: -0.866 })
  const [Vc, setVc] = useState<Complex>({ re: -0.5, im: 0.866 })

  const [animStep, setAnimStep] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [dragging, setDragging] = useState<'Va' | 'Vb' | 'Vc' | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const animRef = useRef<NodeJS.Timeout | null>(null)

  const { V0, V1, V2, aVb, a2Vb, aVc, a2Vc } = symmetricalComponents(Va, Vb, Vc)

  const playAnimation = useCallback(() => {
    setIsPlaying(true)
    setAnimStep(0)
    let step = 0
    const next = () => {
      step++
      if (step >= ANIM_STEPS.length) {
        setIsPlaying(false)
        setAnimStep(ANIM_STEPS.length - 1)
        return
      }
      setAnimStep(step)
      animRef.current = setTimeout(next, 1400)
    }
    animRef.current = setTimeout(next, 1400)
  }, [])

  useEffect(() => {
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [])

  // 드래그 핸들러
  const getSVGCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return null
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      re: (clientX - rect.left - CENTER) / SCALE,
      im: -(clientY - rect.top - CENTER) / SCALE,
    }
  }

  const handleMouseDown = (e: React.MouseEvent, v: 'Va' | 'Vb' | 'Vc') => {
    e.preventDefault()
    setDragging(v)
    setAnimStep(-1)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    const coords = getSVGCoords(e)
    if (!coords) return
    const clamped = {
      re: Math.max(-1.5, Math.min(1.5, coords.re)),
      im: Math.max(-1.5, Math.min(1.5, coords.im)),
    }
    if (dragging === 'Va') setVa(clamped)
    if (dragging === 'Vb') setVb(clamped)
    if (dragging === 'Vc') setVc(clamped)
  }

  const handleMouseUp = () => setDragging(null)

  const resetBalanced = () => {
    setVa({ re: 1, im: 0 })
    setVb({ re: -0.5, im: -0.866 })
    setVc({ re: -0.5, im: 0.866 })
    setAnimStep(-1)
    if (animRef.current) clearTimeout(animRef.current)
    setIsPlaying(false)
  }

  const fmt = (c: Complex) => `${mag(c).toFixed(3)}∠${ang(c).toFixed(1)}°`

  // 입력 SVG (왼쪽): Va Vb Vc
  const inputPhasors: Phasor[] = [
    { ...Va, color: '#f87171', label: 'Va' },
    { ...Vb, color: '#60a5fa', label: 'Vb' },
    { ...Vc, color: '#4ade80', label: 'Vc' },
  ]

  // 단계별 표시할 페이저들
  const getStepPhasors = (): Phasor[] => {
    if (animStep < 0) return []
    const base: Phasor[] = [
      { ...Va, color: '#f87171', label: 'Va' },
      { ...Vb, color: '#60a5fa', label: 'Vb', dashed: true },
      { ...Vc, color: '#4ade80', label: 'Vc', dashed: true },
    ]
    if (animStep === 0) return base
    if (animStep === 1) return [...base, { ...a2Vb, color: '#60a5fa', label: 'a²Vb' }]
    if (animStep === 2) return [...base,
      { ...a2Vb, color: '#60a5fa', label: 'a²Vb' },
      { ...aVc, color: '#4ade80', label: 'aVc' }]
    if (animStep === 3) return [...base,
      { ...a2Vb, color: '#60a5fa', label: 'a²Vb' },
      { ...aVc, color: '#4ade80', label: 'aVc' },
      { ...V1, color: '#fbbf24', label: 'V1' }]
    if (animStep === 4) return [...base,
      { ...a2Vb, color: '#60a5fa', label: 'a²Vb', dashed: true },
      { ...aVc, color: '#4ade80', label: 'aVc', dashed: true },
      { ...V1, color: '#fbbf24', label: 'V1' },
      { ...aVb, color: '#60a5fa', label: 'aVb' }]
    if (animStep === 5) return [...base,
      { ...V1, color: '#fbbf24', label: 'V1' },
      { ...aVb, color: '#60a5fa', label: 'aVb' },
      { ...a2Vc, color: '#4ade80', label: 'a²Vc' }]
    if (animStep === 6) return [...base,
      { ...V1, color: '#fbbf24', label: 'V1' },
      { ...aVb, color: '#60a5fa', label: 'aVb' },
      { ...a2Vc, color: '#4ade80', label: 'a²Vc' },
      { ...V2, color: '#c084fc', label: 'V2' }]
    if (animStep === 7) return [...base,
      { ...V1, color: '#fbbf24', label: 'V1' },
      { ...V2, color: '#c084fc', label: 'V2' },
      { ...V0, color: '#94a3b8', label: 'V0' }]
    // 완료
    return [
      { ...V0, color: '#94a3b8', label: 'V0' },
      { ...V1, color: '#fbbf24', label: 'V1' },
      { ...V2, color: '#c084fc', label: 'V2' },
    ]
  }

  const stepPhasors = getStepPhasors()

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/tools" className="text-gray-400 hover:text-white text-sm">← 도구</Link>
        </div>
        <h1 className="text-2xl font-bold mb-1">⚡ 대칭좌표법 시뮬레이터</h1>
        <p className="text-gray-500 text-sm mb-6">페이저를 드래그해서 불평형 전압을 만들고, 변환 버튼으로 V0·V1·V2 조립 과정을 확인하세요</p>

        {/* 컨트롤 버튼 */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <button onClick={playAnimation} disabled={isPlaying}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-2 rounded-lg font-semibold transition">
            {isPlaying ? '▶ 애니메이션 중...' : '▶ 변환 애니메이션'}
          </button>
          <button onClick={resetBalanced}
            className="bg-gray-700 hover:bg-gray-600 px-5 py-2 rounded-lg transition">
            🔄 평형 3상으로 초기화
          </button>
        </div>

        {/* 애니메이션 단계 설명 */}
        <div className="bg-gray-900 rounded-xl px-4 py-3 mb-6 min-h-[48px] flex items-center gap-3">
          {animStep >= 0 ? (
            <>
              <span className="text-blue-400 font-bold text-lg">{ANIM_STEPS[animStep].label}</span>
              <span className="text-gray-200 text-sm">{ANIM_STEPS[animStep].desc}</span>
            </>
          ) : (
            <span className="text-gray-500 text-sm">페이저를 드래그해서 불평형 전압을 만들고 변환 버튼을 눌러보세요</span>
          )}
          {/* 단계 진행바 */}
          {animStep >= 0 && (
            <div className="ml-auto flex gap-1">
              {ANIM_STEPS.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${i <= animStep ? 'bg-blue-400' : 'bg-gray-700'}`} />
              ))}
            </div>
          )}
        </div>

        {/* SVG 2단 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 왼쪽: 입력 페이저 (드래그 가능) */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-sm text-gray-400 mb-3">📌 입력 전압 <span className="text-xs text-gray-600">(끝점을 드래그)</span></p>
            <svg
              ref={svgRef}
              width="320" height="320"
              className="w-full"
              viewBox="0 0 320 320"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: dragging ? 'grabbing' : 'default' }}
            >
              {/* 격자 */}
              <circle cx={CENTER} cy={CENTER} r={SCALE} fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
              <circle cx={CENTER} cy={CENTER} r={SCALE * 0.5} fill="none" stroke="#374151" strokeWidth="0.5" strokeDasharray="4,4" />
              <line x1={CENTER - SCALE * 1.4} y1={CENTER} x2={CENTER + SCALE * 1.4} y2={CENTER} stroke="#374151" strokeWidth="0.5" />
              <line x1={CENTER} y1={CENTER - SCALE * 1.4} x2={CENTER} y2={CENTER + SCALE * 1.4} stroke="#374151" strokeWidth="0.5" />
              <text x={CENTER + SCALE * 1.4 + 4} y={CENTER + 4} fill="#6b7280" fontSize="10">Re</text>
              <text x={CENTER + 2} y={CENTER - SCALE * 1.4 - 4} fill="#6b7280" fontSize="10">Im</text>

              {/* 페이저들 */}
              {inputPhasors.map((p, i) => {
                const end = toSVG(p)
                const dx = end.x - CENTER, dy = end.y - CENTER
                const len = Math.sqrt(dx * dx + dy * dy)
                if (len < 2) return null
                const ux = dx / len, uy = dy / len
                const arrowSize = 8
                const ax = end.x - ux * arrowSize, ay = end.y - uy * arrowSize
                const px = -uy * arrowSize * 0.4, py = ux * arrowSize * 0.4
                return (
                  <g key={i}>
                    <line x1={CENTER} y1={CENTER} x2={end.x} y2={end.y}
                      stroke={p.color} strokeWidth="2.5" />
                    <polygon points={`${end.x},${end.y} ${ax + px},${ay + py} ${ax - px},${ay - py}`}
                      fill={p.color} />
                    <text x={end.x + ux * 14} y={end.y - uy * 14}
                      fill={p.color} fontSize="13" fontWeight="bold" textAnchor="middle">{p.label}</text>
                    {/* 드래그 핸들 */}
                    <circle cx={end.x} cy={end.y} r="8" fill={p.color} fillOpacity="0.3"
                      stroke={p.color} strokeWidth="1.5"
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) => handleMouseDown(e, ['Va', 'Vb', 'Vc'][i] as 'Va' | 'Vb' | 'Vc')} />
                  </g>
                )
              })}
            </svg>

            {/* 수치 표시 */}
            <div className="mt-3 space-y-1 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                <span className="text-gray-300">Va = {fmt(Va)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                <span className="text-gray-300">Vb = {fmt(Vb)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
                <span className="text-gray-300">Vc = {fmt(Vc)}</span>
              </div>
            </div>
          </div>

          {/* 오른쪽: 변환 결과 */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-sm text-gray-400 mb-3">
              📊 대칭성분
              {animStep === ANIM_STEPS.length - 1 && <span className="text-green-400 ml-2">✅ 변환 완료</span>}
            </p>
            <svg width="320" height="320" className="w-full" viewBox="0 0 320 320">
              {/* 격자 */}
              <circle cx={CENTER} cy={CENTER} r={SCALE} fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
              <circle cx={CENTER} cy={CENTER} r={SCALE * 0.5} fill="none" stroke="#374151" strokeWidth="0.5" strokeDasharray="4,4" />
              <line x1={CENTER - SCALE * 1.4} y1={CENTER} x2={CENTER + SCALE * 1.4} y2={CENTER} stroke="#374151" strokeWidth="0.5" />
              <line x1={CENTER} y1={CENTER - SCALE * 1.4} x2={CENTER} y2={CENTER + SCALE * 1.4} stroke="#374151" strokeWidth="0.5" />

              {/* 단계별 페이저 */}
              {stepPhasors.map((p, i) => (
                <PhasorArrow key={i} phasor={p} />
              ))}

              {/* 아직 애니메이션 전이면 결과만 표시 */}
              {animStep < 0 && (
                <>
                  <PhasorArrow phasor={{ ...V0, color: '#94a3b8', label: 'V0' }} opacity={0.4} />
                  <PhasorArrow phasor={{ ...V1, color: '#fbbf24', label: 'V1' }} opacity={0.4} />
                  <PhasorArrow phasor={{ ...V2, color: '#c084fc', label: 'V2' }} opacity={0.4} />
                </>
              )}
            </svg>

            {/* 수치 표시 */}
            <div className="mt-3 space-y-1 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
                <span className="text-gray-300">V0 (영상) = {fmt(V0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
                <span className="text-gray-300">V1 (정상) = {fmt(V1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
                <span className="text-gray-300">V2 (역상) = {fmt(V2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 수식 설명 */}
        <div className="mt-6 bg-gray-900 rounded-2xl p-5 text-sm text-gray-400">
          <p className="font-semibold text-gray-200 mb-3">📐 대칭좌표 변환 공식</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-gray-400 mb-1">영상분 (Zero)</p>
              <p className="text-white">V0 = ⅓(Va + Vb + Vc)</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-yellow-400 mb-1">정상분 (Positive)</p>
              <p className="text-white">V1 = ⅓(Va + aVb + a²Vc)</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-purple-400 mb-1">역상분 (Negative)</p>
              <p className="text-white">V2 = ⅓(Va + a²Vb + aVc)</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-600">a = 1∠120° = e^(j2π/3), a² = 1∠240°</p>
        </div>
      </div>
    </main>
  )
}
