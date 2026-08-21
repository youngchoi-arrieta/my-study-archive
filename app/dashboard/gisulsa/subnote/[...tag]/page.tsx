'use client'

// 서브노트 한 장 — /dashboard/gisulsa/subnote/{대주제}/{논점}
// -------------------------------------------------------------------
// 단위는 대주제가 아니라 논점이다. '변압기'가 아니라 '변압기/병렬운전'.
// 라우트가 catch-all 인 이유도 태그에 '/' 가 들어가서다.
//
// 왼쪽에 기술사 기출, 오른쪽에 電験 기출을 나란히 두는 게 요점 — 같은 주제를
// 두 나라가 어떻게 다르게 묻는지 보면서 써야 한 장으로 양쪽이 커버된다.
// 電験 참조는 대주제 단위로 걸린다(일본어 키워드 매칭이 그 단위라서).
// 논점보다 넓게 잡히는 건 의도된 것 — 좁히면 아예 안 걸린다.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import DenkenMemoEditor from '@/app/components/DenkenMemoEditor'
import { TOPIC_MAP, GROUP_META, isKoreaOnly, parseTag, tagLabel } from '@/lib/constants-topics'
import { GISULSA_MAP } from '@/lib/constants-gisulsa'
import type { GisulsaQuestion } from '@/lib/constants-gisulsa'
import {
  allSeed, loadDbQuestions, mergeQuestions, loadDenkenRefs,
  loadSubnotes, saveSubnote, STATUS_META, type DenkenRef,
} from '@/lib/gisulsaData'

const TEMPLATE = `<h2>0. 정보 흐름</h2><p>무엇을 알면 무엇이 따라 나오는가 — 한 줄 사슬로.</p>
<h2>1. 원리 (공통)</h2><p></p>
<h2>2. 도식</h2><ul><li>등가회로</li><li>벡터도</li><li>특성곡선</li></ul>
<h2>3. 수식 유도</h2><p>시험장에서 손으로 다시 쓸 수 있는 최소 경로만.</p>
<h2>4. 기술사 출구</h2><p>1교시형 1페이지 / 논술형 3페이지 골격.</p>
<h2>5. 電験 출구</h2><p>계산 패턴 · 論説 지뢰 · 용어 대응표.</p>
<h2>6. 오답</h2><p></p>`

