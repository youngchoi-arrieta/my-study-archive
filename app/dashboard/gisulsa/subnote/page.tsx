'use client'

// 서브노트 우선순위 보드 — /dashboard/gisulsa/subnote
// -------------------------------------------------------------------
// 이 화면의 주장: 서브노트는 시험별로 쓰는 게 아니라 토픽별로 한 장 쓴다.
//
// 가운데 축을 기준으로 왼쪽 눈금은 한국 기술사 출제, 오른쪽은 電験 출제다.
// 눈금 하나가 문항 하나고, 기술사 쪽은 25점 논술이 밝은 파랑이다.
// 양쪽으로 뻗은 토픽일수록 한 장의 수익률이 높다 — 그게 정렬 기준이다.
//
// 겹치지 않는 구간을 감추지 않는 게 중요하다.
//   한국 전용(I1 연계기술기준 등)은 배점이 높은데 電験과 접점이 0이고,
//   電験 전용(B4 직류기 등)은 기술사 출제가 0이다. 섞으면 양쪽 다 흐려지므로
//   필터로 갈라 본다.

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  TOPIC_GROUPS, GROUP_META, isKoreaOnly, type TopicGroup,
} from '@/lib/constants-topics'
import { GISULSA_MAP } from '@/lib/constants-gisulsa'
import {
  allSeed, loadDbQuestions, mergeQuestions, loadDenkenRefs,
  loadSubnotes, saveSubnote, buildBoard, STATUS_META,
  type BoardRow, type DenkenRef,
} from '@/lib/gisulsaData'
import type { GisulsaQuestion } from '@/lib/constants-gisulsa'

type Sort = 'combined' | 'kr' | 'krN' | 'jp' | 'code'
type Overlap = '' | 'both' | 'kronly' | 'jponly'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'combined', label: '통합 우선도' },
  { key: 'kr',       label: '기술사 배점' },
  { key: 'krN',      label: '기술사 출제수' },
  { key: 'jp',       label: '電験 출제수' },
  { key: 'code',     label: '가나다순' },
]

/** 눈금 하나 = 문항 하나. 막대가 아니라 세는 단위를 그대로 그린다 */
function Ticks({ row, side }: { row: BoardRow; side: 'kr' | 'jp' }) {
  if (side === 'kr') {
    if (!row.krCount) return <div className="h-4" />
    return (
      <div className="flex gap-[2px] justify-end h-4 items-stretch">
        {row.questions.slice(0, 40).map((q, i) => (
          <i key={i} title={`${GISULSA_MAP.get(q.jong)?.short ?? q.jong} ${q.exam}회 ${q.session}-${q.no} · ${q.points}점`}
            className="w-[7px] rounded-[1.5px]"
            style={{ backgroundColor: q.points >= 25 ? '#60a5fa' : '#2563eb' }} />
        ))}
      </div>
    )
  }
  if (!row.jpCount) {
    return (
      <div className="h-4 flex items-center">
        {row.topic.jp.length > 0 && (
          <span className="text-[10px] text-gray-700">{row.topic.jp.join('·')} 예상</span>
        )}
      </div>
    )
  }
  return (
    <div className="flex gap-[2px] h-4 items-stretch">
      {row.jpRefs.slice(0, 40).map((r, i) => (
        <i key={i} title={`${r.examId} ${r.subject} 問${r.qNum}${r.matched === 'guess' ? ' (키워드 추정)' : ''}`}
          className="w-[7px] rounded-[1.5px]"
          style={{ backgroundColor: r.matched === 'code' ? '#a78bfa' : '#6d5aa8' }} />
      ))}
    </div>
  )
}

