'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

type ExamSession = {
  id: string
  year: number
  session: number
  pass_rate: number
  my_score: number | null
  memo_electrical_design: string | null
  memo_substation: string | null
  memo_logic_sequence: string | null
  memo_lighting: string | null
  memo_kec: string | null
  memo_supervision: string | null
  comments: string | null
  updated_at: string
}

const PASS_RATE_GROUPS = [
  { label: '< 10%', min: 0, max: 10, color: 'text-red-400', bg: 'bg-red-900/30' },
  { label: '10~20%', min: 10, max: 20, color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  { label: '20~30%', min: 20, max: 30, color: 'text-blue-400', bg: 'bg-blue-900/30' },
]

const MEMO_FIELDS = [
  { key: 'memo_electrical_design', label: '전기설비설계' },
  { key: 'memo_substation', label: '수변전설비' },
  { key: 'memo_logic_sequence', label: '논리/시퀀스' },
  { key: 'memo_lighting', label: '조명설비' },
  { key: 'memo_kec', label: 'KEC' },
  { key: 'memo_supervision', label: '감리' },
] as const

export default function Dashboard() {
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ExamSession>>({})
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scored' | 'unscored'>('all')

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('exam_sessions')
      .select('*')
      .order('pass_rate', { ascending: true })
    setSessions(data || [])
    setLoading(false)
  }

  const handleEdit = (s: ExamSession) => {
    setEditing(s.id)
    setExpanded(s.id)
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
    await supabase.from('exam_sessions').update({
      ...editForm,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await fetchSessions()
    setEditing(null)
    setSaving(false)
  }

  const scored = sessions.filter(s => s.my_score !== null)
  const avgScore = scored.length > 0
    ? (scored.reduce((a, b) => a + (b.my_score || 0), 0) / scored.length).toFixed(1)
    : '-'

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500'
    if (score >= 60) return 'text-green-400'
    if (score >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const filtered = sessions.filter(s => {
    if (filter === 'scored') return s.my_score !== null
    if (filter === 'unscored') return s.my_score === null
    return true
  })

  const getGroup = (rate: number) =>
    PASS_RATE_GROUPS.find(g => rate >= g.min && rate < g.max) || PASS_RATE_GROUPS[2]

  if (loading) return <div className="min-h-screen bg-gray-950 text-white p-8">불러오는 중...</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">← 대시보드</Link>
        </div>
        <h1 className="text-3xl font-bold mb-1">⚡ 전기기사 실기 기출문제</h1>
        <p className="text-gray-500 text-sm mb-6">합격률 낮은 순 · 회차별 점수 및 영역별 메모 관리</p>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{scored.length}<span className="text-gray-500 text-base"> / {sessions.length}</span></p>
            <p className="text-gray-400 text-sm mt-1">풀이 완료</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{avgScore}</p>
            <p className="text-gray-400 text-sm mt-1">평균 점수</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {sessions.length > 0 ? Math.round(scored.length / sessions.length * 100) : 0}%
            </p>
            <p className="text-gray-400 text-sm mt-1">진행률</p>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="bg-gray-900 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>풀이 진행률</span>
            <span>{scored.length} / {sessions.length}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all"
              style={{ width: `${sessions.length > 0 ? scored.length / sessions.length * 100 : 0}%` }}
            />
          </div>
          {/* 그룹별 진행률 */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {PASS_RATE_GROUPS.map(g => {
              const groupSessions = sessions.filter(s => s.pass_rate >= g.min && s.pass_rate < g.max)
              const groupScored = groupSessions.filter(s => s.my_score !== null)
              return (
                <div key={g.label} className="text-center">
                  <p className={`text-xs font-semibold ${g.color}`}>{g.label}</p>
                  <p className="text-xs text-gray-400">{groupScored.length}/{groupSessions.length}</p>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                    <div className={`h-1.5 rounded-full ${g.color.replace('text-', 'bg-')}`}
                      style={{ width: `${groupSessions.length > 0 ? groupScored.length / groupSessions.length * 100 : 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-4">
          {(['all', 'scored', 'unscored'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                filter === f ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}>
              {f === 'all' ? '전체' : f === 'scored' ? '✅ 풀이완료' : '⬜ 미풀이'}
            </button>
          ))}
        </div>

        {/* 회차 목록 */}
        <div className="space-y-2">
          {PASS_RATE_GROUPS.map(group => {
            const groupRows = filtered.filter(s => s.pass_rate >= group.min && s.pass_rate < group.max)
            if (groupRows.length === 0) return null
            return (
              <div key={group.label}>
                <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg mb-2 inline-block ${group.bg} ${group.color}`}>
                  합격률 {group.label}
                </div>
                <div className="space-y-2 mb-4">
                  {groupRows.map(s => (
                    <div key={s.id} className="bg-gray-900 rounded-xl overflow-hidden">
                      {/* 헤더 행 */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800 transition"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-white whitespace-nowrap">{s.year}년 {s.session}회</span>
                          <span className={`text-base font-semibold whitespace-nowrap ${getGroup(s.pass_rate).color}`}>
                            합격률 {s.pass_rate}%
                          </span>
                          {MEMO_FIELDS.some(f => s[f.key]) && (
                            <span className="text-xs text-blue-400 whitespace-nowrap">
                              📌 {MEMO_FIELDS.filter(f => s[f.key]).length}개 메모
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-bold ${scoreColor(s.my_score)}`}>
                            {s.my_score !== null ? `${s.my_score}점` : '—'}
                          </span>
                          <span className="text-gray-600 text-sm">{expanded === s.id ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* 펼쳐진 상세 */}
                      {expanded === s.id && (
                        <div className="border-t border-gray-800 p-4">
                          {editing === s.id ? (
                            <div className="space-y-3">
                              {/* 점수 입력 */}
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">내 점수 / 100</label>
                                <input
                                  type="number" min="0" max="100"
                                  className="bg-gray-800 rounded-lg px-3 py-2 text-white w-32"
                                  value={editForm.my_score ?? ''}
                                  onChange={e => setEditForm({ ...editForm, my_score: e.target.value ? Number(e.target.value) : null })}
                                  placeholder="점수 입력"
                                />
                              </div>
                              {/* 영역별 메모 */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {MEMO_FIELDS.map(f => (
                                  <div key={f.key}>
                                    <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                                    <textarea
                                      className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                                      placeholder={`${f.label} 관련 취약 문항, 메모...`}
                                      value={(editForm[f.key] as string) || ''}
                                      onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                                    />
                                  </div>
                                ))}
                              </div>
                              {/* Comments */}
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">Comments</label>
                                <textarea
                                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-16 resize-none"
                                  placeholder="전반적인 코멘트..."
                                  value={(editForm.comments as string) || ''}
                                  onChange={e => setEditForm({ ...editForm, comments: e.target.value })}
                                />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleSave(s.id)} disabled={saving}
                                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                                  {saving ? '저장 중...' : '💾 저장'}
                                </button>
                                <button onClick={() => setEditing(null)}
                                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* 영역 메모 표시 */}
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
                              <button onClick={() => handleEdit(s)}
                                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                                ✏️ 점수 · 메모 입력
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