export default function SubnotePage() {
  const params = useParams()
  const raw = ((params.tag as string[]) ?? []).map(decodeURIComponent).join('/')
  const parsed = parseTag(raw)
  const topic = TOPIC_MAP.get(parsed.topic)

  const [kr, setKr] = useState<GisulsaQuestion[]>([])
  const [jp, setJp] = useState<DenkenRef[]>([])
  const [body, setBody] = useState('')
  const [status, setStatus] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!topic) return
    setLoading(true)
    const [db, refs, notes] = await Promise.all([
      loadDbQuestions(), loadDenkenRefs(), loadSubnotes(),
    ])
    const all = mergeQuestions(allSeed(), db)
    setKr(all.filter(q => q.topics.includes(raw)))
    setJp(refs.get(parsed.topic) ?? [])
    const n = notes.get(raw)
    setBody(n?.body ?? '')
    setStatus(n?.status ?? 0)
    setLoading(false)
  }, [topic, raw, parsed.topic])
  useEffect(() => { fetchAll() }, [fetchAll])

  if (!topic) return notFound()

  const accent = GROUP_META[topic.group].accent

  const persist = async (patch: { body?: string; status?: number }) => {
    const err = await saveSubnote(raw, patch)
    setSaved(err ? `저장 실패 — ${err}` : '저장됨')
    setTimeout(() => setSaved(null), 2000)
  }

  const krPoints = kr.reduce((a, q) => a + q.points, 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-2">
          <Link href="/dashboard/gisulsa/subnote" className="text-gray-400 hover:text-white text-sm">← 서브노트 보드</Link>
        </div>

        <p className="text-[11px] mb-1">
          <span style={{ color: accent }}>{topic.group}</span>
          <span className="text-gray-700 mx-1.5">›</span>
          <Link href="/dashboard/gisulsa/subnote" className="text-gray-500 hover:text-white transition">{topic.key}</Link>
        </p>
        <h1 className="text-2xl font-bold mb-1">{tagLabel(raw)}</h1>
        <p className="text-gray-500 text-sm mb-1">
          기술사 {kr.length}문 {krPoints}점 · 電験(대주제 기준) {jp.length}문
          {topic.jp.length > 0 && <span className="text-violet-400/80"> ({topic.jp.join(' · ')})</span>}
          {isKoreaOnly(topic) && <span className="text-amber-400/80"> · 한국 전용</span>}
        </p>
        {topic.note && <p className="text-[11px] text-gray-600 mb-4">💡 {topic.note}</p>}

        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          {STATUS_META.map((m, idx) => (
            <button key={idx} onClick={() => { setStatus(idx); persist({ status: idx }) }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                status === idx ? m.chip : 'bg-gray-900 text-gray-600 hover:text-gray-400'
              }`}>{m.label}</button>
          ))}
          {!body && (
            <button onClick={() => { setBody(TEMPLATE); persist({ body: TEMPLATE }) }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gray-900 text-gray-400 hover:text-white transition">
              📄 표준 양식 넣기
            </button>
          )}
          {saved && <span className="text-[11px] text-gray-500">{saved}</span>}
        </div>

        {/* 본문 */}
        <div className="bg-gray-900 rounded-2xl p-4 mb-6">
          {loading ? (
            <p className="text-gray-600 text-sm">불러오는 중...</p>
          ) : (
            <DenkenMemoEditor
              content={body}
              onChange={setBody}
              onBlur={() => persist({ body })}
              placeholder="원리 → 도식 → 유도 → 시험별 출구 순으로. 도식이 없는 서브노트는 미완성으로 친다."
            />
          )}
        </div>

        {/* 양쪽 기출 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-400 mb-3">🇰🇷 기술사 기출 · {kr.length}문항</p>
            {kr.length === 0 ? (
              <p className="text-[11px] text-gray-600">이 논점으로 태깅된 기술사 문항이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {kr.map(x => (
                  <div key={`${x.jong}-${x.exam}-${x.session}-${x.no}`} className="flex items-start gap-2.5">
                    <Link href={`/dashboard/gisulsa/${x.jong}/${x.exam}`}
                      className="shrink-0 w-24 text-[10px] font-mono text-gray-600 hover:text-blue-300 transition pt-0.5">
                      {x.exam}회 {x.session}-{x.no}
                      <span className="block text-gray-700">{x.points}점 · {GISULSA_MAP.get(x.jong)?.short}</span>
                    </Link>
                    <p className="text-[12px] text-gray-300 leading-snug min-w-0">{x.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs font-bold text-violet-400 mb-3">🇯🇵 電験 기출 · {jp.length}문항</p>
            {jp.length === 0 ? (
              <p className="text-[11px] text-gray-600 leading-relaxed">
                {topic.jp.length > 0
                  ? <>아직 안 붙었습니다. 대응 과목은 <b className="text-violet-400">{topic.jp.join(', ')}</b>.
                      덴켄 1·2종 풀이 화면에서 주제·키워드를 넣으면 자동으로 잡힙니다.</>
                  : '電験에 대응 개념이 없는 한국 전용 토픽입니다.'}
              </p>
            ) : (
              <div className="space-y-2">
                {jp.map((x, k) => (
                  <div key={k} className="flex items-start gap-2.5">
                    <Link href={`/dashboard/denken12/${x.examId}/${encodeURIComponent(x.subject)}`}
                      className="shrink-0 w-24 text-[10px] font-mono text-gray-600 hover:text-violet-300 transition pt-0.5">
                      {x.examId}
                      <span className="block text-gray-700">問{x.qNum}</span>
                    </Link>
                    <div className="min-w-0">
                      <p className="text-[12px] text-gray-300 leading-snug">
                        <span className="text-violet-400/80 mr-1.5">{x.subject}</span>{x.topic}
                      </p>
                      {x.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {x.keywords.map(kw => (
                            <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-300">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {topic.jpKeywords.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-800">
                <p className="text-[10px] text-gray-600 mb-1.5">매칭에 쓰는 일본어 단서</p>
                <div className="flex flex-wrap gap-1">
                  {topic.jpKeywords.map(k => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{k}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
