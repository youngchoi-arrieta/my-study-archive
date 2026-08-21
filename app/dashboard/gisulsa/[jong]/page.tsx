'use client'

// 종목 허브 — /dashboard/gisulsa/[jong]
// -------------------------------------------------------------------
// 회차 목록 + 회차별 문제지 PDF + 이 종목의 토픽 분포.
// 건축전기·전기응용·전기안전은 시드가 비어 있어도 이 화면이 그대로 열린다.
// 회차 번호를 넣고 PDF 링크를 붙이는 것부터가 시작이고, 문항 태깅은
// 회차 상세에서 한다.

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import { PastPaperBar } from '@/app/components/PastPaperBar'
import {
  GISULSA_MAP, SESSION_SPECS, PICK_TOTAL, DROP_TOTAL,
  type GisulsaSlug, type GisulsaQuestion,
} from '@/lib/constants-gisulsa'
import { GROUP_META, TOPIC_MAP, TOPIC_GROUPS } from '@/lib/constants-topics'
import {
  seedOf, loadDbQuestions, mergeQuestions, loadPapers, savePaper,
  type ExamPaper,
} from '@/lib/gisulsaData'

export default function JongPage() {
  const params = useParams()
  const jong = params.jong as GisulsaSlug
  const spec = GISULSA_MAP.get(jong)

  const [db, setDb] = useState<GisulsaQuestion[]>([])
  const [papers, setPapers] = useState<Map<number, ExamPaper>>(new Map())
  const [loading, setLoading] = useState(true)
  const [newExam, setNewExam] = useState('')
  const [extraExams, setExtraExams] = useState<number[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [url, setUrl] = useState('')

  const questions = useMemo(
    () => spec ? mergeQuestions(seedOf(jong), db.filter(q => q.jong === jong)) : [],
    [spec, jong, db])

  const exams = useMemo(() => {
    const s = new Set<number>([...questions.map(q => q.exam), ...extraExams, ...papers.keys()])
    return [...s].sort((a, b) => b - a)
  }, [questions, extraExams, papers])

  const fetchAll = useCallback(async () => {
    if (!spec) return
    setLoading(true)
    const rows = await loadDbQuestions(jong)
    setDb(rows)
    const seedExams = [...new Set([...seedOf(jong), ...rows].map(q => q.exam))]
    // 시드에 없는 회차의 PDF도 잡히도록 넉넉한 범위로 조회
    const range: number[] = []
    for (let e = 120; e <= 150; e++) range.push(e)
    setPapers(await loadPapers(jong, [...new Set([...seedExams, ...range])]))
    setLoading(false)
  }, [spec, jong])
  useEffect(() => { fetchAll() }, [fetchAll])

  const topicDist = useMemo(() => {
    const m = new Map<string, number>()
    questions.forEach(q => q.topics.forEach(c => m.set(c, (m.get(c) ?? 0) + 1)))
    return [...m.entries()]
      .map(([code, n]) => ({ code, n, topic: TOPIC_MAP.get(code) }))
      .filter(x => x.topic)
      .sort((a, b) => b.n - a.n)
  }, [questions])

  const groupDist = useMemo(() => {
    const m = new Map<string, number>()
    topicDist.forEach(t => m.set(t.topic!.group, (m.get(t.topic!.group) ?? 0) + t.n))
    return TOPIC_GROUPS.filter(g => m.has(g)).map(g => ({ group: g, n: m.get(g)! }))
  }, [topicDist])

  const totalTags = topicDist.reduce((a, t) => a + t.n, 0)

  if (!spec) return notFound()

  const addExam = () => {
    const n = Number(newExam)
    if (!n || n < 1 || n > 999) return
    setExtraExams(p => [...new Set([...p, n])])
    setNewExam('')
  }

  const submitUrl = async (exam: number) => {
    await savePaper(jong, exam, 'question_url', url)
    setEditing(null); setUrl('')
    await fetchAll()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-2">
          <Link href="/dashboard/gisulsa" className="text-gray-400 hover:text-white text-sm">← 한국 기술사</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{spec.emoji}</span>
          <h1 className="text-2xl font-bold">{spec.name}</h1>
        </div>
        <p className="text-gray-500 text-sm mb-1 leading-relaxed">{spec.intro}</p>
        <p className="text-[11px] mb-5" style={{ color: spec.accent }}>{spec.seedNote}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          <Link href="/dashboard/gisulsa/subnote"
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600/80 hover:bg-blue-600 text-white transition">
            📐 서브노트 보드
          </Link>
          <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-900 text-gray-500">
            {exams.length}개 회차 · {questions.length}문항 · 태깅 {totalTags}건
          </span>
        </div>

        {/* 토픽 분포 */}
        {groupDist.length > 0 && (
          <>
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">📊 이 종목의 출제 분포</p>
            <div className="bg-gray-900 rounded-2xl p-4 mb-6">
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                {groupDist.map(g => (
                  <div key={g.group} title={`${g.group} ${g.n}문`}
                    style={{ width: `${(g.n / totalTags) * 100}%`, backgroundColor: GROUP_META[g.group].accent }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
                {groupDist.map(g => (
                  <span key={g.group} className="text-[10px] text-gray-500">
                    <i className="inline-block w-2 h-2 rounded-sm mr-1 align-middle"
                      style={{ backgroundColor: GROUP_META[g.group].accent }} />
                    {g.group} {g.n}
                  </span>
                ))}
              </div>
              <div className="space-y-1">
                {topicDist.slice(0, 12).map(t => (
                  <Link key={t.code} href={`/dashboard/gisulsa/subnote/${t.code}`}
                    className="flex items-center gap-3 group">
                    <span className="w-8 shrink-0 text-[10px] font-mono text-gray-600">{t.code}</span>
                    <span className="w-44 shrink-0 text-[11px] text-gray-400 group-hover:text-white truncate transition">
                      {t.topic!.name}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${(t.n / topicDist[0].n) * 100}%`, backgroundColor: GROUP_META[t.topic!.group].accent }} />
                    </div>
                    <span className="w-6 text-right text-[10px] font-bold text-gray-500 tabular-nums">{t.n}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 회차 */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">🗂 회차</p>
          <div className="flex gap-1.5">
            <input value={newExam} onChange={e => setNewExam(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addExam() }}
              placeholder="회차 (예: 140)" inputMode="numeric"
              className="w-28 bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-lg px-2.5 py-1.5 text-[12px] outline-none transition placeholder:text-gray-700" />
            <button onClick={addExam}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
              추가
            </button>
          </div>
        </div>

        {exams.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-8 text-center mb-6">
            <p className="text-gray-500 text-sm mb-2">아직 회차가 없습니다.</p>
            <p className="text-gray-700 text-xs leading-relaxed">
              위에 회차 번호를 넣어 자리를 만들고, 문제지 PDF 링크를 붙인 뒤<br />
              회차 상세에서 문항을 하나씩 태깅하면 서브노트 보드에 바로 반영됩니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {exams.map(e => {
              const qs = questions.filter(q => q.exam === e)
              const p = papers.get(e)
              return (
                <div key={e} className="bg-gray-900 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Link href={`/dashboard/gisulsa/${jong}/${e}`}
                      className="text-[13px] font-bold hover:text-blue-300 transition">
                      제{e}회
                    </Link>
                    <span className="text-[10px] text-gray-600">
                      {qs.length > 0 ? `${qs.length}/${PICK_TOTAL + DROP_TOTAL}문항` : '미입력'}
                    </span>
                    {p?.questionUrl && (
                      <a href={p.questionUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 hover:bg-blue-800/50 transition">
                        📄 문제지
                      </a>
                    )}
                  </div>
                  {editing === e ? (
                    <div className="flex gap-1.5">
                      <input autoFocus value={url} onChange={ev => setUrl(ev.target.value)}
                        onKeyDown={ev => { if (ev.key === 'Enter') submitUrl(e); if (ev.key === 'Escape') setEditing(null) }}
                        placeholder="문제지 PDF URL (구글 드라이브 등)"
                        className="flex-1 min-w-0 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1 text-[11px] outline-none placeholder:text-gray-700" />
                      <button onClick={() => submitUrl(e)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-600 text-white">저장</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditing(e); setUrl(p?.questionUrl ?? '') }}
                      className="text-[10px] text-gray-600 hover:text-gray-400 transition">
                      {p?.questionUrl ? 'PDF 링크 수정' : '+ PDF 링크 붙이기'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 공식 배포처 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">📥 기출 받는 곳</p>
        <div className="mb-6">
          <PastPaperBar links={spec.pastPapers} accent={spec.accent} />
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4">
          <p className="text-[10px] text-gray-600 leading-relaxed">
            교시 구조는 전 종목 공통 — {SESSION_SPECS[0].total}문 중 {SESSION_SPECS[0].pick}문(1교시),
            이후 각 {SESSION_SPECS[1].total}문 중 {SESSION_SPECS[1].pick}문.
            총 {PICK_TOTAL + DROP_TOTAL}문 중 {DROP_TOTAL}문을 버릴 수 있으므로,
            토픽 커버리지 100%가 아니라 75~80%가 현실적인 목표다.
          </p>
        </div>

        {loading && <p className="text-[10px] text-gray-700 mt-4">불러오는 중...</p>}
      </div>
    </main>
  )
}
