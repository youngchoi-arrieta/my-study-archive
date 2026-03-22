'use client'

import Image from 'next/image'
import type { BlankBox, BlankAnswer } from '@/types/trainer'
import { getSymSvg, TYPE_LABEL } from '@/lib/trainer/symbols'

interface Props {
  imagePath: string
  imageW: number
  imageH: number
  blanks: BlankBox[]
  answers?: Record<string, BlankAnswer>
  checked?: boolean
  onClickBlank?: (id: string) => void
  selectedId?: string | null
  editMode?: boolean
  onDragCreate?: (box: { x: number; y: number; w: number; h: number }) => void
  onClickBlankEdit?: (id: string) => void
  selectedEditId?: string | null
}

export default function CircuitCanvas({
  imagePath, imageW, imageH, blanks,
  answers, checked, onClickBlank, selectedId,
  editMode, onDragCreate, onClickBlankEdit, selectedEditId,
}: Props) {

  let dragStart: { x: number; y: number } | null = null
  let dragRect: HTMLDivElement | null = null

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editMode || !onDragCreate) return
    if ((e.target as HTMLElement).closest('[data-blank]')) return
    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width * 100
    const y = (e.clientY - rect.top) / rect.height * 100
    dragStart = { x, y }

    dragRect = document.createElement('div')
    dragRect.style.cssText = `position:absolute;border:2px dashed #3b82f6;background:rgba(59,130,246,0.1);pointer-events:none;z-index:50;border-radius:3px;`
    container.appendChild(dragRect)

    const onMove = (me: MouseEvent) => {
      if (!dragStart || !dragRect) return
      const cr = container.getBoundingClientRect()
      const cx = (me.clientX - cr.left) / cr.width * 100
      const cy = (me.clientY - cr.top) / cr.height * 100
      dragRect.style.left = Math.min(dragStart.x, cx) + '%'
      dragRect.style.top = Math.min(dragStart.y, cy) + '%'
      dragRect.style.width = Math.abs(cx - dragStart.x) + '%'
      dragRect.style.height = Math.abs(cy - dragStart.y) + '%'
    }

    const onUp = (ue: MouseEvent) => {
      if (!dragStart || !dragRect) return
      const cr = container.getBoundingClientRect()
      const cx = (ue.clientX - cr.left) / cr.width * 100
      const cy = (ue.clientY - cr.top) / cr.height * 100
      const lx = Math.min(dragStart.x, cx)
      const ly = Math.min(dragStart.y, cy)
      const lw = Math.abs(cx - dragStart.x)
      const lh = Math.abs(cy - dragStart.y)
      dragRect.remove(); dragRect = null; dragStart = null
      if (lw > 0.5 && lh > 0.5) onDragCreate({ x: lx, y: ly, w: lw, h: lh })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    // 편집기/학습화면 동일하게: width:100%, height:auto
    // → blank % 좌표가 항상 동일하게 매핑됨
    <div
      style={{ position: 'relative', display: 'block', width: '100%', cursor: editMode ? 'crosshair' : 'default' }}
      onMouseDown={handleMouseDown}
    >
      <Image
        src={imagePath} alt="시퀀스 회로도"
        width={imageW} height={imageH}
        style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }}
        draggable={false} priority
      />

      {blanks.map(b => {
        const val = answers?.[b.id]
        const isSel = selectedId === b.id || selectedEditId === b.id

        let border = '1.5px dashed #16a34a'
        let bg = '#14532d'

        if (isSel && !editMode) { border = '2px solid #22c55e'; bg = '#166534' }
        if (val && !editMode) { bg = '#14532d' }
        if (checked && val) {
          const ok = val.label === b.answer.label && val.type === b.answer.type
          border = ok ? '2px solid #22c55e' : '2px solid #ef4444'
          bg = ok ? '#14532d' : '#7f1d1d'
        }
        if (checked && !val) { border = '2px solid #ef4444'; bg = '#7f1d1d' }
        if (editMode) {
          border = isSel ? '2px solid #f59e0b' : '1.5px solid #3b82f6'
          bg = isSel ? '#292000' : '#1e3a5f'
        }

        return (
          <div
            key={b.id}
            data-blank="1"
            onClick={e => {
              e.stopPropagation()
              if (editMode) onClickBlankEdit?.(b.id)
              else onClickBlank?.(b.id)
            }}
            style={{
              position: 'absolute',
              left: `${b.x}%`, top: `${b.y}%`,
              width: `${b.w}%`, height: `${b.h}%`,
              border, background: bg,
              borderRadius: 3, cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 10, transition: 'border-color .12s',
              userSelect: 'none', overflow: 'hidden',
            }}
          >
            {editMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <div style={{ color: isSel ? '#fbbf24' : '#93c5fd', fontSize: 8, fontWeight: 700, lineHeight: 1 }}>
                  {b.answer.label}
                </div>
                <div style={{ color: isSel ? '#fcd34d' : '#60a5fa', fontSize: 7, lineHeight: 1 }}>
                  {TYPE_LABEL[b.answer.type]}
                </div>
              </div>
            ) : val ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, width: '100%', height: '100%' }}>
                <div
                  dangerouslySetInnerHTML={{ __html: getSymSvg(val.type) }}
                  style={{ color: '#4ade80', lineHeight: 0, transform: 'scale(0.7)', transformOrigin: 'center' }}
                />
                <div style={{ color: '#4ade80', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
                  {val.label}
                </div>
              </div>
            ) : (
              <span style={{ color: isSel ? '#22c55e' : '#4ade80', fontSize: 16, fontWeight: 700 }}>?</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
