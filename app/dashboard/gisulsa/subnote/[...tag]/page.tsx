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
import { QuestionCard } from '@/app/dashboard/gisulsa/_components/QuestionCard'
import { TOPIC_MAP, GROUP_META, isKoreaOnly, parseTag, tagLabel } from '@/lib/constants-topics'
import { type GisulsaSlug } from '@/lib/constants-gisulsa'
import type { GisulsaQuestion } from '@/lib/constants-gisulsa'
import {
  allSeed, loadDbQuestions, mergeQuestions, loadDenkenRefs,
  loadSubnotes, saveSubnote, loadPapers, STATUS_META, type DenkenRef,
} from '@/lib/gisulsaData'

// 구글 드라이브 공유링크를 미리보기용 embed 주소로 바꾼다.
// (.../file/d/{id}/view  →  .../file/d/{id}/preview)
function embedUrl(url: string): string | null {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  if (/\.pdf($|\?)/i.test(url)) return url
  return null
}

export default function SubnotePage() {
  const params = useParams()
  const raw = ((params.tag as string[]) ?? []).map(decodeURIComponent).join('/')
  const parsed = parseTag(raw)
  const topic = TOPIC_MAP.get(parsed.topic)

  const [kr, setKr] = useState<GisulsaQuestion[]>([])
  const [jp, setJp] = useState<DenkenRef[]>([])
  const [pdf, setPdf] = useState('')
  const [papers, setPapers] = useState<Map<number, string | null>>(new Map())
  const [editing, setEditing] = useState(false)
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
    const mine = all.filter(q => q.topics.includes(raw))
    setKr(mine)

    // 이 논점에 걸린 회차의 문제지 PDF 만 가져온다 (그림 문항용 링크)
    const byJong = new Map<string, number[]>()
    mine.forEach(q => byJong.set(q.jong, [...(byJong.get(q.jong) ?? []), q.exam]))
    const pm = new Map<number, string | null>()
    await Promise.all([...byJong.entries()].map(async ([jong, exams]) => {
      const got = await loadPapers(jong as GisulsaSlug, [...new Set(exams)])
      got.forEach((v, k) => pm.set(k, v.questionUrl))
    }))
    setPapers(pm)
    setJp(refs.get(parsed.topic) ?? [])
    const n = notes.get(raw)
    setPdf(n?.pdf_url ?? '')
    setStatus(n?.status ?? 0)
    setLoading(false)
  }, [topic, raw, parsed.topic])
  useEffect(() => { fetchAll() }, [fetchAll])

  if (!topic) return notFound()

  const accent = GROUP_META[topic.group].accent

  const persist = async (patch: { pdf_url?: string | null; status?: number }) => {
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
          {saved && <span className="text-[11px] text-gray-500">{saved}</span>}
        </div>

        {/* 서브노트 PDF — 본문은 Overleaf 로 쓰고 링크만 건다 */}
        <div className="bg-gray-900 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-bold text-gray-300">📄 서브노트 PDF</p>
            {pdf && !editing && (
              <div className="flex gap-1.5">
                <a href={pdf} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-2 py-1 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-800/50 transition">
                  새 탭에서 열기 ↗
                </a>
                <button onClick={() => setEditing(true)}
                  className="text-[11px] px-2 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition">
                  링크 수정
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-gray-600 text-sm">불러오는 중...</p>
          ) : !pdf || editing ? (
            <>
              <div className="flex gap-1.5">
                <input value={pdf} onChange={e => setPdf(e.target.value)} autoFocus={editing}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { persist({ pdf_url: pdf.trim() || null }); setEditing(false) }
                    if (e.key === 'Escape') setEditing(false)
                  }}
                  placeholder="구글 드라이브 공유 링크를 붙여넣으세요"
                  className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700" />
                <button onClick={() => { persist({ pdf_url: pdf.trim() || null }); setEditing(false) }}
                  className="px-4 py-2 rounded-lg text-[12px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition">
                  저장
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                본문은 Overleaf 에서 쓰고 PDF 만 드라이브에 올린 뒤 링크를 겁니다.
                드라이브 링크는 <span className="text-gray-500">공유 → 링크가 있는 모든 사용자</span> 로 두면 아래에 바로 미리보기가 뜹니다.
              </p>
            </>
          ) : embedUrl(pdf) ? (
            <iframe src={embedUrl(pdf)!} className="w-full h-[70vh] rounded-lg bg-gray-950" allow="autoplay" />
          ) : (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              미리보기를 지원하지 않는 주소입니다. 위 「새 탭에서 열기」로 확인하세요.
              구글 드라이브라면 <span className="text-gray-400">파일 → 공유 → 링크 복사</span> 로 받은 주소를 쓰면 여기 바로 뜹니다.
            </p>
          )}
        </div>

        {/* 양쪽 기출 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-400 mb-3">🇰🇷 기술사 기출 · {kr.length}문항</p>
            {kr.length === 0 ? (
              <p className="text-[11px] text-gray-600">이 논점으로 태깅된 기술사 문항이 없습니다.</p>
            ) : (
              <>
                <p className="text-[10px] text-gray-600 mb-2">문항을 누르면 문제 전문이 펼쳐집니다.</p>
                <div className="space-y-0.5">
                  {kr.map(x => (
                    <QuestionCard key={`${x.jong}-${x.exam}-${x.session}-${x.no}`}
                      q={x} paperUrl={papers.get(x.exam) ?? null} />
                  ))}
                </div>
              </>
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
