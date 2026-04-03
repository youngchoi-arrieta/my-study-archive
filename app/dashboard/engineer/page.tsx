'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

type ExamSession = {
  id: string
  year: number | null
  session: number | null
  pass_rate: number | null
  my_score: number | null
  memo_electrical_design: string | null
  memo_substation: string | null
  memo_logic_sequence: string | null
  memo_lighting: string | null
  memo_kec: string | null
  memo_supervision: string | null
  comments: string | null
  record_type: string
  custom_name: string | null
  updated_at: string
}

const PASS_RATE_GROUPS = [
  { label: '< 10%', min: 0, max: 10, color: 'text-red-400', bg: 'bg-red-900/30' },
  { label: '10~20%', min: 10, max: 20, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  { label: '20~30%', min: 20, max: 30, color: 'text-blue-400', bg: 'bg-blue-900/30' },
  { label: '30%+', min: 30, max: 999, color: 'text-green-400', bg: 'bg-green-900/30' },
]

const MEMO_FIELDS = [
  { key: 'memo_electrical_design' as const, label: '전기설비설계' },
  { key: 'memo_substation' as const, label: '수변전설비' },
  { key: 'memo_logic_sequence' as const, label: '논리/시퀀스' },
  { key: 'memo_lighting' as const, label: '조명설비' },
  { key: 'memo_kec' as const, label: 'KEC' },
  { key: 'memo_supervision' as const, label: '감리' },
]

const EMPTY_ADD_FORM = {
  record_type: '기출문제',
  year: '', session: '', pass_rate: '', custom_name: '', my_score: '',
  memo_electrical_design: '', memo_substation: '', memo_logic_sequence: '',
  memo_lighting: '', memo_kec: '', memo_supervision: '', comments: '',
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ExamSession>>({})
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scored' | 'unscored' | 'custom'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ ...EMPTY_ADD_FORM })
  const [addSaving, setAddSaving] = useState(false)

  useEffect(() => { fetchSessions() }, [])

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('exam_sessions')
      .select('*')
      .order('pass_rate', { ascending: true, nullsFirst: false })
    setSessions(data || [])
    setLoading(false)
  }

  const handleEdit = (s: ExamSession) => {
    setEditing(s.id); setExpanded(s.id)
    setEditForm({
      my_score: s.my_score,
      memo_electrical_design: s.memo_electrical_design || '',
      memo_substation: s.memo_substation || '',
      memo_logic_sequence: s.memo_logic_sequence || '',
      memo_lighting: s.memo_lighting || '',
      memo_kec: s.memo_kec || '',
      memo_supervision: s.memo_supervision || '',
      comments: s.comments || '',
    })
  }

  const handleSave = async (id: string) => {
    setSaving(true)
    await supabase.from('exam_sessions').update({ ...editForm, updated_at: new Date().toISOString() }).eq('id', id)
    await fetchSessions(); setEditing(null); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('exam_sessions').delete().eq('id', id)
    await fetchSessions()
  }

  const handleAdd = async () => {
    setAddSaving(true)
    const isExam = addForm.record_type === '기출문제'
    const { error } = await supabase.from('exam_sessions').insert({
      record_type: addForm.record_type,
      year: isExam && addForm.year ? Number(addForm.year) : null,
      session: isExam && addForm.session ? Number(addForm.session) : null,
      pass_rate: isExam && addForm.pass_rate ? Number(addForm.pass_rate) : null,
      custom_name: !isExam ? addForm.custom_name : null,
      my_score: addForm.my_score ? Number(addForm.my_score) : null,
      memo_electrical_design: addForm.memo_electrical_design || null,
      memo_substation: addForm.memo_substation || null,
      memo_logic_sequence: addForm.memo_logic_sequence || null,
      memo_lighting: addForm.memo_lighting || null,
      memo_kec: addForm.memo_kec || null,
      memo_supervision: addForm.memo_supervision || null,
      comments: addForm.comments || null,
    })
    if (!error) { await fetchSessions(); setShowAddForm(false); setAddForm({ ...EMPTY_ADD_FORM }) }
    else alert('저장 실패: ' + error.message)
    setAddSaving(false)
  }

  const getDisplayName = (s: ExamSession) => {
    if (s.record_type === '사설 모의고사') return s.custom_name || '사설 모의고사'
    if (s.year && s.session) return `${s.year}년 ${s.session}회`
    return s.custom_name || '기타'
  }

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500'
    if (score >= 60) return 'text-green-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getGroup = (rate: number | null) =>
    PASS_RATE_GROUPS.find(g => (rate ?? 0) >= g.min && (rate ?? 0) < g.max) || PASS_RATE_GROUPS[3]

  const examOnly = sessions.filter(s => s.record_type !== '사설 모의고사')
  const customOnly = sessions.filter(s => s.record_type === '사설 모의고사')
  const examScored = examOnly.filter(s => s.my_score !== null)
  const examTotal = examOnly.length

  // 최근 5회 평균 (updated_at 최신순)
  const allScored = sessions.filter(s => s.my_score !== null)
  const recent5 = [...allScored]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)
  const recent5Avg = recent5.length > 0
    ? (recent5.reduce((a, b) => a + (b.my_score || 0), 0) / recent5.length).toFixed(1)
    : '-'

  const filtered = sessions.filter(s => {
    if (filter === 'scored') return s.my_score !== null
    if (filter === 'unscored') return s.my_score === null
    if (filter === 'custom') return s.record_type === '사설 모의고사'
    return true
  })

  const filteredCustom = filtered.filter(s => s.record_type === '사설 모의고사')
  const filteredExam = filtered.filter(s => s.record_type !== '사설 모의고사')
  const recentExam = filteredExam.filter(s => s.year !== null && s.year >= 2016)
  const oldExam = filteredExam.filter(s => s.year === null || s.year < 2016)

  if (loading) return <div className="min-h-screen bg-gray-950 text-white p-8">불러오는 중...</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">← 대시보드</Link>
        </div>
        <div className="flex justify-between items-start mb-1">
          <h1 className="text-3xl font-bold">⚡ 전기기사 실기 기출문제</h1>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0 ml-4">
            + 기록 추가
          </button>
        </div>
        <p className="text-gray-500 text-sm mb-6">합격률 낮은 순 · 회차별 점수 및 영역별 메모 관리</p>

        {/* 기록 추가 폼 */}
        {showAddForm && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <h3 className="font-semibold mb-4">📝 새 기록 추가</h3>
            <div className="flex gap-3 mb-4">
              {['기출문제', '사설 모의고사'].map(t => (
                <button key={t} onClick={() => setAddForm({ ...addForm, record_type: t })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    addForm.record_type === t ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  {t === '기출문제' ? '📋 기출문제' : '📝 사설 모의고사'}
                </button>
              ))}
            </div>
            {addForm.record_type === '기출문제' ? (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">연도</label>
                  <input type="number" className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white"
                    placeholder="2024" value={addForm.year}
                    onChange={e => setAddForm({ ...addForm, year: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">회차</label>
                  <input type="number" className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white"
                    placeholder="1" value={addForm.session}
                    onChange={e => setAddForm({ ...addForm, session: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">합격률 (%)</label>
                  <input type="number" className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white"
                    placeholder="35.2" value={addForm.pass_rate}
                    onChange={e => setAddForm({ ...addForm, pass_rate: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-1 block">이름</label>
                <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white"
                  placeholder="예: 에듀윌 모의고사 1회 (2024-03-15)"
                  value={addForm.custom_name}
                  onChange={e => setAddForm({ ...addForm, custom_name: e.target.value })} />
              </div>
            )}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">내 점수 / 100</label>
              <input type="number" min="0" max="100"
                className="w-32 bg-gray-800 rounded-lg px-3 py-2 text-white"
                placeholder="점수" value={addForm.my_score}
                onChange={e => setAddForm({ ...addForm, my_score: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {MEMO_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                  <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-16 resize-none"
                    placeholder={`${f.label} 취약 문항...`}
                    value={addForm[f.key]}
                    onChange={e => setAddForm({ ...addForm, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">Comments</label>
              <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-16 resize-none"
                placeholder="전반적인 코멘트..."
                value={addForm.comments}
                onChange={e => setAddForm({ ...addForm, comments: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={addSaving}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                {addSaving ? '저장 중...' : '💾 저장'}
              </button>
              <button onClick={() => { setShowAddForm(false); setAddForm({ ...EMPTY_ADD_FORM }) }}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                취소
              </button>
            </div>
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">
              {examScored.length}<span className="text-gray-500 text-base"> / {examTotal}</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">기출 풀이 완료</p>
            {customOnly.length > 0 && (
              <p className="text-xs text-purple-400 mt-0.5">+ 사설 {customOnly.filter(s => s.my_score !== null).length}회</p>
            )}
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{recent5Avg}</p>
            <p className="text-gray-400 text-sm mt-1">최근 5회 평균</p>
            <p className="text-xs text-gray-600 mt-0.5">{recent5.length}회 기준</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {examTotal > 0 ? Math.round(examScored.length / examTotal * 100) : 0}%
            </p>
            <p className="text-gray-400 text-sm mt-1">기출 진행률</p>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="bg-gray-900 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>기출문제 풀이 진행률</span>
            <span>{examScored.length} / {examTotal}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 mb-3">
            <div className="bg-blue-500 h-3 rounded-full transition-all"
              style={{ width: `${examTotal > 0 ? examScored.length / examTotal * 100 : 0}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PASS_RATE_GROUPS.map(g => {
              const gs = examOnly.filter(s => (s.pass_rate ?? 0) >= g.min && (s.pass_rate ?? 0) < g.max)
              const gScored = gs.filter(s => s.my_score !== null)
              if (gs.length === 0) return null
              return (
                <div key={g.label} className="text-center">
                  <p className={`text-xs font-semibold ${g.color}`}>{g.label}</p>
                  <p className="text-xs text-gray-400">{gScored.length}/{gs.length}</p>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${g.color.replace('text-', 'bg-')}`}
                      style={{ width: `${gs.length > 0 ? gScored.length / gs.length * 100 : 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {([
            { key: 'all' as const, label: '전체' },
            { key: 'scored' as const, label: '✅ 풀이완료' },
            { key: 'unscored' as const, label: '⬜ 미풀이' },
            { key: 'custom' as const, label: '📝 사설 모의고사' },
          ]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                filter === f.key ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* 사설 모의고사 */}
        {filteredCustom.length > 0 && (
          <div className="mb-8">
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg mb-3 inline-block bg-purple-900/30 text-purple-400">
              📝 사설 모의고사
            </div>
            <div className="space-y-2">
              {filteredCustom.map(s => (
                <SessionRow key={s.id} s={s} expanded={expanded} setExpanded={setExpanded}
                  editing={editing} editForm={editForm} setEditForm={setEditForm}
                  saving={saving} handleEdit={handleEdit} handleSave={handleSave}
                  handleDelete={handleDelete} getDisplayName={getDisplayName}
                  scoreColor={scoreColor} getGroup={getGroup} deletable />
              ))}
            </div>
          </div>
        )}

        {/* 기출문제 2단 레이아웃 */}
        {filter !== 'custom' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽: 2016~2025 */}
            <div>
              <div className="text-sm font-bold text-gray-300 mb-3 pb-2 border-b border-gray-800">
                📅 2016~2025년 (10개년)
              </div>
              {PASS_RATE_GROUPS.map(group => {
                const rows = recentExam.filter(s =>
                  (s.pass_rate ?? 0) >= group.min && (s.pass_rate ?? 0) < group.max
                )
                if (rows.length === 0) return null
                return (
                  <div key={group.label} className="mb-4">
                    <div className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${group.bg} ${group.color}`}>
                      합격률 {group.label}
                    </div>
                    <div className="space-y-1.5">
                      {rows.map(s => (
                        <SessionRow key={s.id} s={s} expanded={expanded} setExpanded={setExpanded}
                          editing={editing} editForm={editForm} setEditForm={setEditForm}
                          saving={saving} handleEdit={handleEdit} handleSave={handleSave}
                          handleDelete={handleDelete} getDisplayName={getDisplayName}
                          scoreColor={scoreColor} getGroup={getGroup}
                          deletable={s.pass_rate !== null && s.pass_rate >= 30} />
                      ))}
                    </div>
                  </div>
                )
              })}
              {recentExam.length === 0 && <p className="text-gray-600 text-sm">해당 기록 없음</p>}
            </div>

            {/* 오른쪽: 2015년 이전 */}
            <div>
              <div className="text-sm font-bold text-gray-300 mb-3 pb-2 border-b border-gray-800">
                📅 2015년 이전
              </div>
              {PASS_RATE_GROUPS.map(group => {
                const rows = oldExam.filter(s =>
                  (s.pass_rate ?? 0) >= group.min && (s.pass_rate ?? 0) < group.max
                )
                if (rows.length === 0) return null
                return (
                  <div key={group.label} className="mb-4">
                    <div className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${group.bg} ${group.color}`}>
                      합격률 {group.label}
                    </div>
                    <div className="space-y-1.5">
                      {rows.map(s => (
                        <SessionRow key={s.id} s={s} expanded={expanded} setExpanded={setExpanded}
                          editing={editing} editForm={editForm} setEditForm={setEditForm}
                          saving={saving} handleEdit={handleEdit} handleSave={handleSave}
                          handleDelete={handleDelete} getDisplayName={getDisplayName}
                          scoreColor={scoreColor} getGroup={getGroup}
                          deletable={s.pass_rate !== null && s.pass_rate >= 30} />
                      ))}
                    </div>
                  </div>
                )
              })}
              {oldExam.length === 0 && <p className="text-gray-600 text-sm">해당 기록 없음</p>}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function SessionRow({ s, expanded, setExpanded, editing, editForm, setEditForm,
  saving, handleEdit, handleSave, handleDelete, getDisplayName, scoreColor, getGroup, deletable }: {
  s: ExamSession
  expanded: string | null
  setExpanded: (id: string | null) => void
  editing: string | null
  editForm: Partial<ExamSession>
  setEditForm: (f: Partial<ExamSession>) => void
  saving: boolean
  handleEdit: (s: ExamSession) => void
  handleSave: (id: string) => void
  handleDelete: (id: string) => void
  getDisplayName: (s: ExamSession) => string
  scoreColor: (score: number | null) => string
  getGroup: (rate: number | null) => typeof PASS_RATE_GROUPS[0]
  deletable: boolean
}) {
  const group = getGroup(s.pass_rate)
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800 transition"
        onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm whitespace-nowrap">{getDisplayName(s)}</span>
          {s.pass_rate !== null && (
            <span className={`text-xs font-semibold whitespace-nowrap ${group.color}`}>
              {s.pass_rate}%
            </span>
          )}
          {MEMO_FIELDS.some(f => s[f.key]) && (
            <span className="text-xs text-blue-400 whitespace-nowrap">
              📌{MEMO_FIELDS.filter(f => s[f.key]).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${scoreColor(s.my_score)}`}>
            {s.my_score !== null ? `${s.my_score}점` : '—'}
          </span>
          <span className="text-gray-600 text-xs">{expanded === s.id ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded === s.id && (
        <div className="border-t border-gray-800 p-4">
          {editing === s.id ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">내 점수 / 100</label>
                <input type="number" min="0" max="100"
                  className="bg-gray-800 rounded-lg px-3 py-2 text-white w-32"
                  value={editForm.my_score ?? ''}
                  onChange={e => setEditForm({ ...editForm, my_score: e.target.value ? Number(e.target.value) : null })}
                  placeholder="점수 입력" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MEMO_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                    <textarea
                      className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                      placeholder={`${f.label} 관련 취약 문항...`}
                      value={(editForm[f.key] as string) || ''}
                      onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Comments</label>
                <textarea
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-16 resize-none"
                  placeholder="전반적인 코멘트..."
                  value={(editForm.comments as string) || ''}
                  onChange={e => setEditForm({ ...editForm, comments: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleSave(s.id)} disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                  {saving ? '저장 중...' : '💾 저장'}
                </button>
                <button onClick={() => setEditForm({})}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {MEMO_FIELDS.some(f => s[f.key]) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {MEMO_FIELDS.filter(f => s[f.key]).map(f => (
                    <div key={f.key} className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-blue-400 mb-1 font-semibold">{f.label}</p>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{s[f.key]}</p>
                    </div>
                  ))}
                </div>
              )}
              {s.comments && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Comments</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{s.comments}</p>
                </div>
              )}
              {!MEMO_FIELDS.some(f => s[f.key]) && !s.comments && (
                <p className="text-gray-600 text-sm">메모 없음</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => handleEdit(s)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                  ✏️ 점수 · 메모 입력
                </button>
                {deletable && (
                  <button onClick={() => handleDelete(s.id)}
                    className="bg-red-900 hover:bg-red-800 px-4 py-2 rounded-lg text-sm transition">
                    🗑️ 삭제
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
