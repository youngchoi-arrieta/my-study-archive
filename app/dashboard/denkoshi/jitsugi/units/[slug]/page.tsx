'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { compressToBase64 } from '@/lib/imageUtils'
import { getUnit, getCategory } from '@/lib/constants-denkoshi-units'

type Slide = {
  id: string
  unit_slug: string
  src: string
  caption: string | null
  order_num: number
}

export default function UnitDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const unit = getUnit(slug)
  const cat = getCategory(unit?.category)

  const [slides, setSlides] = useState<Slide[]>([])
  const [idx, setIdx] = useState(0)
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
    setSlides(data || [])
    setLoading(false)
  }, [slug])

  useEffect(() => { fetchSlides() }, [fetchSlides])

  const addSlide = useCallback(async (src: string, caption = '') => {
    setSaving(true)
    const order = slides.length ? Math.max(...slides.map(s => s.order_num)) + 1 : 0
    const { data } = await supabase
      .from('denkoshi_unit_slides')
      .insert({ unit_slug: slug, src, caption: caption || null, order_num: order })
      .select()
      .single()
    if (data) setSlides(prev => { const next = [...prev, data]; setIdx(next.length - 1); return next })
    setSaving(false)
  }, [slides, slug])

  // 파일 업로드 (다중)
  const onFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const src = await compressToBase64(f)
      await addSlide(src)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // Ctrl+V 붙여넣기
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (editingCaption) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (!f) continue
          e.preventDefault()
          const src = await compressToBase64(f)
          await addSlide(src)
          break
        }
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addSlide, editingCaption])

  const addUrl = async () => {
    const u = urlInput.trim()
    if (!u) return
    await addSlide(u)
    setUrlInput('')
    setShowUrl(false)
  }

  const saveCaption = async () => {
    const cur = slides[idx]
    if (!cur) return
    const cap = captionDraft.trim()
    await supabase.from('denkoshi_unit_slides').update({ caption: cap || null }).eq('id', cur.id)
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, caption: cap || null } : s))
    setEditingCaption(false)
  }

  // 순서 변경 (이웃과 order_num 스왑)
  const move = async (dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= slides.length) return
    const a = slides[idx], b = slides[j]
    await Promise.all([
      supabase.from('denkoshi_unit_slides').update({ order_num: b.order_num }).eq('id', a.id),
      supabase.from('denkoshi_unit_slides').update({ order_num: a.order_num }).eq('id', b.id),
    ])
    setSlides(prev => {
      const next = [...prev]
      next[idx] = { ...b, order_num: a.order_num }
      next[j] = { ...a, order_num: b.order_num }
      return next
    })
    setIdx(j)
  }

  const del = async () => {
    const cur = slides[idx]
    if (!cur) return
    if (!confirm('이 슬라이드를 삭제할까요?')) return
    await supabase.from('denkoshi_unit_slides').delete().eq('id', cur.id)
    setSlides(prev => {
      const next = prev.filter((_, i) => i !== idx)
      if (idx >= next.length) setIdx(Math.max(0, next.length - 1))
      return next
    })
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

  const cur = slides[idx]

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto p-5 md:p-6">

        {/* 헤더 */}
        <div className="mb-3">
          <Link href="/dashboard/denkoshi/jitsugi/units" className="text-gray-400 hover:text-white text-sm">← 단위작업</Link>
        </div>
        <div className="flex items-start gap-3 mb-1">
          {cat && (
            <span className="text-[11px] px-2 py-0.5 rounded-full mt-1 shrink-0" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.ko}</span>
          )}
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
        {slides.length === 0 || !cur ? (
          <div className="bg-gray-900 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">🖼️</p>
            <p className="text-gray-400 text-sm font-semibold">아직 슬라이드가 없어요</p>
            <p className="text-gray-600 text-xs mt-1 leading-relaxed">
              동영상에서 캡쳐한 이미지를 <span className="text-gray-400 font-bold">Ctrl+V</span>로 붙여넣거나<br />
              아래 <span className="text-gray-400 font-bold">+ 이미지 추가</span>로 업로드하세요
            </p>
          </div>
        ) : (
          <>
            {/* 슬라이드 (이미지 + 캡션) */}
            <div className="bg-gray-900 rounded-2xl overflow-hidden">
              <div className="bg-black flex items-center justify-center" style={{ minHeight: 240 }}>
                <img src={cur.src} alt={cur.caption || unit.titleKo} className="max-h-[60vh] w-full object-contain" draggable={false} />
              </div>
              <div className="p-4">
                {editingCaption ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={captionDraft}
                      onChange={e => setCaptionDraft(e.target.value)}
                      rows={4}
                      placeholder="핵심 instruction을 적어주세요 (여러 줄 가능)"
                      className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveCaption} className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition">저장</button>
                      <button onClick={() => setEditingCaption(false)} className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition">취소</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="cursor-pointer"
                    onClick={() => { setCaptionDraft(cur.caption || ''); setEditingCaption(true) }}
                    title="클릭해서 캡션 편집"
                  >
                    {cur.caption
                      ? <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{cur.caption}</p>
                      : <p className="text-sm text-gray-600 italic">캡션 없음 — 클릭해서 작성</p>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* 네비게이션 */}
            <div className="flex items-center justify-center gap-4 my-3">
              <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                className="w-9 h-9 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition text-lg leading-none">‹</button>
              <span className="text-sm text-gray-400 tabular-nums min-w-[56px] text-center">{idx + 1} / {slides.length}</span>
              <button onClick={() => setIdx(i => Math.min(slides.length - 1, i + 1))} disabled={idx === slides.length - 1}
                className="w-9 h-9 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition text-lg leading-none">›</button>
            </div>

            {/* 슬라이드 액션 */}
            <div className="flex items-center justify-center gap-2 mb-4 text-xs">
              <button onClick={() => move(-1)} disabled={idx === 0} className="px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition">◀ 앞으로</button>
              <button onClick={() => move(1)} disabled={idx === slides.length - 1} className="px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 disabled:opacity-30 transition">뒤로 ▶</button>
              <button onClick={del} className="px-2 py-1 rounded bg-gray-900 hover:bg-red-600 transition">삭제</button>
            </div>
          </>
        )}

        {/* 썸네일 + 추가 */}
        <div className="flex gap-2 overflow-x-auto pt-4 border-t border-gray-800">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setIdx(i)}
              className={`shrink-0 w-16 h-11 rounded overflow-hidden border ${i === idx ? 'border-blue-500' : 'border-gray-700'}`}
            >
              <img src={s.src} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 min-w-[110px] h-11 rounded border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 text-xs transition flex items-center justify-center"
          >+ 이미지 추가</button>
          <button
            onClick={() => setShowUrl(p => !p)}
            className="shrink-0 h-11 px-3 rounded border border-dashed border-gray-700 text-gray-500 hover:text-white text-xs transition"
          >URL</button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onFiles(e.target.files)} />
        </div>

        {showUrl && (
          <div className="flex gap-2 mt-2">
            <input
              autoFocus
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUrl()}
              placeholder="이미지 URL (https://...)"
              className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={addUrl} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs transition">추가</button>
          </div>
        )}

      </div>
    </main>
  )
}
