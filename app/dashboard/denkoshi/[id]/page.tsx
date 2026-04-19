'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PAST_EXAMS: Record<string, { label: string; year: number; term: '상' | '하' }> = {
  '20210530': { label: '2021 상기', year: 2021, term: '상' },
  '20211024': { label: '2021 하기', year: 2021, term: '하' },
  '20220529': { label: '2022 상기', year: 2022, term: '상' },
  '20221030': { label: '2022 하기', year: 2022, term: '하' },
  '20230528': { label: '2023 상기', year: 2023, term: '상' },
  '20231029': { label: '2023 하기', year: 2023, term: '하' },
  '20240526': { label: '2024 상기', year: 2024, term: '상' },
  '20241027': { label: '2024 하기', year: 2024, term: '하' },
  '20250525': { label: '2025 상기', year: 2025, term: '상' },
  '20251026': { label: '2025 하기', year: 2025, term: '하' },
}

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

type PeriodKey = '20220529'|'20221030'|'20230528'|'20231029'|'20240526'|'20241027'|'20250525'|'20251026'

const PERIOD_TOPICS: Record<PeriodKey, { area: string; color: string; topics: string[] }[]> = {
  '20220529': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '전력손실'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 기구', '최고 허용 온도'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['부적절 공사방법', '전선 접속 부적절'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['D종 접지 생략', '절연저항'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품', '전기용품 안전법'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)'] },
  ],
  '20221030': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '전력량 계산', '전압강하', '전력손실'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 기구', '최고 허용 온도', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['부적절 공사방법', '특수장소', '전선 접속 부적절'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['측정기·회로계', '접지저항 측정법'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품', '전기용품 안전법'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)'] },
  ],
  '20230528': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '전력량 계산', '전력손실'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 기구', '사진 식별 공구', '최고 허용 온도', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['스타델타 기동', '태양광발전', '전선 접속 부적절'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['측정기·회로계'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품', '전기용품 안전법'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)'] },
  ],
  '20231029': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '전력량 계산', '전력손실'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 공구', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['스타델타 기동', '전선 접속 부적절'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['D종 접지 생략'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품', '전기용품 안전법'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '절연저항(배선도)'] },
  ],
  '20240526': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '전압강하', '전동기 력률'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 기구', '사진 식별 공구', '최고 허용 온도', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['부적절 공사방법', '스타델타 기동'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['측정기·회로계'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품', '전기용품 안전법'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)'] },
  ],
  '20241027': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '합성저항 계산', '전력량 계산', '전동기 력률'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 기구', '사진 식별 공구', '최고 허용 온도', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['부적절 공사방법'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['측정기·회로계', 'D종 접지 생략'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)', '미사용 스위치'] },
  ],
  '20250525': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '합성저항 계산', '전력량 계산', '전압강하', '전동기 력률'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 기구', '사진 식별 공구', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['부적절 공사방법', '스타델타 기동', '태양광·특수장소', '전선 접속 부적절'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['측정기·회로계'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)'] },
  ],
  '20251026': [
    { area: 'A 전기이론',       color: '#378ADD', topics: ['기타 회로이론', '합성저항 계산', '전력량 계산', '전동기 력률'] },
    { area: 'B 배선재료·기자재', color: '#1D9E75', topics: ['사진 식별 재료', '사진 식별 기구', '사진 식별 공구', '최고 허용 온도', '분기회로 설계'] },
    { area: 'C 공사방법',       color: '#D85A30', topics: ['스타델타 기동', '태양광·특수장소'] },
    { area: 'D 접지·측정',      color: '#D4537E', topics: ['측정기·회로계', 'D종 접지 생략', '접지저항 측정법', '전자적 불평형'] },
    { area: 'E 법령',           color: '#7F77DD', topics: ['전기공사사법', '기술기준 성령', '특정 전기용품', '전기용품 안전법'] },
    { area: 'F 배선도',         color: '#639922', topics: ['최소 전선 본수', '박스 내 접속(差込)', '도기호 명칭', '절연저항(배선도)', '미사용 스위치'] },
  ],
}

type DenkoshiSession = {
  id: string
  my_score: number | null
  comments: string | null
  drive_url: string | null
}

