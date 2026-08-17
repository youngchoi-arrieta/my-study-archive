'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ICHIJI_SUBJECTS, NIJI_SUBJECTS, SUBJECT_ACCENT,
  parseExamId, examLabel, wareki,
  type Denken12Grade,
} from '@/lib/constants-denken12'

// ───────────────────────────────────────────────────────────────
//  出題傾向 — 주제·키워드 한 페이지
//
//  1·2종은 출제 범위가 넓어서 三種처럼 미리 정한 태그로는 안 담긴다.
//  풀이 화면에서 자유 입력한 「주제」와 「키워드」를 여기 모아,
//  무엇이 반복되는지 / 어느 과목에 무엇이 몰리는지를 본다.
// ───────────────────────────────────────────────────────────────

interface Row {
  exam_id: string
  subject: string
  q_num: number
  topic: string | null
  keywords: string[] | null
}

const ALL_SUBJECTS = [...ICHIJI_SUBJECTS, ...NIJI_SUBJECTS] as string[]
const isNiji = (s: string) => (NIJI_SUBJECTS as string[]).includes(s)

type View = 'keyword' | 'topic'

export default function Denken12TopicsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('keyword')
  const [grade, setGrade] = useState<Denken12Grade | 'all'>('all')
  const [subjects, setSubjects] = useState<Set<string>>(new Set(ALL_SUBJECTS))
  const [q, setQ] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('denken12_answers')
      .select('exam_id, subject, q_num, topic, keywords')
      .order('exam_id', { ascending: false })
    setRows(((data as Row[]) ?? []).filter(r => r.topic || (r.keywords?.length)))
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = useMemo(() => rows.filter(r => {
    if (!subjects.has(r.subject)) return false
    if (grade !== 'all') {
      const p = parseExamId(r.exam_id)
      if (p?.grade !== grade) return false
    }
    if (q.trim()) {
      const n = q.trim().toLowerCase()
      const hay = `${r.topic ?? ''} ${(r.keywords ?? []).join(' ')}`.toLowerCase()
      if (!hay.includes(n)) return false
    }
    return true
  }), [rows, subjects, grade, q])

  /** 키워드 빈도 — 어느 과목·회차에서 나왔는지까지 */
  const keywordStats = useMemo(() => {
    const m = new Map<string, { count: number; subs: Set<string>; exams: Set<string> }>()
    filtered.forEach(r => (r.keywords ?? []).forEach(k => {
      const cur = m.get(k) ?? { count: 0, subs: new Set<string>(), exams: new Set<string>() }
      cur.count++; cur.subs.add(r.subject); cur.exams.add(r.exam_id)
      m.set(k, cur)
    }))
    return [...m.entries()]
      .map(([k, v]) => ({ kw: k, ...v }))
      .sort((a, b) => b.count - a.count || a.kw.localeCompare(b.kw))
  }, [filtered])

  /** 과목별 주제 목록 */
  const topicsBySubject = useMemo(() => {
    const m = new Map<string, Row[]>()
    filtered.filter(r => r.topic).forEach(r => {
      const arr = m.get(r.subject) ?? []
      arr.push(r); m.set(r.subject, arr)
    })
    m.forEach(arr => arr.sort((a, b) =>
      b.exam_id.localeCompare(a.exam_id) || a.q_num - b.q_num))
    return ALL_SUBJECTS.filter(s => m.has(s)).map(s => ({ subject: s, items: m.get(s)! }))
  }, [filtered])

  const toggleSubject = (s: string) => {
    const n = new Set(subjects)
    if (n.has(s)) n.delete(s); else n.add(s)
    setSubjects(n)
  }

  const maxCount = keywordStats[0]?.count ?? 1
  const totalKw = filtered.reduce((a, r) => a + (r.keywords?.length ?? 0), 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-2">
          <Link href="/dashboard/denken12" className="text-gray-400 hover:text-white text-sm">← 電験一種・二種</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🧭</span>
          <h1 className="text-2xl font-bold">出題傾向</h1>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          풀이 화면에서 넣은 주제·키워드를 모은 곳 · 문항 {filtered.length}개 · 키워드 {totalKw}개
        </p>

        {/* 필터 */}
        <div className="bg-gray-900 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-600 mr-1">종별</span>
            {([
              { key: 'all', label: '전체' },
              { key: 'first', label: '1種' },
              { key: 'second', label: '2種' },
            ] as const).map(g => (
              <button key={g.key} onClick={() => setGrade(g.key as Denken12Grade | 'all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  grade === g.key ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}>{g.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-600 mr-1">과목</span>
            {ALL_SUBJECTS.map(s => (
              <button key={s} onClick={() => toggleSubject(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  subjects.has(s) ? 'text-white' : 'bg-gray-800 text-gray-600'
                }`}
                style={subjects.has(s) ? { backgroundColor: SUBJECT_ACCENT[s as keyof typeof SUBJECT_ACCENT] } : {}}>
                {s}
              </button>
            ))}
          </div>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="주제·키워드 검색 (예: 過渡, 脱調, 逆フラッシオーバ)"
            className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700" />
        </div>

        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-4">
          {([
            { key: 'keyword', label: `🔑 키워드 ${keywordStats.length}` },
            { key: 'topic', label: '📚 과목별 주제' },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                view === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>{label}</button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-gray-500 text-sm mb-2">아직 넣은 주제·키워드가 없습니다.</p>
            <p className="text-gray-700 text-xs leading-relaxed">
              풀이 화면 오른쪽 메모 위의 「주제 / 키워드」 칸에 입력하면 여기 모입니다.
            </p>
          </div>
        ) : view === 'keyword' ? (
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="space-y-1.5">
              {keywordStats.map(k => (
                <div key={k.kw} className="flex items-center gap-3">
                  <button onClick={() => setQ(k.kw)}
                    className="w-40 shrink-0 text-left text-[12px] truncate hover:text-blue-300 transition"
                    title={k.kw}>
                    {k.kw}
                  </button>
                  <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${(k.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-[11px] font-bold text-violet-300 shrink-0">{k.count}</span>
                  <div className="w-40 shrink-0 flex flex-wrap gap-0.5 justify-end">
                    {[...k.subs].map(sb => (
                      <span key={sb} className="text-[9px] px-1 rounded font-bold"
                        style={{ backgroundColor: `${SUBJECT_ACCENT[sb as keyof typeof SUBJECT_ACCENT]}40`,
                          color: SUBJECT_ACCENT[sb as keyof typeof SUBJECT_ACCENT] }}>
                        {sb}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-700 mt-4 leading-relaxed">
              키워드를 누르면 검색창에 들어가 그 키워드가 나온 문항만 남습니다.
              같은 키워드가 여러 회차·과목에서 반복되면 그게 곧 빈출 논점입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {topicsBySubject.map(({ subject, items }) => (
              <div key={subject} className="bg-gray-900 rounded-2xl p-4">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: SUBJECT_ACCENT[subject as keyof typeof SUBJECT_ACCENT] }}>
                    {subject}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {isNiji(subject) ? '二次' : '一次'} · {items.length}문항
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map(r => {
                    const p = parseExamId(r.exam_id)
                    return (
                      <div key={`${r.exam_id}-${r.q_num}`} className="flex items-start gap-3">
                        <Link href={`/dashboard/denken12/${r.exam_id}/${encodeURIComponent(r.subject)}`}
                          className="shrink-0 w-32 text-[10px] text-gray-600 hover:text-blue-300 transition pt-0.5">
                          {examLabel(r.exam_id)}
                          <span className="text-gray-700"> 問{r.q_num}</span>
                          {p && <span className="block text-gray-800">{wareki(p.nendo)}</span>}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug">{r.topic}</p>
                          {(r.keywords?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.keywords!.map(k => (
                                <button key={k} onClick={() => setQ(k)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-300 hover:bg-violet-800/60 transition">
                                  {k}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