export default function SubnoteBoard() {
  const [questions, setQuestions] = useState<GisulsaQuestion[]>([])
  const [refs, setRefs] = useState<Map<string, DenkenRef[]>>(new Map())
  const [status, setStatus] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<Sort>('combined')
  const [group, setGroup] = useState<TopicGroup | ''>('')
  const [overlap, setOverlap] = useState<Overlap>('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [db, r, notes] = await Promise.all([
      loadDbQuestions(), loadDenkenRefs(), loadSubnotes(),
    ])
    const st: Record<string, number> = {}
    notes.forEach((v, k) => { st[k] = v.status })
    setQuestions(mergeQuestions(allSeed(), db))
    setRefs(r)
    setStatus(st)
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const rows = useMemo(
    () => buildBoard(questions, refs, status),
    [questions, refs, status])

  // 상태는 논점(태그) 단위로 저장한다. 대주제 상태는 거기서 파생된다.
  const setTagStatus = async (tag: string, s: number) => {
    if (busy) return
    setBusy(true)
    setStatus(prev => ({ ...prev, [tag]: s }))
    await saveSubnote(tag, { status: s })
    setBusy(false)
  }

  const filtered = useMemo(() => {
    const out = rows.filter(r => {
      if (group && r.topic.group !== group) return false
      if (overlap === 'both'   && !(r.krCount > 0 && r.topic.jp.length > 0)) return false
      if (overlap === 'kronly' && !isKoreaOnly(r.topic)) return false
      if (overlap === 'jponly' && r.krCount > 0) return false
      if (q.trim()) {
        const n = q.trim().toLowerCase()
        const hay = [
          r.topic.key, r.topic.name, r.topic.group, r.topic.note ?? '',
          ...r.questions.map(x => x.title),
          ...r.jpRefs.map(x => `${x.topic ?? ''} ${x.keywords.join(' ')}`),
        ].join(' ').toLowerCase()
        if (!hay.includes(n)) return false
      }
      return true
    })
    const by: Record<Sort, (a: BoardRow, b: BoardRow) => number> = {
      combined: (a, b) => b.score - a.score,
      kr:       (a, b) => b.krPoints - a.krPoints,
      krN:      (a, b) => b.krCount - a.krCount,
      jp:       (a, b) => b.jpCount - a.jpCount,
      code:     (a, b) => a.topic.key.localeCompare(b.topic.key),
    }
    return [...out].sort(by[sort])
  }, [rows, group, overlap, q, sort])

  const doneRows = rows.filter(r => r.status === 2)
  const donePts = doneRows.reduce((a, r) => a + r.krPoints, 0)
  const allPts = Math.max(1, rows.reduce((a, r) => a + r.krPoints, 0))
  const jpTotal = rows.reduce((a, r) => a + r.jpCount, 0)
  const guessed = rows.reduce((a, r) => a + r.jpRefs.filter(x => x.matched === 'guess').length, 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8 pb-24">
      <div className="max-w-5xl mx-auto">

        <div className="mb-2">
          <Link href="/dashboard/gisulsa" className="text-gray-400 hover:text-white text-sm">← 한국 기술사</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📐</span>
          <h1 className="text-2xl font-bold">서브노트 우선순위 보드</h1>
        </div>
        <p className="text-gray-500 text-sm mb-4 leading-relaxed">
          행은 <b className="text-gray-300">대주제</b>고, 펼치면 그 안의 <b className="text-gray-300">논점</b>이 나온다.
          서브노트 한 장은 대주제가 아니라 논점 단위로 쓴다 — 변압기 25문항은 시험·정수, 병렬운전,
          결선·각변위… 로 갈리지 한 장이 아니다.<br />
          가운데를 기준으로 <span className="text-blue-400 font-semibold">왼쪽 눈금은 기술사</span>,
          <span className="text-violet-400 font-semibold"> 오른쪽은 電験</span> 출제.
        </p>

        <div className="flex flex-wrap gap-3 text-[11px] mb-4">
          <span className="text-gray-600"><i className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: '#2563eb' }} />기술사 10점</span>
          <span className="text-gray-600"><i className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: '#60a5fa' }} />기술사 25점</span>
          <span className="text-gray-600"><i className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: '#a78bfa' }} />電験 (코드 태깅)</span>
          <span className="text-gray-600"><i className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: '#6d5aa8' }} />電験 (키워드 추정)</span>
        </div>

        {/* 필터 */}
        <div className="bg-gray-900 rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-600 mr-1">정렬</span>
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSort(s.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  sort === s.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}>{s.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-600 mr-1">범위</span>
            {([
              { key: '', label: '전체' },
              { key: 'both', label: '양쪽 출제' },
              { key: 'kronly', label: '한국 전용' },
              { key: 'jponly', label: '電験 전용' },
            ] as const).map(o => (
              <button key={o.key} onClick={() => setOverlap(o.key as Overlap)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  overlap === o.key ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}>{o.label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-600 mr-1">분류</span>
            <button onClick={() => setGroup('')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                group === '' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}>전체</button>
            {TOPIC_GROUPS.map(g => (
              <button key={g} onClick={() => setGroup(group === g ? '' : g)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                  group === g ? 'text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                }`}
                style={group === g ? { backgroundColor: GROUP_META[g].accent } : {}}>{g}</button>
            ))}
          </div>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="토픽·문제·일본어 키워드 검색 (예: 시스유기전압, シース, 조상설비)"
            className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700" />
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-gray-500 text-sm mb-1">조건에 맞는 토픽이 없습니다.</p>
            <p className="text-gray-700 text-xs">필터를 넓히거나 검색어를 지워 보세요.</p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-3 md:p-4 space-y-1">
            {filtered.map((r, i) => {
              const isOpen = open === r.topic.key
              const st = STATUS_META[r.status] ?? STATUS_META[0]
              return (
                <div key={r.topic.key}
                  className={`rounded-xl transition ${isOpen ? 'bg-gray-950' : 'hover:bg-gray-950/60'}`}>
                  <button onClick={() => setOpen(isOpen ? null : r.topic.key)}
                    className="w-full grid grid-cols-1 md:grid-cols-[1fr_290px_1fr] gap-2 md:gap-3 items-center px-2 py-2 text-left">
                    <div className="hidden md:block"><Ticks row={r} side="kr" /></div>
                    <div className="min-w-0 md:text-center">
                      <p className="text-[10px] text-gray-600">
                        {sort !== 'code' && <span className="font-mono">{String(i + 1).padStart(2, '0')} · </span>}
                        <span style={{ color: GROUP_META[r.topic.group].accent }}>{r.topic.group}</span>
                        {r.topic.jp.length > 0 && <span className="text-gray-700"> · {r.topic.jp.join('·')}</span>}
                      </p>
                      <p className={`text-[13px] font-semibold truncate ${r.status === 2 ? 'text-green-400' : ''}`}>
                        <i className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-middle"
                          style={{ backgroundColor: st.dot }} />
                        {r.topic.name}
                        {isKoreaOnly(r.topic) && <span className="ml-1.5 text-[9px] px-1 rounded bg-amber-900/40 text-amber-400 font-normal">한국 전용</span>}
                        {r.krCount === 0 && r.topic.jp.length > 0 && <span className="ml-1.5 text-[9px] px-1 rounded bg-violet-900/40 text-violet-400 font-normal">電験 전용</span>}
                      </p>
                      <p className="text-[10px] text-gray-600 font-mono tabular-nums">
                        기술사 {r.krCount}문 {r.krPoints}점 · 電験 {r.jpCount}문
                        {r.points_.length > 1 && <span className="text-gray-500"> · 논점 {r.points_.length}</span>}
                      </p>
                    </div>
                    <div className="md:block"><Ticks row={r} side="jp" /></div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-l-2 ml-2" style={{ borderColor: GROUP_META[r.topic.group].accent }}>
                      {r.topic.note && (
                        <p className="text-[11px] text-gray-500 mb-3">💡 {r.topic.note}</p>
                      )}

                      {/* 논점 — 서브노트를 실제로 쓰는 단위 */}
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">
                        논점 {r.points_.length}개 · 서브노트 {r.points_.length}장
                      </p>
                      <div className="space-y-1 mb-4">
                        {r.points_.map(pt => (
                          <div key={pt.tag} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-gray-900/70">
                            <i className="shrink-0 w-[7px] h-[7px] rounded-full"
                              style={{ backgroundColor: (STATUS_META[pt.status] ?? STATUS_META[0]).dot }} />
                            <Link href={`/dashboard/gisulsa/subnote/${pt.tag.split('/').map(encodeURIComponent).join('/')}`}
                              className="min-w-0 flex-1 text-[12.5px] font-semibold hover:text-blue-300 transition truncate">
                              {pt.label}
                            </Link>
                            <span className="shrink-0 text-[10px] font-mono text-gray-600 tabular-nums">
                              {pt.count}문 {pt.points}점
                            </span>
                            <div className="shrink-0 flex gap-0.5">
                              {STATUS_META.map((m, idx) => (
                                <button key={idx} onClick={() => setTagStatus(pt.tag, idx)} disabled={busy}
                                  title={m.label}
                                  className={`w-6 h-6 rounded-md text-[10px] font-bold transition disabled:opacity-50 ${
                                    pt.status === idx ? m.chip : 'bg-gray-800 text-gray-700 hover:text-gray-400'
                                  }`}>{['·', '△', '✓'][idx]}</button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {r.points_.length === 0 && (
                          <p className="text-[11px] text-gray-600 px-1">아직 이 대주제로 태깅된 문항이 없습니다.</p>
                        )}
                      </div>

                      {r.krCount > 0 && (
                        <details className="mb-4">
                          <summary className="text-[10px] text-gray-600 uppercase tracking-widest font-bold cursor-pointer hover:text-gray-400 transition">
                            기술사 기출 {r.krCount}문항 {r.krPoints}점
                            {Object.keys(r.byJong).length > 1 && (
                              <span className="ml-2 font-normal normal-case tracking-normal">
                                ({Object.entries(r.byJong).map(([j, n]) => `${GISULSA_MAP.get(j)?.short ?? j} ${n}`).join(' · ')})
                              </span>
                            )}
                          </summary>
                          <div className="space-y-1 mt-2">
                            {r.questions.map(x => (
                              <div key={`${x.jong}-${x.exam}-${x.session}-${x.no}`} className="flex items-start gap-2.5">
                                <Link href={`/dashboard/gisulsa/${x.jong}/${x.exam}`}
                                  className="shrink-0 w-28 text-[10px] font-mono text-gray-600 hover:text-blue-300 transition pt-0.5">
                                  {x.exam}회 {x.session}-{x.no} · {x.points}점
                                </Link>
                                <p className="text-[12px] text-gray-300 leading-snug min-w-0">{x.title}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {r.jpCount > 0 ? (
                        <>
                          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">
                            電験 · {r.jpCount}문항
                          </p>
                          <div className="space-y-1">
                            {r.jpRefs.slice(0, 20).map((x, k) => (
                              <div key={k} className="flex items-start gap-2.5">
                                <Link href={`/dashboard/denken12/${x.examId}/${encodeURIComponent(x.subject)}`}
                                  className="shrink-0 w-28 text-[10px] font-mono text-gray-600 hover:text-violet-300 transition pt-0.5">
                                  {x.examId} 問{x.qNum}
                                </Link>
                                <div className="min-w-0">
                                  <p className="text-[12px] text-gray-300 leading-snug">
                                    <span className="text-violet-400/80 mr-1.5">{x.subject}</span>
                                    {x.topic ?? x.keywords.join(', ')}
                                    {x.matched === 'guess' && <span className="ml-1.5 text-[9px] text-gray-700">키워드 추정</span>}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : r.topic.jp.length > 0 ? (
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          電験 기출이 아직 안 붙었습니다. 대응 과목은 <b className="text-violet-400">{r.topic.jp.join(', ')}</b>.
                          덴켄 1·2종 풀이 화면에서 주제·키워드를 넣으면 여기 자동으로 잡힙니다.
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                          電験에 대응 개념이 없는 한국 전용 토픽입니다. 기술사 전용 트랙으로 따로 시간을 떼는 게 낫습니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 진행 */}
        {!loading && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 px-6 py-3">
            <div className="max-w-5xl mx-auto">
              <p className="text-[11px] text-gray-500">
                서브노트 완료 <b className="text-green-400">{doneRows.length}</b>/{rows.length}개 토픽 ·
                기술사 배점 기준 <b className="text-gray-300">{Math.round(donePts / allPts * 100)}%</b> 커버 ({donePts}/{allPts}점)
                {jpTotal > 0 && <span className="text-gray-700"> · 電験 참조 {jpTotal}문항 중 {guessed}건은 키워드 추정</span>}
              </p>
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(donePts / allPts) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