export default function DenkoshiDetail() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const exam = PAST_EXAMS[examId]
  const topics = PERIOD_TOPICS[examId as PeriodKey] || null

  const [session, setSession]         = useState<DenkoshiSession | null>(null)
  const [editScore, setEditScore]     = useState('')
  const [editComment, setEditComment] = useState('')
  const [editUrl, setEditUrl]         = useState('')
  const [editingMemo, setEditingMemo] = useState(false)
  const [editingUrl, setEditingUrl]   = useState(false)
  const [saving, setSaving]           = useState(false)

  const fetchSession = useCallback(async () => {
    if (!exam) return
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, my_score, comments, drive_url')
      .eq('exam_type', 'denkoshi')
      .eq('year', exam.year)
      .eq('session', exam.term === '상' ? 1 : 2)
      .maybeSingle()
    setSession(data)
    if (data) {
      setEditScore(data.my_score?.toString() || '')
      setEditComment(data.comments || '')
      setEditUrl(data.drive_url || '')
    }
  }, [exam])

  useEffect(() => { fetchSession() }, [fetchSession])

  const upsert = async (extra: Partial<DenkoshiSession>) => {
    if (!exam) return
    setSaving(true)
    const base = { exam_type: 'denkoshi', year: exam.year, session: exam.term === '상' ? 1 : 2, record_type: '기출문제' }
    if (session) {
      await supabase.from('exam_sessions').update({ ...base, ...extra }).eq('id', session.id)
    } else {
      await supabase.from('exam_sessions').insert({ ...base, ...extra })
    }
    await fetchSession()
    setSaving(false)
  }

  const saveMemo = async () => {
    await upsert({ my_score: editScore ? parseFloat(editScore) : null, comments: editComment || null })
    setEditingMemo(false)
  }

  const saveUrl = async () => {
    await upsert({ drive_url: editUrl || null })
    setEditingUrl(false)
  }

  const scoreColor = (s: number | null) => {
    if (s === null) return 'text-gray-500'
    if (s >= 60) return 'text-green-400'
    if (s >= 40) return 'text-yellow-400'
    return 'text-red-400'
  }

  const previewUrl = toPreviewUrl(session?.drive_url || '')

  if (!exam) return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <p className="text-gray-400">존재하지 않는 회차입니다.</p>
      <button onClick={() => router.back()} className="text-blue-400 mt-4 text-sm">← 돌아가기</button>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* 헤더 */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm mb-2 block">
          ← 기출문제 목록
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">第二種電気工事士 — {exam.label}</h1>
          {session?.my_score != null && (
            <span className={`text-xl font-bold tabular-nums ${scoreColor(session.my_score)}`}>
              {session.my_score}점
            </span>
          )}
        </div>
      </div>

      {/* 좌우 분할 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 좌: PDF */}
        <div className="flex-1 border-r border-gray-800 flex flex-col overflow-hidden">
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full flex-1 block" allow="autoplay" />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-4">
              <p className="text-gray-500 text-sm">PDF가 등록되지 않았습니다</p>
              {!editingUrl ? (
                <button
                  onClick={() => setEditingUrl(true)}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  + 구글 드라이브 링크 등록
                </button>
              ) : (
                <div className="w-full max-w-sm space-y-2">
                  <p className="text-xs text-gray-500">구글 드라이브 공유 링크를 붙여넣으세요</p>
                  <input
                    autoFocus
                    type="text"
                    placeholder="https://drive.google.com/file/d/.../view"
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex gap-2 justify-center">
                    <button onClick={saveUrl} disabled={saving}
                      className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                      {saving ? '저장 중...' : '등록'}
                    </button>
                    <button onClick={() => setEditingUrl(false)}
                      className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 우: 사이드 패널 */}
        <div className="w-72 flex flex-col overflow-y-auto shrink-0">

          {/* PDF 링크 변경 (등록된 경우) */}
          {previewUrl && (
            <div className="px-5 pt-4 pb-3 border-b border-gray-800">
              {!editingUrl ? (
                <button
                  onClick={() => { setEditUrl(session?.drive_url || ''); setEditingUrl(true) }}
                  className="text-xs text-gray-600 hover:text-gray-400 transition"
                >
                  📎 PDF 링크 변경
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    autoFocus type="text"
                    value={editUrl}
                    onChange={e => setEditUrl(e.target.value)}
                    placeholder="구글 드라이브 공유 링크"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveUrl} disabled={saving}
                      className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs transition disabled:opacity-50">
                      {saving ? '...' : '저장'}
                    </button>
                    <button onClick={() => setEditingUrl(false)}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 점수 메모 */}
          <div className="p-5 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-300">내 점수 메모</h2>
              {!editingMemo && (
                <button
                  onClick={() => {
                    setEditScore(session?.my_score?.toString() || '')
                    setEditComment(session?.comments || '')
                    setEditingMemo(true)
                  }}
                  className="text-xs text-gray-500 hover:text-white transition"
                >
                  {session?.my_score != null ? '편집' : '+ 기록'}
                </button>
              )}
            </div>
            {editingMemo ? (
              <div className="space-y-2">
                <input type="number" placeholder="점수 (예: 72)"
                  value={editScore} onChange={e => setEditScore(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <textarea placeholder="메모 (취약 영역, 오답 패턴 등)"
                  value={editComment} onChange={e => setEditComment(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={saveMemo} disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button onClick={() => setEditingMemo(false)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition">
                    취소
                  </button>
                </div>
              </div>
            ) : session?.my_score != null ? (
              <div>
                <p className={`text-3xl font-bold tabular-nums mb-1 ${scoreColor(session.my_score)}`}>
                  {session.my_score}점
                </p>
                {session.comments && (
                  <p className="text-xs text-gray-500 leading-relaxed">{session.comments}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-700">아직 기록 없음</p>
            )}
          </div>

          {/* 이 회차 출제 유형 */}
          <div className="p-5 flex-1">
            <h2 className="text-sm font-bold text-gray-300 mb-3">이 회차 출제 유형</h2>
            {topics ? (
              <div className="space-y-3">
                {topics.map(({ area, color, topics: ts }) => (
                  <div key={area}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color }}>{area}</p>
                    <div className="flex flex-wrap gap-1">
                      {ts.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${color}22`, color }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">2021년 회차는 분석 데이터가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
