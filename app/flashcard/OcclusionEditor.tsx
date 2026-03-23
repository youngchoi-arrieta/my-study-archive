'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type OcclusionBlock = { id: string; x: number; y: number; w: number; h: number; color: string }
export type OcclusionData = { imageUrl: string; blocks: OcclusionBlock[] }

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899']

function randomId() { return Math.random().toString(36).slice(2, 8) }

export function OcclusionEditor({ data, onChange }: {
  data: OcclusionData
  onChange: (d: OcclusionData) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeColor, setActiveColor] = useState(COLORS[0])
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const getRelPos = (e: React.MouseEvent | MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((e as MouseEvent).clientX - rect.left) / rect.width * 100,
      y: ((e as MouseEvent).clientY - rect.top) / rect.height * 100,
    }
  }

  const uploadImage = async (file: File) => {
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `occlusion/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('card-images').upload(path, file, { upsert: true })
    if (error) { alert('업로드 실패'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('card-images').getPublicUrl(path)
    onChange({ ...data, imageUrl: urlData.publicUrl })
    setUploading(false)
  }

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
    if (item) { e.preventDefault(); uploadImage(item.getAsFile()!) }
  }, [data, onChange])

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && e.target !== imgRef.current) return
    setSelectedId(null)
    const pos = getRelPos(e)
    setDrawing(pos)
    setCurrentRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return
    const pos = getRelPos(e)
    setCurrentRect({
      x: Math.min(drawing.x, pos.x),
      y: Math.min(drawing.y, pos.y),
      w: Math.abs(pos.x - drawing.x),
      h: Math.abs(pos.y - drawing.y),
    })
  }

  const onMouseUp = () => {
    if (drawing && currentRect && currentRect.w > 1 && currentRect.h > 1) {
      const newBlock: OcclusionBlock = { id: randomId(), ...currentRect, color: activeColor }
      onChange({ ...data, blocks: [...data.blocks, newBlock] })
    }
    setDrawing(null)
    setCurrentRect(null)
  }

  const deleteBlock = (id: string) => {
    onChange({ ...data, blocks: data.blocks.filter(b => b.id !== id) })
    setSelectedId(null)
  }

  const startDragBlock = (e: React.MouseEvent, blockId: string, action: 'move' | 'resize') => {
    e.stopPropagation()
    setSelectedId(blockId)
    const block = data.blocks.find(b => b.id === blockId)!
    const startPos = getRelPos(e)
    const orig = { ...block }

    const onMove = (ev: MouseEvent) => {
      const p = getRelPos(ev)
      const dx = p.x - startPos.x, dy = p.y - startPos.y
      const updated = data.blocks.map(b => b.id !== blockId ? b : action === 'move'
        ? { ...b, x: Math.max(0, Math.min(95, orig.x + dx)), y: Math.max(0, Math.min(95, orig.y + dy)) }
        : { ...b, w: Math.max(2, orig.w + dx), h: Math.max(2, orig.h + dy) }
      )
      onChange({ ...data, blocks: updated })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button key={c} onClick={() => setActiveColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition ${activeColor === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
        </div>
        <label className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition">
          {uploading ? '⏳ 업로드 중...' : '🖼 이미지 선택'}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
        </label>
        <span className="text-gray-500 text-xs">또는 Ctrl+V</span>
        {data.blocks.length > 0 && (
          <button onClick={() => onChange({ ...data, blocks: [] })}
            className="text-gray-600 hover:text-red-400 text-xs ml-auto">전체 삭제</button>
        )}
      </div>

      {/* 캔버스 */}
      {data.imageUrl ? (
        <div
          ref={containerRef}
          className="relative select-none cursor-crosshair rounded-xl overflow-hidden border border-gray-700"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <img ref={imgRef} src={data.imageUrl} className="w-full block pointer-events-none" alt="" draggable={false} />

          {/* 기존 블록 */}
          {data.blocks.map(block => (
            <div key={block.id}
              className={`absolute border-2 cursor-move ${selectedId === block.id ? 'border-white' : 'border-transparent'}`}
              style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.w}%`, height: `${block.h}%`, background: block.color }}
              onMouseDown={e => startDragBlock(e, block.id, 'move')}
            >
              {selectedId === block.id && (
                <>
                  <button className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center z-10"
                    onMouseDown={e => { e.stopPropagation(); deleteBlock(block.id) }}>✕</button>
                  <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-white opacity-80 z-10"
                    onMouseDown={e => startDragBlock(e, block.id, 'resize')} />
                </>
              )}
            </div>
          ))}

          {/* 그리는 중인 사각형 */}
          {currentRect && currentRect.w > 0 && (
            <div className="absolute pointer-events-none border-2 border-white"
              style={{ left: `${currentRect.x}%`, top: `${currentRect.y}%`, width: `${currentRect.w}%`, height: `${currentRect.h}%`, background: activeColor + '99' }} />
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-700 rounded-xl h-48 flex flex-col items-center justify-center text-gray-500 text-sm gap-2 cursor-pointer"
          onClick={() => fileRef.current?.click()}>
          <span className="text-3xl">🖼</span>
          <span>이미지를 클릭으로 선택하거나 Ctrl+V로 붙여넣기</span>
        </div>
      )}
      <p className="text-xs text-gray-500">드래그로 가릴 영역 그리기 · 블록 클릭 후 이동/리사이즈/삭제</p>
    </div>
  )
}

export function OcclusionView({ data, revealed, activeColor }: {
  data: OcclusionData
  revealed?: boolean
  activeColor?: string  // 이 색상만 가림, 나머지는 반투명 힌트
}) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700">
      <img src={data.imageUrl} className="w-full block" alt="" />
      {data.blocks.map(block => {
        const isActive = !activeColor || block.color === activeColor
        if (!isActive) {
          // 다른 그룹: 항상 연하게 표시 (힌트)
          return (
            <div key={block.id}
              className="absolute"
              style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.w}%`, height: `${block.h}%`, background: block.color + '40' }}
            />
          )
        }
        // 현재 그룹: revealed면 사라짐
        if (revealed) return null
        return (
          <div key={block.id}
            className="absolute"
            style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.w}%`, height: `${block.h}%`, background: block.color }}
          />
        )
      })}
    </div>
  )
}
