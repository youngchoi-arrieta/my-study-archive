'use client'

// 회차 상세 — /dashboard/gisulsa/[jong]/[exam]
// -------------------------------------------------------------------
// 교시별 문항 목록. 여기서 하는 일은 채점이 아니라 태깅이다.
// 문항 하나에 토픽 코드를 달면 서브노트 보드의 눈금이 하나 늘어난다.
//
// 새 회차를 넣는 동선
//   문제지 PDF를 옆에 띄우고 → 「+ 문항 추가」 → 요약 한 줄 + 토픽 선택.
//   요약은 나중에 검색으로 찾을 말이 들어가게 쓴다(정확한 문장일 필요 없음).

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import {
  GISULSA_MAP, SESSION_SPECS, type GisulsaSlug, type GisulsaQuestion,
} from '@/lib/constants-gisulsa'
import { TOPICS, TOPIC_GROUPS, GROUP_META, parseTag, tagLabel, tagTopic, makeTag } from '@/lib/constants-topics'
import {
  seedOf, loadDbQuestions, mergeQuestions, saveQuestion, loadPapers, savePaper, knownPoints,
} from '@/lib/gisulsaData'

interface Draft {
  session: number
  no: number
  points: number
  title: string
  topics: string[]
}

// 태그 고르기 — 대주제를 고른 뒤 논점까지 정한다.
// 논점은 미리 정한 목록이 아니라 기출에서 실제로 나온 것만 제안하고,
// 없으면 새로 쓴다. 대주제만 달고 논점을 비워도 된다.
function TagPicker({
  value, onChange, all,
}: { value: string[]; onChange: (v: string[]) => void; all: GisulsaQuestion[] }) {
  const [group, setGroup] = useState<string>(TOPIC_GROUPS[0])
  const [topicKey, setTopicKey] = useState<string | null>(null)
  const [point, setPoint] = useState('')

  const suggestions = topicKey ? knownPoints(all, topicKey) : []

  const add = (tag: string) => {
    if (!value.includes(tag)) onChange([...value, tag])
    setTopicKey(null); setPoint('')
  }
  const remove = (tag: string) => onChange(value.filter(t => t !== tag))

  return (
    <div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {value.map(tag => {
            const t = tagTopic(tag)
            const a = t ? GROUP_META[t.group].accent : '#374151'
            return (
              <button key={tag} type="button" onClick={() => remove(tag)}
                className="px-2 py-1 rounded text-[11px] font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: a }} title="눌러서 제거">
                {parseTag(tag).topic}
                {parseTag(tag).point && <span className="opacity-80"> / {parseTag(tag).point}</span>}
                <span className="ml-1.5 opacity-60">×</span>
              </button>
            )
          })}
        </div>
      )}

      {!topicKey ? (
        <>
          <div className="flex flex-wrap gap-1 mb-2">
            {TOPIC_GROUPS.map(g => (
              <button key={g} type="button" onClick={() => setGroup(g)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  group === g ? 'text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
                style={group === g ? { backgroundColor: GROUP_META[g].accent } : {}}>{g}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {TOPICS.filter(t => t.group === group).map(t => (
              <button key={t.key} type="button" onClick={() => setTopicKey(t.key)} title={t.name}
                className="px-2 py-1 rounded text-[11px] font-bold bg-gray-800 text-gray-400 hover:text-white transition">
                {t.key}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-gray-950 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px] font-bold">{topicKey}</span>
            <span className="text-gray-700 text-[11px]">›</span>
            <span className="text-[11px] text-gray-500">논점을 고르거나 새로 쓰세요</span>
            <button type="button" onClick={() => setTopicKey(null)}
              className="ml-auto text-[10px] text-gray-600 hover:text-gray-300 transition">대주제 다시 고르기</button>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {suggestions.map(sug => (
                <button key={sug} type="button" onClick={() => add(makeTag(topicKey, sug))}
                  className="px-2 py-1 rounded text-[11px] bg-gray-800 text-gray-300 hover:bg-gray-700 transition">
                  {sug}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input value={point} onChange={e => setPoint(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(makeTag(topicKey, point)) } }}
              placeholder="새 논점 (비우면 대주제만 단다)"
              className="flex-1 min-w-0 bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-lg px-2.5 py-1.5 text-[12px] outline-none transition placeholder:text-gray-700" />
            <button type="button" onClick={() => add(makeTag(topicKey, point))}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 text-white transition">
              달기
            </button>
          </div>
        </div>
      )}

      {value.length > 2 && (
        <p className="text-[10px] text-amber-500/80 mt-2">
          태그 3개 이상은 빈도표를 흐립니다. 주 1개 + 필요할 때만 부 1개를 권합니다.
        </p>
      )}
    </div>
  )
}

export default function ExamDetail() {
  const params = useParams()
  const jong = params.jong as GisulsaSlug
  const exam = Number(params.exam)
  const spec = GISULSA_MAP.get(jong)

  const [db, setDb] = useState<GisulsaQuestion[]>([])
  const [paperUrl, setPaperUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!spec) return
    setLoading(true)
    const [rows, papers] = await Promise.all([loadDbQuestions(jong), loadPapers(jong, [exam])])
    setDb(rows)
    setPaperUrl(papers.get(exam)?.questionUrl ?? null)
    setLoading(false)
  }, [spec, jong, exam])
  useEffect(() => { fetchAll() }, [fetchAll])

  // 논점 제안은 이 종목 전체 기출에서 뽑는다 (이 회차만으로는 표본이 없다)
  const allQuestions = useMemo(
    () => spec ? mergeQuestions(seedOf(jong), db.filter(q => q.jong === jong)) : [],
    [spec, jong, db])
  const questions = useMemo(
    () => allQuestions.filter(q => q.exam === exam), [allQuestions, exam])

  if (!spec || !exam) return notFound()

  const startDraft = (session: number) => {
    const used = questions.filter(q => q.session === session).map(q => q.no)
    let no = 1
    while (used.includes(no)) no++
    setDraft({
      session, no,
      points: SESSION_SPECS.find(s => s.session === session)?.points ?? 25,
      title: '', topics: [],
    })
  }

  const editDraft = (q: GisulsaQuestion) => {
    setDraft({ session: q.session, no: q.no, points: q.points, title: q.title, topics: q.topics })
  }

  const submit = async () => {
    if (!draft || !draft.title.trim() || busy) return
    setBusy(true)
    const err = await saveQuestion({
      jong, exam, session: draft.session, no: draft.no,
      points: draft.points, title: draft.title.trim(), topics: draft.topics,
    })
    setMsg(err ? `저장 실패 — ${err}` : '저장됨')
    setTimeout(() => setMsg(null), 2200)
    setDraft(null); setBusy(false)
    await fetchAll()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-2">
          <Link href={`/dashboard/gisulsa/${jong}`} className="text-gray-400 hover:text-white text-sm">
            ← {spec.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">제{exam}회</h1>
          <span className="text-sm text-gray-500">{spec.short}</span>
          {paperUrl && (
            <a href={paperUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] px-2 py-1 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-800/50 transition">
              📄 문제지 열기 ↗
            </a>
          )}
        </div>
        <p className="text-gray-500 text-sm mb-6">
          태깅된 문항 {questions.length}개 · 여기서 단 태그가 서브노트 보드의 눈금이 됩니다.
          {msg && <span className="ml-2 text-gray-400">{msg}</span>}
        </p>

        {!paperUrl && !loading && (
          <div className="bg-gray-900 rounded-xl p-3 mb-5">
            <PaperInput jong={jong} exam={exam} onSaved={fetchAll} />
          </div>
        )}

        {SESSION_SPECS.map(s => {
          const qs = questions.filter(q => q.session === s.session).sort((a, b) => a.no - b.no)
          return (
            <div key={s.session} className="mb-5">
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm font-bold">{s.session}교시</h2>
                <span className="text-[10px] text-gray-600">
                  {s.total}문 중 {s.pick}문 선택 · 각 {s.points}점 · {qs.length}문항 태깅됨
                </span>
              </div>
              <div className="bg-gray-900 rounded-2xl p-3 space-y-1">
                {qs.length === 0 && (
                  <p className="text-[11px] text-gray-600 px-1 py-2">아직 없습니다.</p>
                )}
                {qs.map(q => (
                  <div key={q.no} className="flex items-start gap-2.5 px-1 py-1.5 rounded-lg hover:bg-gray-950/60 transition">
                    <span className="shrink-0 w-10 text-[11px] font-mono text-gray-600 pt-0.5">{q.no}번</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-gray-200 leading-snug">{q.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {q.topics.map(c => {
                          const t = tagTopic(c)
                          const a = t ? GROUP_META[t.group].accent : '#9ca3af'
                          return (
                            <Link key={c} href={`/dashboard/gisulsa/subnote/${c.split('/').map(encodeURIComponent).join('/')}`}
                              className="text-[10px] px-1.5 py-0.5 rounded font-bold transition hover:brightness-125"
                              style={{ backgroundColor: `${a}35`, color: a }}>
                              {parseTag(c).topic}
                              {parseTag(c).point && <span className="opacity-75"> / {tagLabel(c)}</span>}
                            </Link>
                          )
                        })}
                        {q.topics.length === 0 && (
                          <span className="text-[10px] text-amber-500/70">태그 미지정</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => editDraft(q)}
                      className="shrink-0 text-[10px] text-gray-700 hover:text-gray-400 transition pt-0.5">
                      수정
                    </button>
                  </div>
                ))}
                <button onClick={() => startDraft(s.session)}
                  className="w-full mt-1 py-2 rounded-lg text-[11px] font-bold bg-gray-950 text-gray-600 hover:text-gray-300 transition">
                  + 문항 추가
                </button>
              </div>
            </div>
          )
        })}

        {/* 입력 모달 */}
        {draft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setDraft(null)}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <p className="text-sm font-bold mb-4">제{exam}회 {draft.session}교시 문항</p>

              <div className="flex gap-2 mb-3">
                <label className="flex-1">
                  <span className="block text-[10px] text-gray-600 mb-1">번호</span>
                  <input type="number" value={draft.no}
                    onChange={e => setDraft({ ...draft, no: Number(e.target.value) })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm outline-none" />
                </label>
                <label className="flex-1">
                  <span className="block text-[10px] text-gray-600 mb-1">배점</span>
                  <input type="number" value={draft.points}
                    onChange={e => setDraft({ ...draft, points: Number(e.target.value) })}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm outline-none" />
                </label>
              </div>

              <label className="block mb-4">
                <span className="block text-[10px] text-gray-600 mb-1">문제 요약 (나중에 검색으로 찾을 말이 들어가게)</span>
                <textarea value={draft.title} rows={2} autoFocus
                  onChange={e => setDraft({ ...draft, title: e.target.value })}
                  placeholder="예: 지중케이블 시스유기전압 저감대책과 크로스본드 유기전압 계산"
                  className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2.5 py-2 text-sm outline-none transition resize-none placeholder:text-gray-700" />
              </label>

              <p className="text-[10px] text-gray-600 mb-2">태그 · 대주제를 고른 뒤 논점까지 정합니다</p>
              <TagPicker value={draft.topics} onChange={v => setDraft({ ...draft, topics: v })} all={allQuestions} />

              <div className="flex gap-2 mt-5">
                <button onClick={submit} disabled={!draft.title.trim() || busy}
                  className="flex-1 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-40">
                  저장
                </button>
                <button onClick={() => setDraft(null)}
                  className="px-5 py-2 rounded-lg text-sm font-bold bg-gray-800 text-gray-400 hover:text-white transition">
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

function PaperInput({ jong, exam, onSaved }: { jong: GisulsaSlug; exam: number; onSaved: () => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!url.trim() || busy) return
    setBusy(true)
    await savePaper(jong, exam, 'question_url', url)
    setBusy(false); setUrl('')
    onSaved()
  }
  return (
    <div className="flex gap-1.5">
      <input value={url} onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="문제지 PDF URL을 붙여두면 태깅하면서 옆에 띄울 수 있습니다"
        className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2.5 py-1.5 text-[12px] outline-none transition placeholder:text-gray-700" />
      <button onClick={submit} disabled={busy}
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-800 hover:bg-gray-700 text-gray-300 transition disabled:opacity-40">
        저장
      </button>
    </div>
  )
}
