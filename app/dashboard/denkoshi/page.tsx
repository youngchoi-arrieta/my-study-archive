'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DenkoshiChart, type ChartItem } from './DenkoshiChart'

// ── 기출 메타데이터 ──────────────────────────────────────────────
const PAST_EXAMS = [
  { id: '20250525', label: '2025 상기', year: 2025, term: '상' as const },
  { id: '20251026', label: '2025 하기', year: 2025, term: '하' as const },
  { id: '20240526', label: '2024 상기', year: 2024, term: '상' as const },
  { id: '20241027', label: '2024 하기', year: 2024, term: '하' as const },
  { id: '20230528', label: '2023 상기', year: 2023, term: '상' as const },
  { id: '20231029', label: '2023 하기', year: 2023, term: '하' as const },
  { id: '20220529', label: '2022 상기', year: 2022, term: '상' as const },
  { id: '20221030', label: '2022 하기', year: 2022, term: '하' as const },
  { id: '20210530', label: '2021 상기', year: 2021, term: '상' as const },
  { id: '20211024', label: '2021 하기', year: 2021, term: '하' as const },
]
const YEARS = [2025, 2024, 2023, 2022, 2021]

// ── 출제경향 분석 데이터 ─────────────────────────────────────────
const PERIODS = ['22상','22하','23상','23하','24상','24하','25상','25하']
const TOPIC_MATRIX: { area: string; color: string; topics: [string, number[], number][] }[] = [
  { area: 'A 전기이론', color: '#378ADD', topics: [
    ['합성저항 계산',      [0,0,0,0,0,1,1,1], 3],
    ['전력·전력량 계산',   [0,1,1,0,0,1,0,1], 4],
    ['전압강하/전력손실',  [1,1,1,1,0,0,1,0], 4],
    ['전동기 력률',        [0,0,0,0,1,1,1,0], 3],
    ['기타 회로이론',      [1,1,1,1,1,1,1,1], 8],
  ]},
  { area: 'B 배선재료·기자재', color: '#1D9E75', topics: [
    ['사진 식별 — 재료',   [1,1,1,1,0,1,1,1], 7],
    ['사진 식별 — 기구',   [0,1,1,0,1,1,1,1], 6],
    ['사진 식별 — 공구',   [0,0,1,1,1,1,1,1], 6],
    ['최고 허용 온도',     [1,1,1,0,1,1,0,1], 6],
    ['분기회로 설계',      [0,1,1,1,1,1,1,1], 7],
  ]},
  { area: 'C 공사방법', color: '#D85A30', topics: [
    ['부적절 공사방법',    [1,1,0,0,1,1,1,0], 5],
    ['스타델타 기동',      [0,0,1,1,1,0,1,1], 5],
    ['전선 접속 부적절',   [1,1,1,0,0,0,1,0], 4],
    ['태양광·특수장소',    [0,1,1,0,0,0,1,1], 4],
  ]},
  { area: 'D 접지·측정·검사', color: '#D4537E', topics: [
    ['측정기·회로계',      [0,1,1,0,1,1,1,1], 6],
    ['D종 접지 생략',      [1,0,0,1,0,1,0,1], 4],
    ['접지저항 측정법',    [0,1,0,0,0,0,0,1], 2],
  ]},
  { area: 'E 법령', color: '#7F77DD', topics: [
    ['전기공사사법',       [1,1,1,1,1,1,1,1], 8],
    ['기술기준 성령',      [1,1,1,1,1,1,1,1], 8],
    ['특정 전기용품',      [1,1,1,1,1,1,1,1], 8],
    ['전기용품 안전법',    [1,1,1,1,1,0,0,1], 6],
  ]},
  { area: 'F 배선도', color: '#639922', topics: [
    ['최소 전선 본수',     [1,1,1,1,1,1,1,1], 8],
    ['박스 내 접속(差込)', [1,1,1,1,1,1,1,1], 8],
    ['도기호 명칭',        [1,1,1,0,1,1,1,1], 7],
    ['절연저항(배선도)',    [1,1,1,1,1,1,0,1], 7],
    ['미사용 스위치',      [0,0,0,0,0,1,0,1], 2],
  ]},
]
const TOP_TERMS = [
  { jp: 'VVF',                      ko: 'PVC 절연 PVC 시스 케이블 평형', cnt: 42 },
  { jp: '漏電遮断器',                ko: '누전차단기',                   cnt: 29 },
  { jp: '硬質ポリ塩化ビニル電線管',   ko: '경질 PVC 전선관',              cnt: 28 },
  { jp: '配線用遮断器',              ko: '배선용 차단기',                 cnt: 27 },
  { jp: 'ケーブル工事',              ko: '케이블 공사',                   cnt: 21 },
  { jp: 'リングスリーブ',             ko: '링 슬리브',                    cnt: 21 },
  { jp: '一般用電気工作物',           ko: '일반용 전기공작물',             cnt: 21 },
  { jp: '金属管工事',                ko: '금속관 공사',                   cnt: 20 },
  { jp: '合成樹脂製可とう電線管',     ko: '합성수지제 가요 전선관',        cnt: 18 },
  { jp: '600V ビニル絶縁電線',       ko: '600V 비닐 절연 전선 (IV)',      cnt: 17 },
  { jp: 'ジョイントボックス',         ko: '접속함 (조인트 박스)',           cnt: 15 },
  { jp: '電気用品安全法',            ko: '전기용품 안전법',                cnt: 15 },
  { jp: '特定電気用品',              ko: '특정 전기용품 (◇ 마크)',        cnt: 14 },
  { jp: '過電流遮断器',              ko: '과전류 차단기',                 cnt: 13 },
  { jp: '合成樹脂管工事',            ko: '합성수지관 공사',                cnt: 13 },
]
const QUESTION_PATTERNS = [
  { pattern: '〜に関する記述として、誤っているものは。',  cnt: 20, tip: '법령·기술기준 문제에 집중 출제' },
  { pattern: '〜の組合せとして、正しいものは。',         cnt: 16, tip: '배선도 기호, 링슬리브 각인 등' },
  { pattern: '〜の施工方法として、適切なものは。',       cnt: 16, tip: '공사방법 적합성 판단' },
  { pattern: '〜の最大値／最小値［単位］は。',           cnt: 13, tip: '허용전류, 절연저항 수치 암기' },
  { pattern: '〜として、不適切なものは。',              cnt:  6, tip: '부적절 공사방법 — 틀린 걸 고르는 문제' },
  { pattern: 'D種接地工事を省略できないものは。',        cnt:  3, tip: '4회/8회 출제 — 격년 패턴 의심' },
]

