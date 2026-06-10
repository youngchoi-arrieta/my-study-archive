'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type WiringSession = {
  id: string
  title: string
  description: string | null
}

type WiringImage = {
  id: string
  session_id: string
  src: string
  caption: string | null
  order_num: number
}

type WiringQA = {
  id: string
  session_id: string
  question: string
  answer: string | null
  order_num: number
}

export default function WiringDetail() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<WiringSession | null>(null)
  const [images, setImages] = useState<WiringImage[]>([])
  const [qaList, setQaList] = useState<WiringQA[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedIdx, setSelectedIdx] = useState(0)
  const selectImage = (idx: number) => { setSelectedIdx(idx); setZoom(100) }
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [captionInput, setCaptionInput] = useState('')

  // 제목 인라인 편집
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleEdit, setTitleEdit] = useState('')

  // 탭 이름 인라인 편집
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [tabLabelEdit, setTabLabelEdit] = useState('')

  // Q&A
  const [addingQA, setAddingQA] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [expandedQA, setExpandedQA] = useState<string | null>(null)
  const [editingQA, setEditingQA] = useState<string | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')

  const [saving, setSaving] = useState(false)
  const [zoom, setZoom] = useState(100) // 이미지 줌 %
  const [splitPct, setSplitPct] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPct(Math.round(Math.min(75, Math.max(25, pct))))
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const fetchSession = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_wiring_sessions')
      .select('id, title, description')
      .eq('id', sessionId)
      .single()
    setSession(data)
  }, [sessionId])

  const fetchImages = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_wiring_images')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_num')
    setImages(data || [])
  }, [sessionId])

  const fetchQA = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_wiring_qa')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_num')
    setQaList(data || [])
  }, [sessionId])

  useEffect(() => {
    Promise.all([fetchSession(), fetchImages(), fetchQA()])
      .then(() => setLoading(false))
  }, [fetchSession, fetchImages, fetchQA])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()
          const reader = new FileReader()
          reader.onload = async (ev) => {
            const src = ev.target?.result as string
            if (!src) return
            setSaving(true)
            const maxOrder = images.length > 0 ? Math.max(...images.map(i => i.order_num)) + 1 : 0
            const { data } = await supabase.from('denkoshi_wiring_images').insert({
              session_id: sessionId,
              src,
              caption: null,
              order_num: maxOrder,
            }).select().single()
            if (data) {
              setImages(prev => {
                const next = [...prev, data]
                setSelectedIdx(next.length - 1)
                setZoom(100)
                return next
              })
              await supabase.from('denkoshi_wiring_sessions')
                .update({ image_count: images.length + 1 })
                .eq('id', sessionId)
            }
            setSaving(false)
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [sessionId, images])

  const saveTitle = async () => {
    const t = titleEdit.trim()
    if (!t) { setEditingTitle(false); return }
    await supabase.from('denkoshi_wiring_sessions').update({ title: t }).eq('id', sessionId)
    setSession(prev => prev ? { ...prev, title: t } : prev)
    setEditingTitle(false)
  }

  const saveTabLabel = async (id: string) => {
    const label = tabLabelEdit.trim()
    await supabase.from('denkoshi_wiring_images').update({ caption: label || null }).eq('id', id)
    setImages(prev => prev.map(i => i.id === id ? { ...i, caption: label || null } : i))
    setEditingTabId(null)
  }

  const addImageUrl = async () => {
    if (!urlInput.trim()) return
    setSaving(true)
    const maxOrder = images.length > 0 ? Math.max(...images.map(i => i.order_num)) + 1 : 0
    const { data } = await supabase.from('denkoshi_wiring_images').insert({
      session_id: sessionId,
      src: urlInput.trim(),
      caption: captionInput.trim() || null,
      order_num: maxOrder,
    }).select().single()
    if (data) {
      setImages(prev => {
        const next = [...prev, data]
        setSelectedIdx(next.length - 1)
        return next
      })
      await supabase.from('denkoshi_wiring_sessions')
        .update({ image_count: images.length + 1 })
        .eq('id', sessionId)
    }
    setUrlInput('')
    setCaptionInput('')
    setShowUrlInput(false)
    setSaving(false)
  }

  const deleteImage = async (id: string) => {
    if (!confirm('이 이미지를 삭제할까요?')) return
    await supabase.from('denkoshi_wiring_images').delete().eq('id', id)
    setImages(prev => {
      const next = prev.filter(i => i.id !== id)
      if (selectedIdx >= next.length) setSelectedIdx(Math.max(0, next.length - 1))
      return next
    })
    await supabase.from('denkoshi_wiring_sessions')
      .update({ image_count: Math.max(0, images.length - 1) })
      .eq('id', sessionId)
  }

  const addQA = async () => {
    if (!newQ.trim()) return
    setSaving(true)
    const maxOrder = qaList.length > 0 ? Math.max(...qaList.map(q => q.order_num)) + 1 : 0
    const { data } = await supabase.from('denkoshi_wiring_qa').insert({
      session_id: sessionId,
      question: newQ.trim(),
      answer: newA.trim() || null,
      order_num: maxOrder,
    }).select().single()
    if (data) {
      setQaList(prev => [...prev, data])
      setExpandedQA(data.id)
      await supabase.from('denkoshi_wiring_sessions')
        .update({ qa_count: qaList.length + 1 })
        .eq('id', sessionId)
    }
    setNewQ('')
    setNewA('')
    setAddingQA(false)
    setSaving(false)
  }

  const saveQA = async (id: string) => {
    setSaving(true)
    await supabase.from('denkoshi_wiring_qa').update({
      question: editQ.trim(),
      answer: editA.trim() || null,
    }).eq('id', id)
    setQaList(prev => prev.map(q =>
      q.id === id ? { ...q, question: editQ.trim(), answer: editA.trim() || null } : q
    ))
    setEditingQA(null)
    setSaving(false)
  }

  const deleteQA = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('denkoshi_wiring_qa').delete().eq('id', id)
    setQaList(prev => {
      const next = prev.filter(q => q.id !== id)
      supabase.from('denkoshi_wiring_sessions')
        .update({ qa_count: next.length })
        .eq('id', sessionId)
      return next
    })
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-500 text-sm">불러오는 중...</p>
    </main>
  )

  if (!session) return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <p className="text-gray-400">존재하지 않는 세션입니다.</p>
      <button onClick={() => router.back()} className="text-blue-400 mt-4 text-sm">← 돌아가기</button>
    </main>
  )

  const currentImage = images[selectedIdx]

  return (
    <main className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* 헤더 */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-800 shrink-0 flex items-center gap-3">
        <Link href="/dashboard/denkoshi/wiring" className="text-gray-500 hover:text-white text-sm shrink-0">
          ← 목록
        </Link>

        {editingTitle ? (
          <input
            autoFocus
            value={titleEdit}
            onChange={e => setTitleEdit(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
            onBlur={saveTitle}
            className="text-sm font-bold bg-gray-800 border border-gray-600 rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-500 flex-1 min-w-0"
          />
        ) : (
          <h1
            className="text-sm font-bold truncate cursor-pointer hover:text-blue-400 transition group flex items-center gap-1.5"
            onClick={() => { setTitleEdit(session.title); setEditingTitle(true) }}
            title="클릭해서 제목 편집"
          >
            {session.title}
            <span className="text-gray-700 text-[10px] opacity-0 group-hover:opacity-100 transition">✏</span>
          </h1>
        )}

        <div className="ml-auto flex items-center gap-4">
          {saving && <span className="text-xs text-gray-500">저장 중...</span>}
          <span className="text-xs text-gray-600">
            {images.length > 0 && `📷 ${images.length}`}
            {images.length > 0 && qaList.length > 0 && '  '}
            {qaList.length > 0 && `❓ ${qaList.length}문`}
          </span>
          <span className="text-xs text-gray-700 bg-gray-800 px-2 py-0.5 rounded">Ctrl+V 이미지 붙여넣기</span>
        </div>
      </div>

      {/* 본문 */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden select-none">

        {/* 좌: 이미지 패널 */}
        <div className="flex flex-col border-r border-gray-800 overflow-hidden" style={{ width: `${splitPct}%` }}>

          {/* 탭 바 + 줌 컨트롤 */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-800 bg-gray-900 shrink-0 overflow-x-auto">
            {images.map((img, idx) => (
              <div key={img.id} className="shrink-0">
                {editingTabId === img.id ? (
                  <input
                    autoFocus
                    value={tabLabelEdit}
                    onChange={e => setTabLabelEdit(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTabLabel(img.id)
                      if (e.key === 'Escape') setEditingTabId(null)
                    }}
                    onBlur={() => saveTabLabel(img.id)}
                    placeholder={`도면 ${idx + 1}`}
                    className="px-2 py-1 rounded-lg text-xs bg-gray-700 border border-blue-500 text-white outline-none w-24"
                  />
                ) : (
                  <button
                    onClick={() => selectImage(idx)}
                    onDoubleClick={() => { setEditingTabId(img.id); setTabLabelEdit(img.caption || '') }}
                    title="더블클릭으로 이름 편집"
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs transition ${
                      idx === selectedIdx ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {img.caption || `도면 ${idx + 1}`}
                    {idx === selectedIdx && (
                      <span
                        className="text-[9px] opacity-50 hover:opacity-100 cursor-pointer ml-0.5"
                        onClick={e => { e.stopPropagation(); setEditingTabId(img.id); setTabLabelEdit(img.caption || '') }}
                      >✏</span>
                    )}
                  </button>
                )}
              </div>
            ))}
            <div className="shrink-0 flex gap-1 ml-auto items-center">
              {/* 줌 컨트롤 */}
              {images.length > 0 && (
                <div className="flex items-center gap-1 mr-2 border-r border-gray-700 pr-2">
                  <button onClick={() => setZoom(z => Math.max(30, z - 10))}
                    className="text-gray-400 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-gray-700 transition font-bold text-sm">−</button>
                  <input type="range" min={30} max={200} step={5} value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    className="w-20 accent-blue-500" />
                  <button onClick={() => setZoom(z => Math.min(200, z + 10))}
                    className="text-gray-400 hover:text-white w-5 h-5 flex items-center justify-center rounded hover:bg-gray-700 transition font-bold text-sm">+</button>
                  <button onClick={() => setZoom(100)}
                    className={`text-[10px] w-8 text-center rounded transition tabular-nums ${zoom !== 100 ? 'text-blue-400 hover:text-blue-300' : 'text-gray-600'}`}
                  >{zoom}%</button>
                </div>
              )}
              <button
                onClick={() => setShowUrlInput(p => !p)}
                className="text-xs text-gray-500 hover:text-white px-2 py-1 bg-gray-800 rounded-lg transition"
              >
                + URL
              </button>
            </div>
          </div>

          {/* URL 입력 */}
          {showUrlInput && (
            <div className="px-3 py-2 border-b border-gray-800 bg-gray-900 space-y-1.5 shrink-0">
              <input
                autoFocus
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="이미지 URL (https://...)"
                className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={captionInput}
                  onChange={e => setCaptionInput(e.target.value)}
                  placeholder="탭 이름 (예: 1층 배선도)"
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button onClick={addImageUrl} disabled={saving || !urlInput.trim()}
                  className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
                >추가</button>
                <button onClick={() => setShowUrlInput(false)}
                  className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition"
                >취소</button>
              </div>
            </div>
          )}

          {/* 이미지 뷰어 */}
          {currentImage ? (
            <div className="flex-1 overflow-auto bg-gray-950 flex justify-center items-start relative">
              <img
                src={currentImage.src}
                alt={currentImage.caption || `도면 ${selectedIdx + 1}`}
                style={{ width: `${zoom}%` }}
                className="object-contain"
                draggable={false}
              />
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  onClick={() => { setEditingTabId(currentImage.id); setTabLabelEdit(currentImage.caption || '') }}
                  className="bg-gray-900/80 hover:bg-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded text-xs transition"
                >탭 이름 ✏</button>
                <button
                  onClick={() => deleteImage(currentImage.id)}
                  className="bg-gray-900/80 hover:bg-red-600 text-gray-400 hover:text-white px-2 py-1 rounded text-xs transition"
                >삭제</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-5xl">📋</p>
              <p className="text-gray-400 text-sm font-semibold">배선도 이미지를 추가하세요</p>
              <p className="text-gray-600 text-xs leading-relaxed">
                <span className="font-bold text-gray-400">Ctrl+V</span>로 클립보드 이미지를 바로 붙여넣거나<br />
                상단 <span className="font-bold text-gray-400">+ URL</span>을 클릭해 이미지 링크를 입력하세요
              </p>
            </div>
          )}
        </div>

        {/* 분할선 */}
        <div
          className="w-1.5 cursor-col-resize bg-gray-800 hover:bg-blue-600/60 active:bg-blue-500 transition-colors shrink-0 flex items-center justify-center group"
          onMouseDown={onDividerMouseDown}
        >
          <div className="w-px h-8 bg-gray-600 group-hover:bg-blue-400 rounded-full" />
        </div>

        {/* 우: Q&A 패널 */}
        <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>

          <div className="px-4 py-2.5 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">배선도 분석 Q&amp;A</span>
            <button
              onClick={() => setAddingQA(p => !p)}
              className={`text-xs px-3 py-1 rounded-lg transition ${
                addingQA ? 'bg-gray-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {addingQA ? '닫기' : '+ 소문제 추가'}
            </button>
          </div>

          {addingQA && (
            <div className="border-b border-gray-800 bg-gray-900 p-4 space-y-2.5 shrink-0">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">질문 *</label>
                <textarea
                  autoFocus
                  value={newQ}
                  onChange={e => setNewQ(e.target.value)}
                  placeholder="예: 이 배선도에서 사용된 전선관의 종류와 선정 이유를 기술하라"
                  rows={3}
                  className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">나의 답 (선택)</label>
                <textarea
                  value={newA}
                  onChange={e => setNewA(e.target.value)}
                  placeholder="여기에 분석 내용을 작성하세요..."
                  rows={4}
                  className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addQA} disabled={saving || !newQ.trim()}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '추가'}
                </button>
                <button onClick={() => { setAddingQA(false); setNewQ(''); setNewA('') }}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition"
                >취소</button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {qaList.length === 0 && !addingQA && (
              <div className="text-center py-20">
                <p className="text-gray-600 text-sm">아직 분석 문제가 없습니다.</p>
                <p className="text-gray-700 text-xs mt-1">우측 상단 &apos;+ 소문제 추가&apos;로 자문자답을 시작해보세요.</p>
              </div>
            )}

            {qaList.map((qa, idx) => {
              const isExpanded = expandedQA === qa.id
              const isEditing = editingQA === qa.id
              return (
                <div key={qa.id} className="bg-gray-900 rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-800 transition"
                    onClick={() => { if (!isEditing) setExpandedQA(isExpanded ? null : qa.id) }}
                  >
                    <span className="text-blue-400 font-bold text-sm shrink-0 pt-0.5">({idx + 1})</span>
                    <p className="flex-1 text-sm text-gray-200 leading-relaxed">{qa.question}</p>
                    <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                      {qa.answer && <span className="text-[10px] text-green-600 mr-1">✓답</span>}
                      <button
                        onClick={() => { setEditingQA(qa.id); setExpandedQA(qa.id); setEditQ(qa.question); setEditA(qa.answer || '') }}
                        className="text-gray-600 hover:text-white text-xs px-1.5 py-0.5 rounded transition"
                      >✏</button>
                      <button
                        onClick={() => deleteQA(qa.id)}
                        className="text-gray-700 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition"
                      >✕</button>
                      <span className="text-gray-600 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-3">
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">질문</label>
                            <textarea
                              value={editQ}
                              onChange={e => setEditQ(e.target.value)}
                              rows={3}
                              className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">나의 답</label>
                            <textarea
                              autoFocus
                              value={editA}
                              onChange={e => setEditA(e.target.value)}
                              rows={6}
                              className="w-full bg-gray-800 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveQA(qa.id)} disabled={saving}
                              className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                            >{saving ? '...' : '저장'}</button>
                            <button onClick={() => setEditingQA(null)}
                              className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition"
                            >취소</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {qa.answer ? (
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{qa.answer}</p>
                          ) : (
                            <button
                              onClick={() => { setEditingQA(qa.id); setEditQ(qa.question); setEditA('') }}
                              className="text-xs text-gray-600 hover:text-blue-400 italic transition"
                            >
                              아직 답변 없음 — 클릭해서 작성하기
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
