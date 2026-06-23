'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from "next/navigation"
import { supabase } from '@/lib/supabase'
import { compressToBase64 } from '@/lib/imageUtils'
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
  const resultFileRef = useRef<HTMLInputElement | null>(null)
  const [imgBusy, setImgBusy] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const refFileRef = useRef<HTMLInputElement | null>(null)
  const [refBusy, setRefBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: prob }, { data: atts }] = await Promise.all([
      supabase.from('denkoshi_jitsugi_problems')
        .select('no, q_drive_url, a_drive_url, result_images, reference_images, updated_at').eq('no', no).single(),
      supabase.from('denkoshi_jitsugi_attempts')
        .select('id, problem_no, duration_sec, completed, passed_self, defect_codes, notes, created_at')
        .eq('problem_no', no).order('created_at', { ascending: true }),
    ])
    setProblem((prob ?? { no, q_drive_url: null, a_drive_url: null, result_images: [], reference_images: [] }) as JitsugiProblem)
    setQUrl(prob?.q_drive_url ?? '')
    setAUrl(prob?.a_drive_url ?? '')
    setAttempts((atts ?? []) as JitsugiAttempt[])
    setLoading(false)
  }, [no])

  useEffect(() => { load() }, [load])

  // Ctrl+V 로 참고 이미지 붙여넣기
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const fobj = it.getAsFile()
          if (fobj) files.push(fobj)
        }
      }
      if (files.length === 0) return
      e.preventDefault()
      const dt = new DataTransfer()
      files.forEach(fl => dt.items.add(fl))
      await addRefImages(dt.files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.reference_images])

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

  // 작업 결과 사진: base64 압축 후 result_images 배열에 누적 저장
  const persistResultImages = async (imgs: string[]) => {
    await supabase.from('denkoshi_jitsugi_problems').upsert(
      { no, result_images: imgs, updated_at: new Date().toISOString() },
      { onConflict: 'no' }
    )
    setProblem(p => p ? { ...p, result_images: imgs } : p)
  }
  const addResultImages = async (files: FileList | null) => {
    if (!files) return
    setImgBusy(true)
    const cur = problem?.result_images ?? []
    const added: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      added.push(await compressToBase64(file))
    }
    if (added.length) await persistResultImages([...cur, ...added])
    if (resultFileRef.current) resultFileRef.current.value = ''
    setImgBusy(false)
  }
  const removeResultImage = async (i: number) => {
    const cur = problem?.result_images ?? []
    await persistResultImages(cur.filter((_, k) => k !== i))
  }

  // 참고 이미지(복선도·시공조건 캡처): 복수 붙여넣기/업로드
  const persistRefImages = async (imgs: string[]) => {
    await supabase.from('denkoshi_jitsugi_problems').upsert(
      { no, reference_images: imgs, updated_at: new Date().toISOString() },
      { onConflict: 'no' }
    )
    setProblem(p => p ? { ...p, reference_images: imgs } : p)
  }
  const addRefImages = async (files: FileList | null) => {
    if (!files) return
    setRefBusy(true)
    const cur = problem?.reference_images ?? []
    const added: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      added.push(await compressToBase64(file))
    }
    if (added.length) await persistRefImages([...cur, ...added])
    if (refFileRef.current) refFileRef.current.value = ''
    setRefBusy(false)
  }
  const removeRefImage = async (i: number) => {
    const cur = problem?.reference_images ?? []
    await persistRefImages(cur.filter((_, k) => k !== i))
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

  // 회차 메모 인라인 수정
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const startEditNote = (a: JitsugiAttempt) => { setEditingNoteId(a.id); setNoteDraft(a.notes ?? '') }
  const saveNote = async (id: string) => {
    await supabase.from('denkoshi_jitsugi_attempts').update({ notes: noteDraft.trim() || null }).eq('id', id)
    setEditingNoteId(null); setNoteDraft('')
    load()
  }

  // 최근 회차 vs 직전 회차 소요시간 차이 (음수=단축)
  const timeDelta = useMemo(() => {
    const durs = attempts.filter(a => a.duration_sec != null).map(a => a.duration_sec as number)
    if (durs.length < 2) return null
    return durs[durs.length - 1] - durs[durs.length - 2]
  }, [attempts])


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

          {/* ── 참고 이미지(좌) + 타이머·채점(우) 2단 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 참고 이미지: 복선도·시공조건 캡처 (복수 붙여넣기/업로드) */}
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">📐 참고 이미지</p>
                  <p className="text-[11px] text-gray-500">복선도·시공조건 · Ctrl+V 또는 업로드</p>
                </div>
                <button onClick={() => refFileRef.current?.click()} disabled={refBusy}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition">
                  {refBusy ? '…' : '+ 추가'}
                </button>
                <input ref={refFileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => addRefImages(e.target.files)} />
              </div>
              {(problem?.reference_images?.length ?? 0) === 0 ? (
                <div className="text-gray-600 text-xs py-8 text-center border border-dashed border-gray-800 rounded-lg">
                  복선도·시공조건을 캡처해<br />Ctrl+V로 붙여넣거나 [+ 추가]
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                  {problem!.reference_images!.map((src, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`참고 ${i + 1}`}
                        className="w-full rounded-lg object-contain bg-gray-950 max-h-72" draggable={false} />
                      <button onClick={() => removeRefImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
                    </div>
                  ))}
                </div>
              )}
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
        </div>

        {/* ── 회차별 기록 (시간 단축 + 자가 메모) ── */}
        <div className="mt-6">
          <div className="bg-gray-900 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">회차별 기록</p>
              {timeDelta != null && (
                <span className={`text-xs font-semibold ${timeDelta < 0 ? 'text-green-400' : timeDelta > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {timeDelta < 0 ? `최근 ${fmtDur(Math.abs(timeDelta))} 단축 ↓` : timeDelta > 0 ? `최근 ${fmtDur(timeDelta)} 증가 ↑` : '직전과 동일'}
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
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
                      <button onClick={() => startEditNote(a)} className="text-gray-600 hover:text-blue-400 text-xs">✏️</button>
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
                    {editingNoteId === a.id ? (
                      <div className="mt-2">
                        <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                          className="w-full bg-gray-900 rounded-lg px-3 py-2 text-sm text-white h-28 resize-none leading-relaxed"
                          placeholder="이번 회차에서 시간을 어디서 단축했는지 / 다음에 줄일 부분…" autoFocus />
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => saveNote(a.id)}
                            className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg font-semibold transition">저장</button>
                          <button onClick={() => { setEditingNoteId(null); setNoteDraft('') }}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition">취소</button>
                        </div>
                      </div>
                    ) : a.notes ? (
                      <p onClick={() => startEditNote(a)}
                        className="text-sm text-gray-200 mt-2 whitespace-pre-wrap leading-relaxed cursor-text hover:bg-gray-800/40 rounded px-1 -mx-1 transition">{a.notes}</p>
                    ) : (
                      <button onClick={() => startEditNote(a)}
                        className="text-xs text-gray-600 hover:text-gray-400 mt-1">+ 메모 추가</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 작업 결과 사진 (슬라이드쇼) ── */}
        <div className="mt-6 bg-gray-900 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">📸 작업 결과 사진</p>
            <button onClick={() => resultFileRef.current?.click()} disabled={imgBusy}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition font-semibold">
              {imgBusy ? '올리는 중…' : '+ 사진 추가'}
            </button>
            <input ref={resultFileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => addResultImages(e.target.files)} />
          </div>

          {(() => {
            const imgs = problem?.result_images ?? []
            if (imgs.length === 0) {
              return <p className="text-gray-600 text-sm py-10 text-center">아직 사진이 없어요. 완성한 작품을 찍어 [+ 사진 추가]로 올려보세요.</p>
            }
            const i = Math.min(photoIdx, imgs.length - 1)
            return (
              <div>
                {/* 큰 사진 */}
                <div className="relative bg-gray-950 rounded-xl overflow-hidden flex items-center justify-center" style={{ minHeight: 280 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgs[i]} alt={`작업결과 ${i + 1}`}
                    className="w-full object-contain max-h-[70vh]" draggable={false} />
                  <button onClick={() => removeResultImage(i)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white text-sm transition">✕</button>
                  {imgs.length > 1 && (
                    <>
                      <button onClick={() => setPhotoIdx((i - 1 + imgs.length) % imgs.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white text-lg transition">‹</button>
                      <button onClick={() => setPhotoIdx((i + 1) % imgs.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 text-white text-lg transition">›</button>
                    </>
                  )}
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full">
                    {i + 1} / {imgs.length}
                  </span>
                </div>
                {/* 썸네일 */}
                {imgs.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {imgs.map((src, k) => (
                      <button key={k} onClick={() => setPhotoIdx(k)}
                        className={`shrink-0 rounded-lg overflow-hidden border-2 transition ${k === i ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`썸네일 ${k + 1}`} className="h-14 w-14 object-cover" draggable={false} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
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