// ── 타입 ────────────────────────────────────────────────────────
type DenkoshiSession = {
  id: string
  year: number | null
  session: number | null
  my_score: number | null
  comments: string | null
  drive_url: string | null
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-500'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 메인 ────────────────────────────────────────────────────────
export default function DenkoshiHub() {
  const [tab, setTab] = useState<'scores' | 'analysis'>('scores')
  const [sessions, setSessions] = useState<DenkoshiSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, year, session, my_score, comments, drive_url')
      .eq('exam_type', 'denkoshi')
    setSessions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const getSession = (year: number, term: '상' | '하') =>
    sessions.find(s => s.year === year && s.session === (term === '상' ? 1 : 2)) ?? null

  const getExamId = (year: number, term: '상' | '하') =>
    PAST_EXAMS.find(e => e.year === year && e.term === term)?.id ?? ''

  const startEdit = (s: DenkoshiSession) => {
    setEditing(s.id)
    setExpanded(s.id)
    setEditScore(s.my_score?.toString() || '')
    setEditComment(s.comments || '')
  }

  const handleSave = async (s: DenkoshiSession) => {
    setSaving(true)
    await supabase.from('exam_sessions').update({
      my_score: editScore ? parseFloat(editScore) : null,
      comments: editComment || null,
    }).eq('id', s.id)
    await fetchSessions()
    setEditing(null)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('exam_sessions').delete().eq('id', id)
    await fetchSessions()
  }

  const scored = sessions.filter(s => s.my_score !== null)
  const passed = scored.filter(s => (s.my_score ?? 0) >= 60)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((a, s) => a + (s.my_score ?? 0), 0) / scored.length)
    : null

  const chartData: ChartItem[] = [...sessions]
    .filter((s): s is DenkoshiSession & { my_score: number } => s.my_score !== null)
    .sort((a, b) => a.year !== b.year ? (a.year ?? 0) - (b.year ?? 0) : (a.session ?? 0) - (b.session ?? 0))
    .map(s => ({
      name: `${String(s.year).slice(2)}-${s.session === 1 ? '상' : '하'}`,
      score: s.my_score,
      fullName: `${s.year}년 ${s.session === 1 ? '상기' : '하기'}`,
    }))

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗾</span>
          <h1 className="text-2xl font-bold">第二種電気工事士 학과시험</h1>
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
        </div>
        <p className="text-gray-500 text-sm mb-6">일본 경제산업성 · 2025.5.28 CBT 시험</p>

        {/* 탭 — 2개로 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6 w-fit">
          {[
            { key: 'scores',   label: '📈 기출풀이현황' },
            { key: 'analysis', label: '📊 출제경향 분석' },
          ].map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 탭: 기출풀이현황 ── */}
        {tab === 'scores' && (
          <div>
            {/* 요약 통계 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">풀이 완료</p>
                <p className="text-2xl font-bold">{scored.length}<span className="text-sm text-gray-500 ml-1">/ 10</span></p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">60점 이상</p>
                <p className={`text-2xl font-bold ${passed.length > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {passed.length}회
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">평균 점수</p>
                <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>
                  {avgScore !== null ? `${avgScore}점` : '—'}
                </p>
              </div>
            </div>

            {/* 점수 추이 차트 */}
            {chartData.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-3">점수 추이</p>
                <DenkoshiChart data={chartData} />
              </div>
            )}

            {/* 연도별 기출 그리드 — 풀이현황 통합 */}
            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div>
                <div className="grid grid-cols-[40px_1fr_1fr] gap-x-2 gap-y-1.5 items-start">
                  {/* 헤더 */}
                  <div />
                  <div className="text-xs text-gray-600 text-center pb-1">상기</div>
                  <div className="text-xs text-gray-600 text-center pb-1">하기</div>

                  {YEARS.map(year => {
                    const termS = getSession(year, '상')
                    const termH = getSession(year, '하')
                    return [
                      <div key={`${year}-label`} className="text-xs text-gray-600 text-right pt-2.5 pr-1">
                        {year}
                      </div>,
                      ...(['상', '하'] as const).map(term => {
                        const s = term === '상' ? termS : termH
                        const examId = getExamId(year, term)
                        return (
                          <button
                            key={`${year}-${term}`}
                            onClick={() => window.location.href = `/dashboard/denkoshi/${examId}`}
                            className="rounded-xl px-3 py-2 text-left transition w-full bg-gray-900 hover:bg-gray-800 hover:ring-1 hover:ring-blue-500/40 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{year} {term}기</span>
                              {s?.my_score != null && (
                                <span className={`text-xs font-bold tabular-nums ${scoreColor(s.my_score)}`}>
                                  {s.my_score}점
                                </span>
                              )}
                            </div>
                            {s?.comments && (
                              <p className="text-xs text-gray-600 truncate mt-0.5">{s.comments}</p>
                            )}
                            {!s && (
                              <p className="text-xs text-gray-700 mt-0.5">미풀이</p>
                            )}
                          </button>
                        )
                      })
                    ]
                  })}
                </div>

                <p className="text-gray-600 text-xs mt-3">클릭하면 PDF 뷰어 + 점수 기록으로 이동합니다.</p>

                {/* 풀이 기록 상세 편집 */}
                {sessions.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">풀이 기록 편집</p>
                    <div className="space-y-1.5">
                      {[...sessions]
                        .sort((a, b) => {
                          if (a.year !== b.year) return (b.year ?? 0) - (a.year ?? 0)
                          return (b.session ?? 0) - (a.session ?? 0)
                        })
                        .map(s => {
                          const isExpanded = expanded === s.id
                          const isEditing  = editing === s.id
                          const label = `${s.year}년 ${s.session === 1 ? '상기' : '하기'}`
                          return (
                            <div key={s.id} className="bg-gray-900 rounded-xl overflow-hidden">
                              <div
                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800 transition"
                                onClick={() => setExpanded(isExpanded ? null : s.id)}
                              >
                                <span className="font-semibold text-sm">{label}</span>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold ${scoreColor(s.my_score)}`}>
                                    {s.my_score !== null ? `${s.my_score}점` : '—'}
                                  </span>
                                  <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="border-t border-gray-800 p-4">
                                  {isEditing ? (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-xs text-gray-400 mb-1 block">점수 / 100</label>
                                        <input type="number" min="0" max="100"
                                          className="bg-gray-800 rounded-lg px-3 py-2 text-white w-28 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                          value={editScore}
                                          onChange={e => setEditScore(e.target.value)}
                                          placeholder="점수 입력"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-400 mb-1 block">메모</label>
                                        <textarea
                                          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none outline-none focus:ring-1 focus:ring-blue-500"
                                          placeholder="취약 영역, 오답 패턴 등..."
                                          value={editComment}
                                          onChange={e => setEditComment(e.target.value)}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleSave(s)} disabled={saving}
                                          className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                                          {saving ? '저장 중...' : '저장'}
                                        </button>
                                        <button onClick={() => setEditing(null)}
                                          className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition">
                                          취소
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      {s.comments && (
                                        <p className="text-sm text-gray-400 mb-3 leading-relaxed">{s.comments}</p>
                                      )}
                                      <div className="flex gap-2">
                                        <button onClick={() => startEdit(s)}
                                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition">
                                          편집
                                        </button>
                                        <button onClick={() => handleDelete(s.id)}
                                          className="text-gray-600 hover:text-red-400 px-3 py-1.5 rounded-lg text-xs transition">
                                          삭제
                                        </button>
                                        <Link
                                          href={`/dashboard/denkoshi/${getExamId(s.year ?? 0, s.session === 1 ? '상' : '하')}`}
                                          className="text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg text-xs transition"
                                        >
                                          → 기출 보기
                                        </Link>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 탭: 출제경향 분석 ── */}
        {tab === 'analysis' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-base font-bold mb-1">회차별 출제 유형 매트릭스</h2>
              <p className="text-gray-500 text-xs mb-4">2022~2025 8회분 · 빨강 8/8 · 주황 7/8 · 파랑 6/8</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-gray-500 pb-2 pr-4 font-normal whitespace-nowrap">유형</th>
                      {PERIODS.map(p => (
                        <th key={p} className="text-center text-gray-500 pb-2 px-1 font-normal whitespace-nowrap">{p}</th>
                      ))}
                      <th className="text-center text-gray-500 pb-2 pl-3 font-normal">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOPIC_MATRIX.map(({ area, color, topics }) => (
                      <>
                        <tr key={area}>
                          <td colSpan={10} className="pt-3 pb-1 text-xs font-semibold" style={{ color }}>{area}</td>
                        </tr>
                        {topics.map(([name, dots, total]) => (
                          <tr key={name} className="border-b border-gray-800/50">
                            <td className="py-1.5 pr-4 text-gray-300 whitespace-nowrap">{name}</td>
                            {dots.map((d, i) => (
                              <td key={i} className="text-center py-1.5 px-1">
                                {d
                                  ? <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                                  : <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-700" />
                                }
                              </td>
                            ))}
                            <td className={`text-center pl-3 py-1.5 font-semibold ${
                              total === 8 ? 'text-red-400' : total >= 7 ? 'text-yellow-400' : total >= 6 ? 'text-blue-400' : 'text-gray-500'
                            }`}>{total}/8</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold mb-3">출제 패턴 문장</h2>
              <div className="space-y-2">
                {QUESTION_PATTERNS.map(({ pattern, cnt, tip }) => (
                  <div key={pattern} className="bg-gray-900 rounded-xl p-4 flex gap-4 items-start">
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${
                      cnt >= 16 ? 'text-red-400' : cnt >= 8 ? 'text-yellow-400' : 'text-blue-400'
                    }`}>{cnt}회</span>
                    <div>
                      <p className="text-sm text-white font-medium">{pattern}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold mb-3">고빈도 전기용어 TOP 15</h2>
              <div className="space-y-1">
                {TOP_TERMS.map(({ jp, ko, cnt }, i) => (
                  <div key={jp} className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-2.5">
                    <span className="text-xs text-gray-600 w-4 tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{jp}</span>
                      <span className="text-xs text-gray-500 ml-2">{ko}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${Math.round((cnt / 42) * 80)}px` }} />
                      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{cnt}회</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-5">
              <p className="text-sm text-gray-300 mb-3">위 용어를 플래시카드로 학습하려면</p>
              <Link href="/flashcard?exam=denkoshi"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
                🃏 第二種 전용 플래시카드 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
