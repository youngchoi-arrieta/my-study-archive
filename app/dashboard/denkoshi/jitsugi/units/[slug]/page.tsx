'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { compressToBase64 } from '@/lib/imageUtils'
import { getUnit, getCategory } from '@/lib/constants-denkoshi-units'

type SlideImage = { src: string; w: number }   // w = flex 가중치(1~6), 사진별 크기 비율
type Slide = {
  id: string
  unit_slug: string
  images: SlideImage[]
  caption: string | null
  order_num: number
}

function normImages(row: { images?: unknown; src?: string | null }): SlideImage[] {
  if (Array.isArray(row.images) && row.images.length) {
    return (row.images as SlideImage[]).map(im => ({ src: im.src, w: typeof im.w === 'number' ? im.w : 1 }))
  }
  if (row.src) return [{ src: row.src, w: 1 }]
  return []
}

export default function UnitDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const unit = getUnit(slug)
  const cat = getCategory(unit?.category)

  const [slides, setSlides] = useState<Slide[]>([])
  const [idx, setIdx] = useState(0)
  // 연속 붙여넣기 시 최신 상태를 동기적으로 읽기 위한 ref (클로저/배칭 타이밍 버그 방지)
  const slidesRef = useRef<Slide[]>([])
  const idxRef = useRef(0)
  const setSlidesSync = (updater: Slide[] | ((p: Slide[]) => Slide[])) => {
    const next = typeof updater === 'function' ? (updater as (p: Slide[]) => Slide[])(slidesRef.current) : updater
    slidesRef.current = next
    setSlides(next)
    return next
  }
  const setIdxSync = (v: number | ((p: number) => number)) => {
    const next = typeof v === 'function' ? (v as (p: number) => number)(idxRef.current) : v
    idxRef.current = next
    setIdx(next)
  }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft, setCaptionDraft] = useState('')
  const [showUrl, setShowUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchSlides = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_unit_slides')
      .select('*')
      .eq('unit_slug', slug)
      .order('order_num')
    const rows: Slide[] = (data || []).map(r => ({
      id: r.id, unit_slug: r.unit_slug, caption: r.caption, order_num: r.order_num, images: normImages(r),
    }))
    setSlidesSync(rows)
    setIdxSync(Math.max(0, rows.length - 1))   // 마지막 슬라이드부터 (없으면 빈 칸)
    setLoading(false)
  }, [slug])

  useEffect(() => { fetchSlides() }, [fetchSlides])

  const persistImages = async (id: string, images: SlideImage[]) => {
    await supabase.from('denkoshi_unit_slides').update({ images, src: images[0]?.src ?? null }).eq('id', id)
  }

  // 빈 칸에 붙여넣기 → 새 슬라이드, 끝의 빈 칸으로 복귀(연속 붙여넣기)
  const newSlide = useCallback(async (src: string) => {
    setSaving(true)
    const cur = slidesRef.current
    const order = cur.length ? Math.max(...cur.map(s => s.order_num)) + 1 : 0
    const images: SlideImage[] = [{ src, w: 1 }]
    const { data } = await supabase.from('denkoshi_unit_slides')
      .insert({ unit_slug: slug, images, src, caption: null, order_num: order })
      .select().single()
    if (data) {
      const slide: Slide = { id: data.id, unit_slug: data.unit_slug, caption: data.caption, order_num: data.order_num, images }
      const next = setSlidesSync(prev => [...prev, slide])
      setIdxSync(next.length)   // 끝의 빈 칸으로 복귀
    }
    setSaving(false)
  }, [slug])

  // 실제 슬라이드 위에 붙여넣기 → 그 슬라이드에 사진 추가(비교용)
  const addImage = useCallback(async (slideIdx: number, src: string) => {
    setSaving(true)
    const sl = slidesRef.current[slideIdx]
    if (sl) {
      const images = [...sl.images, { src, w: 1 }]
      setSlidesSync(prev => prev.map((s, i) => i === slideIdx ? { ...s, images } : s))
      await persistImages(sl.id, images)
    }
    setSaving(false)
  }, [])

  // 붙여넣기 위치에 따라 분기
  const ingest = useCallback(async (src: string) => {
    // ref로 최신 상태를 읽어 분기 (연속 붙여넣기 시에도 올바른 슬라이드에 추가)
    if (idxRef.current >= slidesRef.current.length) await newSlide(src)
    else await addImage(idxRef.current, src)
  }, [newSlide, addImage])

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const src = await compressToBase64(f)
      await ingest(src)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // 전역 Ctrl+V (캡션 편집 중엔 텍스트 붙여넣기 우선)
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (editingCaption) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile(); if (!f) continue
          e.preventDefault()
          const src = await compressToBase64(f)
          await ingest(src)
          break
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [ingest, editingCaption])

  const addUrl = async () => {
    const u = urlInput.trim(); if (!u) return
    await ingest(u)
    setUrlInput(''); setShowUrl(false)
  }

  // ── 사진별 조작 ───────────────────────────────
  const setImageWidth = async (slideIdx: number, imgIdx: number, w: number) => {
    let id = ''; let images: SlideImage[] = []
    setSlidesSync(prev => {
      const sl = prev[slideIdx]; if (!sl) return prev
      id = sl.id; images = sl.images.map((im, k) => k === imgIdx ? { ...im, w } : im)
      return prev.map((s, i) => i === slideIdx ? { ...s, images } : s)
    })
    if (id) await persistImages(id, images)
  }

  const moveImage = async (slideIdx: number, imgIdx: number, dir: -1 | 1) => {
    const j = imgIdx + dir
    let id = ''; let images: SlideImage[] = []; let ok = true
    setSlidesSync(prev => {
      const sl = prev[slideIdx]; if (!sl) { ok = false; return prev }
      if (j < 0 || j >= sl.images.length) { ok = false; return prev }
      id = sl.id; images = [...sl.images]
      ;[images[imgIdx], images[j]] = [images[j], images[imgIdx]]
      return prev.map((s, i) => i === slideIdx ? { ...s, images } : s)
    })
    if (ok && id) await persistImages(id, images)
  }

  const removeImage = async (slideIdx: number, imgIdx: number) => {
    const sl = slides[slideIdx]; if (!sl) return
    if (sl.images.length <= 1) {
      if (!confirm('이 슬라이드를 삭제할까요?')) return
      await supabase.from('denkoshi_unit_slides').delete().eq('id', sl.id)
      setSlidesSync(prev => { const next = prev.filter((_, i) => i !== slideIdx); setIdxSync(Math.min(slideIdx, next.length)); return next })
      return
    }
    const images = sl.images.filter((_, k) => k !== imgIdx)
    await persistImages(sl.id, images)
    setSlidesSync(prev => prev.map((s, i) => i === slideIdx ? { ...s, images } : s))
  }

  // ── 캡션 / 슬라이드 조작 ──────────────────────
  const editCaptionFor = (i: number) => { setIdxSync(i); setCaptionDraft(slides[i]?.caption || ''); setEditingCaption(true) }

  const saveCaption = async () => {
    const cur = slides[idx]; if (!cur) { setEditingCaption(false); return }
    const cap = captionDraft.trim()
    await supabase.from('denkoshi_unit_slides').update({ caption: cap || null }).eq('id', cur.id)
    setSlidesSync(prev => prev.map((s, i) => i === idx ? { ...s, caption: cap || null } : s))
    setEditingCaption(false)
  }

  const moveSlide = async (dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= slides.length) return
    const a = slides[idx], b = slides[j]
    await Promise.all([
      supabase.from('denkoshi_unit_slides').update({ order_num: b.order_num }).eq('id', a.id),
      supabase.from('denkoshi_unit_slides').update({ order_num: a.order_num }).eq('id', b.id),
    ])
    setSlidesSync(prev => { const next = [...prev]; next[idx] = { ...b, order_num: a.order_num }; next[j] = { ...a, order_num: b.order_num }; return next })
    setIdxSync(j)
  }

  const delSlide = async () => {
    const cur = slides[idx]; if (!cur) return
    if (!confirm('이 슬라이드를 삭제할까요?')) return
    await supabase.from('denkoshi_unit_slides').delete().eq('id', cur.id)
    setSlidesSync(prev => { const next = prev.filter((_, i) => i !== idx); setIdxSync(Math.min(idx, next.length)); return next })
  }

  if (!unit) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8">
        <p className="text-gray-400">없는 단위작업이에요. <Link href="/dashboard/denkoshi/jitsugi/units" className="text-blue-400">← 목록</Link></p>
      </main>
    )
  }
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      </main>
    )
  }

  const onBlank = idx >= slides.length
  const cur = slides[idx]
  const total = slides.length
  const ibtn = 'bg-gray-900/80 hover:bg-gray-700 text-gray-300 hover:text-white w-6 h-6 rounded text-xs flex items-center justify-center transition disabled:opacity-30'

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto p-5 md:p-6">

        {/* 헤더 */}
        <div className="mb-3">
          <Link href="/dashboard/denkoshi/jitsugi/units" className="text-gray-400 hover:text-white text-sm">← 단위작업</Link>
        </div>
        <div className="flex items-start gap-3 mb-1">
          {cat && <span className="text-[11px] px-2 py-0.5 rounded-full mt-1 shrink-0" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.ko}</span>}
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-snug">{unit.titleKo}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{unit.titleJa}</p>
          </div>
          <a href={unit.youtubeUrl} target="_blank" rel="noreferrer" className="ml-auto shrink-0 text-xs text-gray-400 hover:text-white">원본 ↗</a>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600 mb-4">
          {saving && <span className="text-gray-500">저장 중...</span>}
          <span className="bg-gray-800 px-2 py-0.5 rounded">Ctrl+V 이미지 붙여넣기</span>
        </div>

        {/* 본문 */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          {onBlank ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center px-8 py-12 cursor-pointer" onClick={() => fileRef.current?.click()}>
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-300 text-sm font-semibold"><span className="text-blue-400">Ctrl+V</span>로 캡쳐 이미지를 붙여넣으세요</p>
              <p className="text-gray-600 text-xs mt-1.5 leading-relaxed">
                여기(빈 칸)에 붙여넣으면 <span className="text-gray-400">새 슬라이드</span>가 생기고<br />
                빈 칸은 계속 남아있어요 — 연속으로 붙여넣기 가능
              </p>
              <p className="text-gray-700 text-[11px] mt-2 leading-relaxed">
                이미 만든 슬라이드 위에서 붙여넣으면 <span className="text-gray-500">같은 슬라이드에 사진 추가</span>(OK/NG 비교)
              </p>
              {total > 0 && (
                <button onClick={(e) => { e.stopPropagation(); editCaptionFor(total - 1) }}
                  className="mt-4 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
                  직전 슬라이드({total}번)에 캡션 달기 →
                </button>
              )}
              <div className="mt-4 flex items-center gap-3 text-[11px] text-gray-600">
                <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }} className="hover:text-gray-300 transition">파일 선택</button>
                <span>·</span>
                <button onClick={(e) => { e.stopPropagation(); setShowUrl(p => !p) }} className="hover:text-gray-300 transition">URL</button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-800 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>이 슬라이드에 <span className="text-gray-400">Ctrl+V</span>로 사진 추가 (OK/NG 비교)</span>
                <span className="text-gray-700">·</span>
                <span>사진 위 <span className="text-gray-400">−/＋</span> 크기조절</span>
              </div>
              <div className="grid grid-cols-2 gap-2 p-2 bg-black">
                {cur.images.map((im, i) => (
                  <div key={i} className="relative group bg-gray-950 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ gridColumn: im.w >= 2 ? '1 / -1' : 'auto' }}>
                    <img src={im.src} alt="" className="w-full object-contain max-h-[70vh]" draggable={false} />
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => setImageWidth(idx, i, im.w >= 2 ? 1 : 2)} className={ibtn}
                        title={im.w >= 2 ? '2열로' : '한 행 크게'}>{im.w >= 2 ? '−' : '＋'}</button>
                      {cur.images.length > 1 && (
                        <>
                          <button onClick={() => moveImage(idx, i, -1)} disabled={i === 0} className={ibtn} title="앞으로">◀</button>
                          <button onClick={() => moveImage(idx, i, 1)} disabled={i === cur.images.length - 1} className={ibtn} title="뒤로">▶</button>
                        </>
                      )}
                      <button onClick={() => removeImage(idx, i)} className={`${ibtn} hover:bg-red-600`} title="이미지 삭제">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4">
                {editingCaption ? (
                  <div className="space-y-2">
                    <textarea autoFocus value={captionDraft} onChange={e => setCaptionDraft(e.target.value)} rows={4}
                      placeholder="핵심 instruction을 적어주세요 (여러 줄 가능)"
                      className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={saveCaption} className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition">저장</button>
                      <button onClick={() => setEditingCaption(false)} className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition">취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="cursor-pointer" onClick={() => editCaptionFor(idx)} title="클릭해서 캡션 편집">
                    {cur.caption
                      ? <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{cur.caption}</p>
                      : <p className="text-sm text-gray-600 italic">캡션 없음 — 클릭해서 작성</p>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 네비게이션 */}
        <div className="flex items-center justify-center gap-4 my-3">
          <button onClick={() => setIdxSync(i => Math.max(0, i - 1))} disabled={idx === 0}
            className="w-9 h-9 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition text-lg leading-none">‹</button>
          <span className="text-sm text-gray-400 tabular-nums min-w-[64px] text-center">
            {onBlank ? <span className="text-blue-400">＋ 새 칸</span> : `${idx + 1} / ${total}`}
          </span>
          <button onClick={() => setIdxSync(i => Math.min(total, i + 1))} disabled={idx >= total}
            className="w-9 h-9 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition text-lg leading-none">›</button>
        </div>

        {/* 슬라이드 액션 */}
        {!onBlank && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs">
            <button onClick={() => moveSlide(-1)} disabled={idx === 0} className="px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition">◀ 앞으로</button>
            <button onClick={() => moveSlide(1)} disabled={idx === total - 1} className="px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition">뒤로 ▶</button>
            <button onClick={delSlide} className="px-2 py-1 rounded bg-gray-900 hover:bg-red-600 transition">슬라이드 삭제</button>
          </div>
        )}

        {/* 썸네일 + 빈 칸 */}
        <div className="flex gap-2 overflow-x-auto pt-4 border-t border-gray-800">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => setIdxSync(i)}
              className={`relative shrink-0 w-16 h-11 rounded overflow-hidden border ${i === idx ? 'border-blue-500' : 'border-gray-700'}`}>
              {s.images[0] && <img src={s.images[0].src} alt="" className="w-full h-full object-cover" draggable={false} />}
              {s.images.length > 1 && <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl">{s.images.length}</span>}
            </button>
          ))}
          <button onClick={() => setIdxSync(total)}
            className={`shrink-0 w-16 h-11 rounded border border-dashed flex items-center justify-center text-lg transition ${onBlank ? 'border-blue-500 text-blue-400' : 'border-gray-600 text-gray-500 hover:text-white hover:border-gray-400'}`}
            title="빈 칸 — 여기서 Ctrl+V로 새 슬라이드">＋</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
        </div>

        {showUrl && (
          <div className="flex gap-2 mt-2">
            <input autoFocus value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addUrl()}
              placeholder="이미지 URL (https://...)" className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={addUrl} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs transition">추가</button>
          </div>
        )}

      </div>
    </main>
  )
}
