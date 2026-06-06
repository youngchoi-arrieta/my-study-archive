'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── 과거문 메타데이터 (20개년) ───────────────────────────────────
const SUBJECTS = ['理論', '電力', '機械', '法規'] as const
type Subject = typeof SUBJECTS[number]

type DenkenExam = {
  id: string
  year: number
  term: '上期' | '下期' | ''
  label: string
}

// 2023~: 연 2회 (上期=8월, 下期=3월) / 2009~2022: 연 1회
// 공개 기출 범위: 2026 上期 ~ 2009年
const PAST_EXAMS: DenkenExam[] = [
  ...([2026, 2025, 2024, 2023].flatMap(y => {
    const exams: DenkenExam[] = [
      { id: `dk_${y}_1`, year: y, term: '上期', label: `${y}年 上期` },
    ]
    if (y !== 2026) {
      exams.push({ id: `dk_${y}_2`, year: y, term: '下期', label: `${y}年 下期` })
    }
    return exams
  })),
  ...[2022,2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009].map(y => ({
    id: `dk_${y}_0`, year: y, term: '' as const, label: `${y}年`,
  })),
]

const YEARS_ORDER = [...new Set(PAST_EXAMS.map(e => e.year))].sort((a, b) => b - a)

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

// ── 타입 ────────────────────────────────────────────────────────
type DenkenSession = {
  exam_id: string
  subject: Subject
  my_score: number | null
  memo: string | null
  drive_url: string | null
  updated_at: string
}

type KikaiSummary = {
  exam_id: string
  score: number
  tagCount: number
  hasDriveUrl: boolean
  memoCount: number
}

