'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────
type Status = '머릿속' | '낙서' | '만드는 중' | '세상에 냄' | '잠든'
type OutputType = '인터랙티브 앱' | '글/포스팅' | '물리 실험' | '영상' | '기타'

type Idea = {
  id: string
  title: string
  one_liner: string
  tags: string[]
  output_type: OutputType
  status: Status
  notes: string
  links: string[]
  created_at: string
}

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { icon: string; color: string; bg: string }> = {
  '머릿속':    { icon: '💭', color: '#9ca3af', bg: '#1f2937' },
  '낙서':      { icon: '✏',  color: '#fbbf24', bg: '#292008' },
  '만드는 중': { icon: '⚙',  color: '#60a5fa', bg: '#0d1a2e' },
  '세상에 냄': { icon: '☀',  color: '#34d399', bg: '#041a12' },
  '잠든':      { icon: '🌙',  color: '#6b7280', bg: '#111827' },
}

const OUTPUT_ICONS: Record<OutputType, string> = {
  '인터랙티브 앱': '🖥',
  '글/포스팅':    '📝',
  '물리 실험':    '🔧',
  '영상':         '🎥',
  '기타':         '🌀',
}

const STATUSES: Status[] = ['머릿속', '낙서', '만드는 중', '세상에 냄', '잠든']
const OUTPUTS: OutputType[] = ['인터랙티브 앱', '글/포스팅', '물리 실험', '영상', '기타']

// ── Seed ideas from conversations ─────────────────────────────────────────
const SEED_IDEAS: Omit<Idea, 'id' | 'created_at'>[] = [
  {
    title: '복선도 디지털 토이',
    one_liner: '스위치를 클릭하면 전구가 켜진다. 잘못 연결하면 차단기가 내려간다.',
    tags: ['배선도', '시뮬레이션', '전기공사'],
    output_type: '인터랙티브 앱',
    status: '낙서',
    notes: '- 가상 스위치/전구 시뮬레이션. 위험 배선 시각화. 단락 시 차단기 트립\n- 2D 복선도 ↔ 3D 아웃렛 박스 실시간 변환 + 슬리브 규격 스펙 연동\n- 9급(단순 배선) → 1단(시퀀스 제어) 백준/검도 단 방식 레벨 시스템',
    links: [],
  },
  {
    title: 'Δ-Y 차동보호 CT 결선 인터랙티브',
    one_liner: '변압기 1차·2차에 CT를 어떻게 물리는지 클릭으로 조립해보는 것.',
    tags: ['보호계전', 'CT', '변압기'],
    output_type: '인터랙티브 앱',
    status: '머릿속',
    notes: '직접 Δ-Y 차동보호 CT 결선을 1원론부터 재구성했던 경험. 그 과정 자체가 콘텐츠.\n영어로 Blackburn & Domin 참고 수준까지 파고들었음.',
    links: [],
  },
  {
    title: 'Time-Current 커브 플로터',
    one_liner: 'OCR 정정치를 입력하면 IEC/IEEE 표준 동작 곡선이 그려진다.',
    tags: ['보호계전', '과전류계전기', '전력계통'],
    output_type: '인터랙티브 앱',
    status: '머릿속',
    notes: 'Ry1~Ry4 탭 설정값 계산 문제를 여러 번 풀었는데, 직접 그래프로 보고 싶었음.\nIEC 표준 역한시 특성 4종 + IEEE 특성 선택 가능하면 좋겠다.',
    links: [],
  },
  {
    title: '행성 역행 시뮬레이터',
    one_liner: '지구에서 보면 화성이 왜 거꾸로 가는 것처럼 보이는가.',
    tags: ['물리', '천문학', '시각화'],
    output_type: '인터랙티브 앱',
    status: '세상에 냄',
    notes: 'p5.js로 이미 만든 것. 박사 과정 시절 강의 준비하다 만들었음.',
    links: [],
  },
  {
    title: '배선도 분석 세션',
    one_liner: '시험에 나온 배선도를 붙여넣고 자문자답으로 분석하는 노트.',
    tags: ['배선도', '전기공사사', '학습'],
    output_type: '기타',
    status: '세상에 냄',
    notes: '이미 study-archive 안에 구현됨. /dashboard/denkoshi/wiring',
    links: ['/dashboard/denkoshi/wiring'],
  },
  {
    title: '임피던스 복소평면 시각화',
    one_liner: '주파수를 돌리면 RL·RC·RLC 임피던스가 복소평면 위에서 움직인다.',
    tags: ['회로이론', '물리', '시각화'],
    output_type: '인터랙티브 앱',
    status: '머릿속',
    notes: 'KAIST 회로이론 수업 때 직관적으로 이해하기 어려웠던 부분. 페이저가 그냥 보이면 좋겠다.',
    links: [],
  },
  {
    title: '전선 규격 자동 선정기',
    one_liner: '부하 전류, 배선 방법, 길이를 넣으면 전선 굵기와 전압강하가 나온다.',
    tags: ['내선규정', '전기공사', '계산'],
    output_type: '인터랙티브 앱',
    status: '머릿속',
    notes: '수험 중에 표 뒤지면서 계산하는 게 너무 번거로웠음. 자동화하면 현장에서도 쓸 것 같다.\n내선규정 부하표, 허용전류표, KS 규격 내장.',
    links: [],
  },
  {
    title: 'PLC 래더 로직 클릭 시뮬레이터',
    one_liner: 'MC·인터록·타이머를 클릭하면서 시퀀스가 어떻게 흐르는지 본다.',
    tags: ['PLC', '시퀀스제어', '계측제어'],
    output_type: '인터랙티브 앱',
    status: '머릿속',
    notes: '오송 실습 때 XG5000으로 직접 짰지만 시각적으로 "왜 이 순서인지"를 설명하기 어려웠음.\n인터록의 논리를 직관적으로 보여주는 도구가 없다.',
    links: [],
  },
]

