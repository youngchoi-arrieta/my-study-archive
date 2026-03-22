'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BlankBox, BlankAnswer, ContactType, Problem } from '@/types/trainer'
import { TYPE_LABEL } from '@/lib/trainer/symbols'
import { supabase } from '@/lib/supabase'
import CircuitCanvas from '../components/CircuitCanvas'
import Link from 'next/link'

const CONTACT_TYPES: ContactType[] = ['NO', 'NC', 'tNO', 'tNC', 'coil']
const DEVICE_LABELS = ['EOCR','SS-A','SS-M','FLS','PB0','PB1','X','MC1','MC2','T','FR','RL','GL','YL','BZ']

const DEFAULT_PALETTE: BlankAnswer[] = [
  { label:'EOCR', type:'NC' }, { label:'EOCR', type:'NO' },
  { label:'SS-A', type:'NO' }, { label:'SS-M', type:'NO' },
  { label:'FLS',  type:'NO' }, { label:'PB0',  type:'NC' },
  { label:'PB1',  type:'NO' }, { label:'X',    type:'NO' },
  { label:'MC1',  type:'NO' }, { label:'MC1',  type:'NC' },
  { label:'MC2',  type:'NO' }, { label:'T',    type:'tNO' },
  { label:'FR',   type:'NO' }, { label:'FR',   type:'NC' },
]

const DEFAULT_TIMECHART = {
  steps: 10, stepLabels: ['0','1','2','t','4','5','6','7','8','9'],
  signals: [
    { label:'SS-M',    locked:true,  pattern:[0,1,1,1,1,1,1,0,0,0] as (0|1)[] },
    { label:'PB1',     locked:true,  pattern:[0,1,0,0,0,0,0,0,0,0] as (0|1)[] },
    { label:'T · MC1', locked:false, pattern:[0,1,1,1,1,1,0,0,0,0] as (0|1)[] },
    { label:'T 설정중', locked:true,  pattern:[0,1,1,1,0,0,0,0,0,0] as (0|1)[] },
    { label:'MC2',     locked:false, pattern:[0,0,0,0,1,1,0,0,0,0] as (0|1)[] },
    { label:'RL',      locked:false, pattern:[0,1,1,1,1,1,0,0,0,0] as (0|1)[] },
    { label:'GL',      locked:false, pattern:[0,0,0,0,1,1,0,0,0,0] as (0|1)[] },
    { label:'PB0',     locked:true,  pattern:[0,0,0,0,0,0,1,0,0,0] as (0|1)[] },
  ],
}

let idCounter = Date.now()

