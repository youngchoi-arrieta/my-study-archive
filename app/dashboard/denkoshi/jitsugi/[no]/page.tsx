'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from "next/navigation"
import { supabase } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import {
  KOUHO_MONDAI, KEKKAN_CATEGORIES, KEKKAN_ITEM_MAP, DIFF_LABEL, JITSUGI_EXAM,
  toPreviewUrl, fmtDur,
  type JitsugiProblem, type JitsugiAttempt,
} from '@/lib/constants-denkoshi-jitsugi'

export default function JitsugiProblemPage() {
  const params = useParams()
  const no = Number(params.no)
  const meta = KOUHO_MONDAI.find(p => p.no === no)

  const [problem, setProblem] = useState<JitsugiProblem | null>(null)
  const [attempts, setAttempts] = useState<JitsugiAttempt[]>([])
  const [loading, setLoading] = useState(true)

  // PDF 보기 상태: 'q' | 'a' | null
  const [pdfModal, setPdfModal] = useState<'q' | 'a' | null>(null)
  const [editUrls, setEditUrls] = useState(false)
  const [qUrl, setQUrl] = useState('')
  const [aUrl, setAUrl] = useState('')

  // 타이머
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  // 채점 폼
  const [scoring, setScoring] = useState(false)
  const [defects, setDefects] = useState<Set<string>>(new Set())
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [manualMin, setManualMin] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: prob }, { data: atts }] = await Promise.all([
      supabase.from('denkoshi_jitsugi_problems')
        .select('no, q_drive_url, a_drive_url, updated_at').eq('no', no).single(),
      supabase.from('denkoshi_jitsugi_attempts')
        .select('id, problem_no, duration_sec, completed, passed_self, defect_codes, notes, created_at')
        .eq('problem_no', no).order('created_at', { ascending: true }),
    ])
    setProblem((prob ?? { no, q_drive_url: null, a_drive_url: null }) as JitsugiProblem)
    setQUrl(prob?.q_drive_url ?? '')
    setAUrl(prob?.a_drive_url ?? '')
    setAttempts((atts ?? []) as JitsugiAttempt[])
    setLoading(false)
  }, [no])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (running) tick.current = setInterval(() => setElapsed(e => e + 1), 1000)
    else if (tick.current) clearInterval(tick.current)
    return () => { if (tick.current) clearInterval(tick.current) }
  }, [running])

  const saveUrls = async () => {
    await supabase.from('denkoshi_jitsugi_problems').upsert(
      { no, q_drive_url: qUrl.trim() || null, a_drive_url: aUrl.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'no' }
    )
    setEditUrls(false)
    load()
  }

  const toggleDefect = (code: string) =>
    setDefects(prev => {
      const n = new Set(prev)
      if (n.has(code)) n.delete(code); else n.add(code)
      return n
    })

  const startScoring = () => {
    setRunning(false)
    setManualMin('')
    setScoring(true)
  }

  const saveAttempt = async () => {
    const dur = manualMin.trim() !== ''
      ? Math.round(parseFloat(manualMin) * 60)
      : elapsed > 0 ? elapsed : null
    const codes = Array.from(defects)
    await supabase.from('denkoshi_jitsugi_attempts').insert({
      problem_no: no,
      duration_sec: dur,
      completed: true,
      passed_self: codes.length === 0,
      defect_codes: codes,
      notes: notes.trim() || null,
    })
    // 리셋
    setScoring(false); setDefects(new Set()); setNotes(''); setManualMin('')
    setElapsed(0); setRunning(false); setOpenCats(new Set())
    load()
  }

  const del = async (id: string) => {
    if (!confirm('이 회차 기록을 삭제할까요?')) return
    await supabase.from('denkoshi_jitsugi_attempts').delete().eq('id', id)
    load()
  }

  // 시간 추이 데이터 (오래된→최신, 회차 번호)
  const chartData = useMemo(() =>
    attempts
      .filter(a => a.duration_sec != null)
      .map((a, i) => ({ round: i + 1, min: Math.round((a.duration_sec ?? 0) / 60 * 10) / 10, passed: a.passed_self })),
    [attempts])


  if (!meta) {
    return <main className="min-h-screen bg-gray-950 text-white p-8"><p>없는 문제예요. <Link href="/dashboard/denkoshi/jitsugi" className="text-blue-400">← 목록</Link></p></main>
  }
  const diff = DIFF_LABEL[meta.difficulty]
  const isOver = elapsed > JITSUGI_EXAM.durationSec

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* PDF 전체화면 모달 */}
        {pdfModal && (
          <JitsugiPdfModal
            problemNo={no}
            initial={pdfModal}
            qUrl={problem?.q_drive_url ?? null}
            aUrl={problem?.a_drive_url ?? null}
            onClose={() => setPdfModal(null)}
            onEditUrls={() => { setPdfModal(null); setEditUrls(true) }}
          />
        )}
        <div className="mb-3 flex items-center gap-2">
          <Link href="/dashboard/denkoshi/jitsugi" className="text-gray-400 hover:text-white text-sm">← 목록</Link>
          <span className="text-gray-700">·</span>
          <span className="font-bold text-blue-400">No.{no}</span>
          <span className="text-sm text-gray-300">{meta.feature}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: diff.color + '22', color: diff.color }}>{diff.ko}</span>
          <button onClick={() => setEditUrls(v => !v)}
            className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition">
            🔗 PDF 링크
          </button>
        </div>

        {/* URL 편집 */}
        {editUrls && (
          <div className="bg-gray-900 rounded-xl p-4 mb-4 space-y-2">
            <p className="text-xs text-gray-400">구글 드라이브 공유링크 (drive.google.com/file/d/…)</p>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 w-10">문제</span>
              <input value={qUrl} onChange={e => setQUrl(e.target.value)}
                placeholder="문제 PDF URL"
                className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 w-10">정답</span>
              <input value={aUrl} onChange={e => setAUrl(e.target.value)}
                placeholder="정답 PDF URL"
                className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <button onClick={saveUrls}
              className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition">저장</button>
          </div>
        )}

        <div className="space-y-4">
          {/* ── PDF: 모달 트리거 ── */}
          <div className="bg-gray-900 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">도면 보기</p>
              <p className="text-[11px] text-gray-500">전체화면으로 문제·정답 PDF를 띄웁니다</p>
            </div>
            <button onClick={() => setPdfModal('q')}
              className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-semibold">
              문제
            </button>
            <button onClick={() => setPdfModal('a')}
              className="text-sm px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 transition font-semibold">
              정답·복선도
            </button>
          </div>

          {/* ── 타이머 + 채점 ── */}
          <div className="space-y-4">
            {/* 타이머 */}
            <div className="bg-gray-900 rounded-2xl p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">작업 타이머 (목표 40:00)</p>
              <div className={`font-mono text-5xl tabular-nums mb-3 ${isOver ? 'text-red-400' : 'text-white'}`}>
                {fmtDur(elapsed)}
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setRunning(r => !r)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-green-600 hover:bg-green-500'}`}>
                  {running ? '일시정지' : elapsed > 0 ? '계속' : '시작'}
                </button>
                <button onClick={() => { setElapsed(0); setRunning(false) }}
                  className="px-4 py-2 rounded-lg text-sm bg-gray-700 hover:bg-gray-600 transition">리셋</button>
                <button onClick={startScoring}
                  className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 transition font-semibold">
                  완성 → 채점
                </button>
              </div>
            </div>

            {/* 채점 (欠陥 체크) */}
            {scoring && (
              <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">자가채점 — 발생한 欠陥만 체크</p>
                  <span className={`text-sm font-bold ${defects.size === 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {defects.size === 0 ? '합격' : `欠陥 ${defects.size} · 불합격`}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  소요시간
                  <span className="font-mono text-white">{fmtDur(elapsed > 0 ? elapsed : null)}</span>
                  <span className="text-gray-600">또는 수동</span>
                  <input value={manualMin} onChange={e => setManualMin(e.target.value)}
                    placeholder="분" inputMode="decimal"
                    className="w-16 bg-gray-800 rounded px-2 py-1 text-white" />
                </div>

                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {KEKKAN_CATEGORIES.map(c => {
                    const open = openCats.has(c.code)
                    const hit = c.items.filter(i => defects.has(i.code)).length
                    return (
                      <div key={c.code} className="bg-gray-800/60 rounded-lg overflow-hidden">
                        <button onClick={() => setOpenCats(prev => {
                          const n = new Set(prev); if (n.has(c.code)) n.delete(c.code); else n.add(c.code); return n
                        })}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-left">
                          <span className="text-xs font-semibold" style={{ color: c.color }}>{c.code}. {c.ko}</span>
                          <span className="text-[10px] text-gray-500">
                            {hit > 0 && <span className="text-red-400 mr-2">{hit}</span>}{open ? '▲' : '▼'}
                          </span>
                        </button>
                        {open && (
                          <div className="px-3 pb-2 space-y-1">
                            {c.items.map(i => (
                              <label key={i.code} className="flex items-start gap-2 text-xs text-gray-300 py-0.5 cursor-pointer">
                                <input type="checkbox" checked={defects.has(i.code)}
                                  onChange={() => toggleDefect(i.code)} className="accent-red-500 mt-0.5" />
                                <span><span className="text-gray-500">{i.code}</span> {i.ko}
                                  <span className="text-gray-600 block text-[10px]">{i.ja}</span></span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="메모 (막힌 부분, 다음 주의점…)"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white h-16 resize-none" />

                <div className="flex gap-2">
                  <button onClick={saveAttempt}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-sm font-semibold transition">
                    회차 저장
                  </button>
                  <button onClick={() => setScoring(false)}
                    className="px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition">취소</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 하단: 회차별 트래킹 ── */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 시간 추이 */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <p className="text-sm font-semibold mb-3">회차별 시간 추이</p>
            {chartData.length >= 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="round" tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={(v) => `${v}회`} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} unit="분" />
                  <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4"
                    label={{ value: '40분', fill: '#ef4444', fontSize: 10, position: 'right' }} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}분`, '소요']} labelFormatter={(l) => `${l}회차`} />
                  <Line type="monotone" dataKey="min" stroke="#3b82f6" strokeWidth={2}
                    dot={{ r: 4, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-600 text-sm">기록이 쌓이면 시간이 줄어드는 추이가 보여요.</p>
            )}
          </div>

          {/* 회차별 결함 리스트 */}
          <div className="bg-gray-900 rounded-2xl p-5">
            <p className="text-sm font-semibold mb-3">회차별 기록</p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {attempts.length === 0 && <p className="text-gray-600 text-sm">아직 기록이 없어요.</p>}
              {[...attempts].reverse().map((a, idx) => {
                const round = attempts.length - idx
                return (
                  <div key={a.id} className="bg-gray-800/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-300">{round}회차</span>
                      <span className="font-mono text-gray-400 text-xs">{fmtDur(a.duration_sec)}</span>
                      <span className={`text-xs font-bold ${a.passed_self ? 'text-green-400' : 'text-red-400'}`}>
                        {a.passed_self ? '합격' : `불합격 (欠陥 ${a.defect_codes.length})`}
                      </span>
                      <span className="text-[10px] text-gray-600 ml-auto">{a.created_at?.slice(0, 10)}</span>
                      <button onClick={() => del(a.id)} className="text-gray-600 hover:text-red-400 text-xs">삭제</button>
                    </div>
                    {a.defect_codes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {a.defect_codes.map(c => {
                          const it = KEKKAN_ITEM_MAP.get(c)
                          return (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: (it?.catColor ?? '#ef4444') + '22', color: it?.catColor ?? '#fca5a5' }}>
                              {c} {it?.ko ?? ''}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {a.notes && <p className="text-[11px] text-gray-500 mt-1">{a.notes}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-600 text-sm mt-4">불러오는 중…</p>}
      </div>
    </main>
  )
}


// ── PDF 전체화면 모달 (덴켄 PdfModal 패턴) ──────────────────────
function JitsugiPdfModal({
  problemNo, initial, qUrl, aUrl, onClose, onEditUrls,
}: {
  problemNo: number
  initial: 'q' | 'a'
  qUrl: string | null
  aUrl: string | null
  onClose: () => void
  onEditUrls: () => void
}) {
  // 한 모달 = PDF 하나(고정). src가 바뀌지 않으므로 스크롤이 초기화되지 않음.
  const view = initial
  const url = view === 'q' ? qUrl : aUrl
  const preview = url ? toPreviewUrl(url) : null

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">← 닫기</button>
        <span className="font-bold text-sm text-blue-400">No.{problemNo}</span>
        <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold text-white ${view === 'q' ? 'bg-blue-600' : 'bg-green-600'}`}>
          {view === 'q' ? '문제' : '정답·복선도'}
        </span>
        <button onClick={onEditUrls} className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
          🔗 PDF 링크
        </button>
      </div>
      <div className="flex-1 bg-gray-950">
        {preview ? (
          <iframe src={preview} className="w-full h-full border-0" allow="autoplay" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
            <p className="text-4xl">📄</p>
            <p className="text-sm">{view === 'q' ? '문제' : '정답'} PDF가 아직 없어요.</p>
            <button onClick={onEditUrls} className="text-xs text-blue-400 hover:underline">🔗 PDF 링크 추가</button>
          </div>
        )}
      </div>
    </div>
  )
}