function genId() { return Math.random().toString(36).slice(2, 10) }

// ── Empty form ─────────────────────────────────────────────────────────────
const EMPTY: Omit<Idea, 'id' | 'created_at'> = {
  title: '', one_liner: '', tags: [], output_type: '인터랙티브 앱',
  status: '머릿속', notes: '', links: [],
}

// ── Main component ─────────────────────────────────────────────────────────
export default function PortfolioView() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [filterType, setFilterType] = useState<OutputType | 'all'>('all')
  const [selected, setSelected] = useState<Idea | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Omit<Idea, 'id' | 'created_at'>>(EMPTY)
  const [tagInput, setTagInput] = useState('')
  const [linkInput, setLinkInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingNew, setAddingNew] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('portfolio_ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) {
      // Seed default ideas
      const seeded: Idea[] = SEED_IDEAS.map(s => ({
        ...s,
        id: genId(),
        created_at: new Date().toISOString(),
      }))
      const { data: inserted } = await supabase
        .from('portfolio_ideas')
        .insert(seeded)
        .select()
      setIdeas((inserted as Idea[]) || seeded)
    } else {
      setIdeas(data as Idea[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Save ──────────────────────────────────────────────────────────────
  const saveIdea = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    if (editing && selected) {
      const { data } = await supabase
        .from('portfolio_ideas')
        .update({ ...form, tags: form.tags, links: form.links })
        .eq('id', selected.id)
        .select()
        .single()
      if (data) {
        setIdeas(prev => prev.map(i => i.id === selected.id ? data as Idea : i))
        setSelected(data as Idea)
      }
      setEditing(false)
    } else {
      const newIdea = { ...form, id: genId(), created_at: new Date().toISOString() }
      const { data } = await supabase
        .from('portfolio_ideas')
        .insert(newIdea)
        .select()
        .single()
      if (data) setIdeas(prev => [data as Idea, ...prev])
      setAddingNew(false)
    }
    setSaving(false)
  }

  const deleteIdea = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('portfolio_ideas').delete().eq('id', id)
    setIdeas(prev => prev.filter(i => i.id !== id))
    setSelected(null)
  }

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from('portfolio_ideas').update({ status }).eq('id', id)
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
  }

  // ── Filter ────────────────────────────────────────────────────────────
  const filtered = ideas.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterType !== 'all' && i.output_type !== filterType) return false
    return true
  })

  // ── Form helpers ──────────────────────────────────────────────────────
  const startAdd = () => {
    setForm(EMPTY)
    setTagInput('')
    setLinkInput('')
    setAddingNew(true)
    setSelected(null)
    setEditing(false)
  }

  const startEdit = (idea: Idea) => {
    setForm({
      title: idea.title, one_liner: idea.one_liner,
      tags: [...idea.tags], output_type: idea.output_type,
      status: idea.status, notes: idea.notes, links: [...idea.links],
    })
    setTagInput('')
    setLinkInput('')
    setEditing(true)
    setAddingNew(false)
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) setForm(p => ({ ...p, tags: [...p.tags, t] }))
    setTagInput('')
  }

  const addLink = () => {
    const l = linkInput.trim()
    if (l && !form.links.includes(l)) setForm(p => ({ ...p, links: [...p.links, l] }))
    setLinkInput('')
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-600 text-sm">불러오는 중...</div>
  )

  const showForm = addingNew || editing

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-white">찬란한 무용함</h2>
          <p className="text-xs text-gray-600 mt-0.5">호기심이 이끄는 대로 만들어 보는 것들. 유용함은 부산물.</p>
        </div>
        <button
          onClick={startAdd}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold transition"
        >
          + 새 아이디어
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded-lg text-xs transition ${filterStatus === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800'}`}>
            전체 {ideas.length}
          </button>
          {STATUSES.map(s => {
            const c = STATUS_CONFIG[s]
            const cnt = ideas.filter(i => i.status === s).length
            return (
              <button key={s} onClick={() => setFilterStatus(s === filterStatus ? 'all' : s)}
                className={`px-2.5 py-1 rounded-lg text-xs transition ${filterStatus === s ? 'text-white' : 'text-gray-500 hover:bg-gray-800'}`}
                style={{ background: filterStatus === s ? c.bg : undefined, border: filterStatus === s ? `1px solid ${c.color}40` : '1px solid transparent' }}>
                {c.icon} {s} {cnt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-4" style={{ gridTemplateColumns: selected ? '1fr 360px' : '1fr' }}>

        {/* Card grid */}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: selected ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(idea => {
            const sc = STATUS_CONFIG[idea.status]
            const isSel = selected?.id === idea.id
            return (
              <div
                key={idea.id}
                onClick={() => { setSelected(isSel ? null : idea); setEditing(false); setAddingNew(false) }}
                className="rounded-2xl p-4 cursor-pointer transition group"
                style={{
                  background: isSel ? '#0f0f1e' : '#0a0a14',
                  border: `1px solid ${isSel ? sc.color + '50' : '#1e293b'}`,
                  boxShadow: isSel ? `0 0 20px ${sc.color}15` : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{OUTPUT_ICONS[idea.output_type]}</span>
                    <span className="font-bold text-sm text-white truncate">{idea.title}</span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: sc.color }}>{sc.icon} {idea.status}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-2.5">{idea.one_liner}</p>
                <div className="flex flex-wrap gap-1">
                  {idea.tags.map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{t}</span>
                  ))}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-700 text-sm col-span-full">아직 없음.</div>
          )}
        </div>

        {/* Detail / Form panel */}
        {(selected || showForm) && (
          <div className="bg-gray-950 rounded-2xl p-5 border border-gray-800 self-start"
            style={{ position: 'sticky', top: 12 }}>
            {showForm ? (
              // ── Edit/Add Form ──
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-gray-400">{addingNew ? '새 아이디어' : '편집'}</p>
                  <button onClick={() => { setAddingNew(false); setEditing(false) }} className="text-gray-700 hover:text-white text-sm">✕</button>
                </div>

                {[
                  { key: 'title' as const, label: '제목', placeholder: '어떤 건가요?' },
                  { key: 'one_liner' as const, label: '한 줄 직감', placeholder: '머릿속 첫 번째 문장 그대로' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-[10px] text-gray-600 mb-1 block">{label}</label>
                    <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-gray-600" />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-600 mb-1 block">형태</label>
                    <select value={form.output_type} onChange={e => setForm(p => ({ ...p, output_type: e.target.value as OutputType }))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-gray-300 outline-none">
                      {OUTPUTS.map(o => <option key={o} value={o}>{OUTPUT_ICONS[o]} {o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600 mb-1 block">상태</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Status }))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-2 text-xs text-gray-300 outline-none">
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].icon} {s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">태그</label>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {form.tags.map(t => (
                      <span key={t} onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}
                        className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 cursor-pointer hover:bg-red-900/30 hover:text-red-400 transition">
                        {t} ✕
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTag()}
                      placeholder="태그 입력 후 Enter"
                      className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none" />
                    <button onClick={addTag} className="px-2.5 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-400 hover:bg-gray-700 transition">추가</button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">메모</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={4} placeholder="아무거나. 생각의 흔적."
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none resize-none focus:border-gray-600" />
                </div>

                <div>
                  <label className="text-[10px] text-gray-600 mb-1 block">링크</label>
                  <div className="space-y-1 mb-1.5">
                    {form.links.map(l => (
                      <div key={l} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-blue-400 truncate flex-1">{l}</span>
                        <button onClick={() => setForm(p => ({ ...p, links: p.links.filter(x => x !== l) }))}
                          className="text-gray-700 hover:text-red-400 text-xs transition">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input value={linkInput} onChange={e => setLinkInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addLink()}
                      placeholder="URL 입력"
                      className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 outline-none" />
                    <button onClick={addLink} className="px-2.5 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-400 hover:bg-gray-700 transition">추가</button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={saveIdea} disabled={saving || !form.title.trim()}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-2 text-xs font-semibold transition disabled:opacity-50">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button onClick={() => { setAddingNew(false); setEditing(false) }}
                    className="flex-1 bg-gray-900 text-gray-500 rounded-xl py-2 text-xs transition hover:bg-gray-800">
                    취소
                  </button>
                </div>
              </div>
            ) : selected ? (
              // ── Detail view ──
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{OUTPUT_ICONS[selected.output_type]}</span>
                      <h3 className="font-bold text-white text-sm">{selected.title}</h3>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{selected.one_liner}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-700 hover:text-white text-sm shrink-0">✕</button>
                </div>

                {/* Status picker */}
                <div>
                  <p className="text-[10px] text-gray-600 mb-1.5">상태</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => {
                      const c = STATUS_CONFIG[s]
                      const isActive = selected.status === s
                      return (
                        <button key={s} onClick={() => updateStatus(selected.id, s)}
                          className="px-2.5 py-1 rounded-lg text-xs transition"
                          style={{
                            background: isActive ? c.bg : '#111827',
                            color: isActive ? c.color : '#4b5563',
                            border: `1px solid ${isActive ? c.color + '60' : 'transparent'}`,
                          }}>
                          {c.icon} {s}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-500">{t}</span>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div>
                    <p className="text-[10px] text-gray-600 mb-1.5">메모</p>
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line">{selected.notes}</p>
                  </div>
                )}

                {/* Links */}
                {selected.links.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-600 mb-1.5">링크</p>
                    {selected.links.map(l => (
                      <a key={l} href={l} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 block truncate transition">{l}</a>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-gray-800">
                  <button onClick={() => startEdit(selected)}
                    className="flex-1 py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 rounded-lg text-xs transition">
                    편집
                  </button>
                  <button onClick={() => deleteIdea(selected.id)}
                    className="px-3 py-1.5 text-gray-700 hover:text-red-400 text-xs transition">
                    삭제
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