export default function AdminPage() {
  const router = useRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [selProbId, setSelProbId] = useState<string | null>(null)
  const [blanks, setBlanks] = useState<BlankBox[]>([])
  const [selBlankId, setSelBlankId] = useState<string | null>(null)
  const [curType, setCurType] = useState<ContactType>('NO')
  const [curLabel, setCurLabel] = useState('MC1')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [showPanel, setShowPanel] = useState(true)

  useEffect(() => { loadProblems() }, [])

  const loadProblems = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('trainer_problems').select('*').order('created_at')
    if (!error && data) setProblems(data as Problem[])
    setLoading(false)
  }

  const selProblem = problems.find(p => p.id === selProbId)
  const selectedBlank = blanks.find(b => b.id === selBlankId)

  const selectProblem = (p: Problem) => {
    setSelProbId(p.id); setBlanks(p.blanks ?? [])
    setSelBlankId(null); setStatus('')
  }

  const handleClickBlankEdit = (id: string) => {
    if (selBlankId === id) { setSelBlankId(null); return }
    const b = blanks.find(b => b.id === id)
    if (b) { setCurType(b.answer.type); setCurLabel(b.answer.label) }
    setSelBlankId(id)
  }

  const handleDragCreate = useCallback((box: { x:number; y:number; w:number; h:number }) => {
    const nb: BlankBox = { id:`b-${idCounter++}`, ...box, answer:{ label:curLabel, type:curType } }
    setBlanks(prev => [...prev, nb])
    setSelBlankId(nb.id)
  }, [curLabel, curType])

  const handleTypeChange = (t: ContactType) => {
    setCurType(t)
    if (selBlankId) setBlanks(prev => prev.map(b => b.id === selBlankId ? { ...b, answer:{ ...b.answer, type:t } } : b))
  }

  const handleLabelChange = (l: string) => {
    setCurLabel(l)
    if (selBlankId) setBlanks(prev => prev.map(b => b.id === selBlankId ? { ...b, answer:{ ...b.answer, label:l } } : b))
  }

  const deleteSelected = () => {
    if (!selBlankId) return
    setBlanks(prev => prev.filter(b => b.id !== selBlankId))
    setSelBlankId(null)
  }

  const saveBlanks = async () => {
    if (!selProbId) return
    setSaving(true)
    const { error } = await supabase.from('trainer_problems').update({ blanks }).eq('id', selProbId)
    setSaving(false)
    if (error) { setStatus('저장 실패: ' + error.message); return }
    router.push('/tools/trainer')
  }

  const updateMeta = async (field: string, value: string) => {
    if (!selProbId) return
    await supabase.from('trainer_problems').update({ [field]: value }).eq('id', selProbId)
    await loadProblems()
  }

  const createNewProblem = async () => {
    const id = `prob-${Date.now()}`
    const { error } = await supabase.from('trainer_problems').insert({
      id, title:'새 문제', exam_type:'전기기능사',
      source_doc:'', description:'', operation_text:'',
      image_path:'/problems/001-A.png',
      blanks:[], palette:DEFAULT_PALETTE,
      timechart:DEFAULT_TIMECHART, difficulty:2, tags:[],
    })
    if (!error) { await loadProblems(); setSelProbId(id); setBlanks([]) }
    else setStatus('생성 실패: ' + error.message)
  }

  const btn = (active: boolean) => ({
    fontSize: 11, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1d4ed8' : '#374151',
    fontWeight: active ? 600 : 400,
  } as React.CSSProperties)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#fff', color:'#111827', fontFamily:'var(--font-sans)' }}>
      {/* 상단바 */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 14px', borderBottom:'1px solid #e5e7eb', flexShrink:0, background:'#fff' }}>
        <Link href="/tools/trainer" style={{ color:'#9ca3af', fontSize:12, textDecoration:'none' }}>← 학습 모드</Link>
        <span style={{ color:'#e5e7eb' }}>|</span>
        <span style={{ fontSize:13, fontWeight:700, color:'#111827' }}>편집기</span>
        {status && <span style={{ fontSize:11, color:'#dc2626', marginLeft:8 }}>{status}</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setShowPanel(v => !v)}
            style={{ fontSize:11, padding:'3px 10px', borderRadius:5, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#6b7280', cursor:'pointer' }}>
            {showPanel ? '패널 숨기기' : '패널 보기'}
          </button>
          <button onClick={createNewProblem}
            style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#fff', color:'#374151', cursor:'pointer' }}>
            + 새 문제
          </button>
          <button onClick={saveBlanks} disabled={!selProbId || saving}
            style={{ fontSize:11, padding:'4px 16px', borderRadius:6, border:'none', fontWeight:600,
              background: selProbId ? '#2563eb' : '#e5e7eb',
              color: selProbId ? '#fff' : '#9ca3af',
              cursor: selProbId ? 'pointer' : 'not-allowed' }}>
            {saving ? '저장 중...' : '저장 →'}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* 문제 목록 */}
        <div style={{ width:150, borderRight:'1px solid #e5e7eb', overflow:'auto', flexShrink:0, padding:'8px 0', background:'#f9fafb' }}>
          <div style={{ fontSize:10, color:'#9ca3af', fontWeight:600, padding:'0 10px', marginBottom:6, letterSpacing:'.08em' }}>문제 목록</div>
          {loading ? <div style={{ fontSize:11, color:'#9ca3af', padding:'8px 10px' }}>로딩 중...</div>
            : problems.map(p => (
            <button key={p.id} onClick={() => selectProblem(p)}
              style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 10px', border:'none',
                background: selProbId===p.id ? '#eff6ff' : 'transparent',
                color: selProbId===p.id ? '#1d4ed8' : '#374151',
                fontSize:11, cursor:'pointer',
                borderLeft: selProbId===p.id ? '3px solid #3b82f6' : '3px solid transparent',
                fontWeight: selProbId===p.id ? 600 : 400 }}>
              {p.title}
            </button>
          ))}
        </div>

        {!selProblem ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:13 }}>
            문제를 선택하거나 새 문제를 만드세요
          </div>
        ) : (
          <>
            {/* 캔버스 — 패널 숨기면 학습화면과 완전 동일한 너비 */}
            <div style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
              <div style={{ padding:'6px 10px', borderBottom:'1px solid #e5e7eb', display:'flex', gap:8, alignItems:'center', background:'#f9fafb' }}>
                <input defaultValue={selProblem.title} onBlur={e => updateMeta('title', e.target.value)}
                  style={{ fontSize:12, background:'#fff', border:'1px solid #d1d5db', borderRadius:5, padding:'3px 8px', color:'#111827', width:200 }}
                  placeholder="문제 제목" />
                <input defaultValue={selProblem.description ?? ''} onBlur={e => updateMeta('description', e.target.value)}
                  style={{ fontSize:11, background:'#fff', border:'1px solid #d1d5db', borderRadius:5, padding:'3px 8px', color:'#6b7280', flex:1 }}
                  placeholder="동작 사항 요약" />
                <span style={{ fontSize:10, color:'#9ca3af', flexShrink:0 }}>
                  blank {blanks.length}개 · 십자 커서로 드래그
                </span>
              </div>
              <div style={{ flex:1, overflow:'auto' }}>
                <CircuitCanvas
                  imagePath={selProblem.image_path ?? '/problems/001-A.png'}
                  imageW={1002} imageH={576}
                  blanks={blanks}
                  editMode={true}
                  onDragCreate={handleDragCreate}
                  onClickBlankEdit={handleClickBlankEdit}
                  selectedEditId={selBlankId}
                />
              </div>
            </div>

            {/* 오른쪽 패널 */}
            {showPanel && (
              <div style={{ width:210, borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', flexShrink:0, background:'#f9fafb' }}>

                {/* 상태 */}
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #e5e7eb' }}>
                  <div style={{ fontSize:11, color:'#6b7280' }}>
                    {selectedBlank
                      ? <span style={{ color:'#d97706', fontWeight:600 }}>#{blanks.findIndex(b=>b.id===selBlankId)+1} 수정 중</span>
                      : <span>드래그로 blank 추가</span>
                    }
                    <span style={{ marginLeft:8, color:'#1d4ed8', fontWeight:700 }}>
                      {curLabel} {TYPE_LABEL[curType]}
                    </span>
                  </div>
                </div>

                {/* 접점 종류 */}
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #e5e7eb' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', marginBottom:6, fontWeight:600 }}>접점 종류</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {CONTACT_TYPES.map(t => (
                      <button key={t} onClick={() => handleTypeChange(t)} style={btn(curType===t)}>
                        {TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 기기 기호 */}
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #e5e7eb' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', marginBottom:6, fontWeight:600 }}>기기 기호</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                    {DEVICE_LABELS.map(l => (
                      <button key={l} onClick={() => handleLabelChange(l)} style={btn(curLabel===l)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 삭제 */}
                {selectedBlank && (
                  <div style={{ padding:'8px 12px', borderBottom:'1px solid #e5e7eb' }}>
                    <button onClick={deleteSelected}
                      style={{ fontSize:11, padding:'5px 12px', borderRadius:5, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', cursor:'pointer', width:'100%', fontWeight:600 }}>
                      선택 blank 삭제
                    </button>
                  </div>
                )}

                {/* blank 목록 */}
                <div style={{ padding:12, flex:1, overflow:'auto' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', marginBottom:6, fontWeight:600 }}>Blank 목록 ({blanks.length}개)</div>
                  {blanks.length === 0 && (
                    <div style={{ fontSize:11, color:'#d1d5db' }}>도면 위를 드래그해서 추가</div>
                  )}
                  {blanks.map((b, i) => (
                    <div key={b.id} onClick={() => handleClickBlankEdit(b.id)}
                      style={{ padding:'5px 8px', borderRadius:5, marginBottom:3, cursor:'pointer',
                        background: selBlankId===b.id ? '#fffbeb' : '#fff',
                        border:`1px solid ${selBlankId===b.id ? '#fbbf24' : '#e5e7eb'}`,
                        fontSize:11, display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ color:'#9ca3af' }}>#{i+1}</span>
                      <span style={{ color:'#1d4ed8', fontWeight:600 }}>{b.answer.label}</span>
                      <span style={{ color:'#6b7280' }}>{TYPE_LABEL[b.answer.type]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