const SUBJECT_COLORS: Record<Subject, string> = {
  '理論': '#2563eb',
  '電力': '#059669',
  '機械': '#7c3aed',
  '法規': '#b45309',
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-600'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── PDF 뷰어 모달 ────────────────────────────────────────────────
function PdfModal({
  examLabel,
  subject,
  driveUrl,
  onClose,
  onSaveUrl,
}: {
  examLabel: string
  subject: Subject
  driveUrl: string | null
  onClose: () => void
  onSaveUrl: (url: string) => Promise<void>
}) {
  const [inputUrl, setInputUrl] = useState(driveUrl || '')
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    driveUrl ? toPreviewUrl(driveUrl) : null
  )
  const [saving, setSaving] = useState(false)

  const handleLoad = async () => {
    const raw = inputUrl.trim()
    const url = toPreviewUrl(raw)
    setPreviewUrl(url)
    if (raw) {
      setSaving(true)
      await onSaveUrl(raw)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">← 닫기</button>
        <span className="font-bold text-sm">{examLabel}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
          style={{ backgroundColor: SUBJECT_COLORS[subject] }}
        >
          {subject}
        </span>
        <div className="flex gap-2 ml-auto items-center">
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="구글 드라이브 URL 붙여넣기"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-white w-64 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
          />
          <button
            onClick={handleLoad}
            disabled={!inputUrl.trim() || saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            {saving ? '저장 중…' : '불러오기'}
          </button>
        </div>
      </div>
      {/* PDF 뷰어 */}
      <div className="flex-1 bg-gray-950">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            allow="autoplay"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
            <p className="text-4xl">📄</p>
            <p className="text-sm">구글 드라이브 URL을 입력하고 불러오기를 누르세요.</p>
            <p className="text-xs text-gray-700">공유 링크 형식: drive.google.com/file/d/…</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────
export default function DenkenHub() {
  const router = useRouter()
  const [activeTab, setActiveTab]   = useState<'scores' | 'analysis'>('scores')
  const [sessions, setSessions]     = useState<DenkenSession[]>([])
  const [loading, setLoading]       = useState(true)
  const [editKey, setEditKey]       = useState<string | null>(null)
  const [editScore, setEditScore]   = useState('')
  const [editMemo, setEditMemo]     = useState('')
  const [editDriveUrl, setEditDriveUrl] = useState('')
  const [saving, setSaving]         = useState(false)
  const [filterSubject, setFilterSubject] = useState<Subject | null>(null)
  const [pdfModal, setPdfModal]     = useState<{ examId: string; subject: Subject } | null>(null)
  const [kikaiMap, setKikaiMap]     = useState<Map<string, KikaiSummary>>(new Map())

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('denken_sessions')
      .select('exam_id, subject, my_score, memo, drive_url, updated_at')
    setSessions((data || []) as DenkenSession[])
    setLoading(false)
  }, [])

  const fetchKikai = useCallback(async () => {
    const [{ data: sessions }, { data: answers }] = await Promise.all([
      supabase.from('denken_kikai_sessions').select('exam_id, drive_url, selected_q'),
      supabase.from('denken_kikai_answers').select('exam_id, result, tag_id, memo, q_num'),
    ])
    const map = new Map<string, KikaiSummary>()
    for (const s of (sessions || [])) {
      const ans = (answers || []).filter((a: {exam_id:string,result:string|null,tag_id:number|null,memo:string|null,q_num:number}) => a.exam_id === s.exam_id)
      // 점수 계산 (A문제 5점, B문제 10점, 선택문제 반영)
      const selectedQ = s.selected_q as number | null
      let score = 0
      for (const a of ans) {
        if (a.result !== 'correct') continue
        if ((a.q_num === 17 || a.q_num === 18) && a.q_num !== selectedQ) continue
        score += a.q_num <= 14 ? 5 : 10
      }
      map.set(s.exam_id, {
        exam_id: s.exam_id,
        score,
        tagCount: ans.filter((a: {tag_id:number|null}) => a.tag_id !== null).length,
        hasDriveUrl: !!s.drive_url,
        memoCount: ans.filter((a: {memo:string|null}) => a.memo).length,
      })
    }
    setKikaiMap(map)
  }, [])

  useEffect(() => { fetchSessions(); fetchKikai() }, [fetchSessions, fetchKikai])

  const sessionMap = useMemo(() => {
    const map = new Map<string, DenkenSession>()
    sessions.forEach(s => map.set(`${s.exam_id}__${s.subject}`, s))
    return map
  }, [sessions])

  const getSession = (examId: string, subject: Subject) =>
    sessionMap.get(`${examId}__${subject}`) ?? null

  const startEdit = (examId: string, subject: Subject) => {
    const key = `${examId}__${subject}`
    const s   = sessionMap.get(key)
    if (editKey === key) { setEditKey(null); return }
    setEditKey(key)
    setEditScore(s?.my_score?.toString() || '')
    setEditMemo(s?.memo || '')
    setEditDriveUrl(s?.drive_url || '')
  }

  const handleSave = async () => {
    if (!editKey) return
    setSaving(true)
    const [examId, subject] = editKey.split('__') as [string, Subject]
    await supabase.from('denken_sessions').upsert({
      exam_id: examId,
      subject,
      my_score: editScore ? parseFloat(editScore) : null,
      memo: editMemo.trim() || null,
      drive_url: editDriveUrl.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,subject' })
    await fetchSessions()
    setEditKey(null)
    setSaving(false)
  }

  // PDF 모달에서 URL 저장 (機械 제외 과목용)
  const handleSaveUrl = useCallback(async (examId: string, subject: Subject, url: string) => {
    await supabase.from('denken_sessions').upsert({
      exam_id: examId,
      subject,
      drive_url: url || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,subject' })
    await fetchSessions()
  }, [fetchSessions])

  // 통계
  const totalAttempts  = sessions.filter(s => s.my_score !== null).length
  const passedAttempts = sessions.filter(s => (s.my_score ?? 0) >= 60).length

  const subjectStats = useMemo(() => SUBJECTS.map(sub => {
    const subs   = sessions.filter(s => s.subject === sub && s.my_score !== null)
    const avg    = subs.length === 0 ? null : Math.round(subs.reduce((a, s) => a + (s.my_score ?? 0), 0) / subs.length)
    const best   = subs.length === 0 ? null : Math.max(...subs.map(s => s.my_score ?? 0))
    const passed = subs.filter(s => (s.my_score ?? 0) >= 60).length
    return { sub, count: subs.length, avg, best, passed }
  }), [sessions])

  // PDF 모달용 데이터
  const pdfExam = pdfModal ? PAST_EXAMS.find(e => e.id === pdfModal.examId) : null
  const pdfSession = pdfModal ? getSession(pdfModal.examId, pdfModal.subject) : null

  return (
    <>
      {/* PDF 뷰어 모달 */}
      {pdfModal && pdfExam && (
        <PdfModal
          examLabel={pdfExam.label}
          subject={pdfModal.subject}
          driveUrl={pdfSession?.drive_url ?? null}
          onClose={() => setPdfModal(null)}
          onSaveUrl={(url) => handleSaveUrl(pdfModal.examId, pdfModal.subject, url)}
        />
      )}

      <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="max-w-3xl mx-auto">

          {/* 헤더 */}
          <div className="mb-2">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🏭</span>
            <h1 className="text-2xl font-bold">電験三種</h1>
            <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
          </div>
          <p className="text-gray-500 text-sm mb-5">
            일본 경제산업성 · CBT 전 과목 등록 완료 · 理論 · 電力 · 機械 · 法規
          </p>

          {/* 탭 */}
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
            {([
              { key: 'scores',   label: '📋 기출 풀이 현황' },
              { key: 'analysis', label: '📊 과목별 분석' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── 기출 풀이 현황 탭 ── */}
          {activeTab === 'scores' && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">풀이 완료 (과목)</p>
                  <p className="text-2xl font-bold">
                    {totalAttempts}
                    <span className="text-sm text-gray-500 ml-1">/ {PAST_EXAMS.length * 4}</span>
                  </p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">합격 과목</p>
                  <p className={`text-2xl font-bold ${passedAttempts > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {passedAttempts}
                  </p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">총 회차</p>
                  <p className="text-2xl font-bold text-blue-400">{PAST_EXAMS.length}</p>
                </div>
              </div>

              {/* 과목 필터 */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                <button
                  onClick={() => setFilterSubject(null)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterSubject === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  전 과목
                </button>
                {SUBJECTS.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setFilterSubject(filterSubject === sub ? null : sub)}
                    style={filterSubject === sub ? { backgroundColor: SUBJECT_COLORS[sub] } : undefined}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      filterSubject === sub ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {/* 기출 목록 */}
              {loading ? (
                <p className="text-gray-500 text-sm">불러오는 중...</p>
              ) : (
                <div className="space-y-2">
                  {YEARS_ORDER.map(year =>
                    PAST_EXAMS.filter(e => e.year === year).map(exam => (
                      <div key={exam.id} className="bg-gray-900 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-800">
                          <p className="text-sm font-semibold text-gray-300">{exam.label}</p>
                        </div>
                        <div className={`grid gap-px bg-gray-800 ${
                          filterSubject ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'
                        }`}>
                          {(filterSubject ? [filterSubject] : SUBJECTS).map(sub => {
                            const s      = getSession(exam.id, sub)
                            const key    = `${exam.id}__${sub}`
                            const isEdit = editKey === key
                            const hasPdf = !!s?.drive_url

                            return (
                              <div key={sub} className="bg-gray-950">
                                {/* 과목 셀 */}
                                <div className="flex items-center gap-1 p-3">
                                  <button
                                    onClick={() => startEdit(exam.id, sub)}
                                    className="flex-1 text-left hover:bg-gray-900 rounded-lg p-1 transition"
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: SUBJECT_COLORS[sub] }}
                                      />
                                      <span className="text-xs text-gray-500">{sub}</span>
                                    </div>
                                    <p className={`text-lg font-bold tabular-nums ${scoreColor(s?.my_score ?? null)}`}>
                                      {s?.my_score != null ? `${s.my_score}点` : '—'}
                                    </p>
                                    {s?.memo && (
                                      <p className="text-[10px] text-blue-500 mt-0.5 truncate">메모 있음</p>
                                    )}
                                  </button>
                                  {/* PDF 버튼: 機械는 전용 풀이 UI, 나머지는 모달 */}
                                  {sub === '機械' ? (() => {
                                    const ki = kikaiMap.get(exam.id)
                                    return (
                                      <button
                                        onClick={() => router.push(`/dashboard/denken/kikai/${exam.id}`)}
                                        className="flex flex-col items-end gap-0.5 shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition bg-violet-900/20 hover:bg-violet-900/40 text-violet-400"
                                        title="機械 풀이 UI로 이동"
                                      >
                                        <span>풀기 →</span>
                                        {ki && ki.score > 0 && (
                                          <span className={ki.score >= 60 ? 'text-emerald-400' : 'text-yellow-400'}>{ki.score}점</span>
                                        )}
                                        {ki && ki.tagCount > 0 && (
                                          <span className="text-violet-500 font-normal">{ki.tagCount}태그</span>
                                        )}
                                        {ki?.hasDriveUrl && (
                                          <span className="text-gray-600 font-normal">PDF✓</span>
                                        )}
                                      </button>
                                    )
                                  })() : (
                                    <button
                                      onClick={() => setPdfModal({ examId: exam.id, subject: sub })}
                                      className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                        hasPdf
                                          ? 'bg-blue-600/30 text-blue-400 hover:bg-blue-600/50'
                                          : 'bg-gray-800 text-gray-600 hover:bg-gray-700 hover:text-gray-400'
                                      }`}
                                      title="PDF 기출 보기"
                                    >
                                      PDF
                                    </button>
                                  )}
                                </div>

                                {/* 인라인 편집 패널 */}
                                {isEdit && (
                                  <div className="border-t border-gray-800 p-3 bg-gray-900 space-y-2">
                                    <input
                                      type="number" min="0" max="100"
                                      value={editScore}
                                      onChange={e => setEditScore(e.target.value)}
                                      placeholder="점수 (0~100)"
                                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <textarea
                                      rows={2}
                                      value={editMemo}
                                      onChange={e => setEditMemo(e.target.value)}
                                      placeholder="오답 메모..."
                                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                                    />
                                    <input
                                      type="text"
                                      value={editDriveUrl}
                                      onChange={e => setEditDriveUrl(e.target.value)}
                                      placeholder="구글 드라이브 URL (선택)"
                                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={handleSave} disabled={saving}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-1 rounded-lg text-xs font-semibold transition"
                                      >
                                        {saving ? '…' : '저장'}
                                      </button>
                                      <button
                                        onClick={() => setEditKey(null)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded-lg text-xs transition"
                                      >
                                        닫기
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 과목별 분석 탭 ── */}
          {activeTab === 'analysis' && (
            <div className="space-y-3">
              {subjectStats.map(({ sub, count, avg, best, passed }) => (
                <div key={sub} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[sub] }} />
                    <h3 className="font-bold">{sub}</h3>
                    <span className="text-xs text-gray-600 ml-auto">{count}회 풀이</span>
                  </div>
                  {count === 0 ? (
                    <p className="text-xs text-gray-700">아직 풀이 기록이 없어요.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">평균</p>
                          <p className={`text-xl font-bold ${scoreColor(avg)}`}>{avg}点</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">최고</p>
                          <p className={`text-xl font-bold ${scoreColor(best)}`}>{best}点</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">합격 횟수</p>
                          <p className={`text-xl font-bold ${passed > 0 ? 'text-green-400' : 'text-gray-600'}`}>{passed}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${avg}%`,
                            backgroundColor: (avg ?? 0) >= 60 ? '#22c55e' : (avg ?? 0) >= 40 ? '#eab308' : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-700">0</span>
                        <span className="text-[10px] text-gray-600">합격 60点</span>
                        <span className="text-[10px] text-gray-700">100</span>
                      </div>
                    </>
                  )}
                  {sessions.filter(s => s.subject === sub && s.memo).length > 0 && (
                    <div className="mt-3 border-t border-gray-800 pt-3 space-y-1.5">
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest">오답 메모</p>
                      {sessions
                        .filter(s => s.subject === sub && s.memo)
                        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                        .map(s => {
                          const exam = PAST_EXAMS.find(e => e.id === s.exam_id)
                          return (
                            <div key={s.exam_id} className="flex gap-2">
                              <span className="text-[10px] text-gray-700 shrink-0 w-14">{exam?.label.replace('年', '')}</span>
                              <p className="text-xs text-gray-400 leading-relaxed">{s.memo}</p>
                            </div>
                          )
                        })
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
