'use client'

import type { BlankAnswer, ContactType } from '@/types/trainer'
import { getSymSvg, TYPE_LABEL } from '@/lib/trainer/symbols'

interface Props {
  palette: BlankAnswer[]
  selectedId: string | null
  onSelect: (a: BlankAnswer) => void
  userAnswer?: BlankAnswer
}

// 접점 종류별 색상
const TYPE_COLOR: Record<ContactType, { bg: string; border: string; text: string; selBg: string; selBorder: string }> = {
  NO:   { bg:'#f0fdf4', border:'#86efac', text:'#15803d', selBg:'#dcfce7', selBorder:'#16a34a' },
  NC:   { bg:'#fffbeb', border:'#fcd34d', text:'#92400e', selBg:'#fef3c7', selBorder:'#d97706' },
  tNO:  { bg:'#eff6ff', border:'#93c5fd', text:'#1e40af', selBg:'#dbeafe', selBorder:'#2563eb' },
  tNC:  { bg:'#faf5ff', border:'#c4b5fd', text:'#6d28d9', selBg:'#ede9fe', selBorder:'#7c3aed' },
  coil: { bg:'#fff1f2', border:'#fda4af', text:'#be123c', selBg:'#ffe4e6', selBorder:'#e11d48' },
}

export default function Palette({ palette, selectedId, onSelect, userAnswer }: Props) {
  if (!selectedId) {
    return (
      <div style={{ padding:'10px 16px', borderTop:'1px solid #e5e7eb', background:'#f9fafb', flexShrink:0 }}>
        <p style={{ fontSize:11, color:'#9ca3af' }}>도면의 빈칸(?)을 클릭하세요</p>
      </div>
    )
  }

  return (
    <div style={{ borderTop:'1px solid #e5e7eb', background:'#f9fafb', flexShrink:0 }}>
      {/* 선택된 답 표시 */}
      <div style={{ padding:'6px 16px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, color:'#6b7280' }}>접점 선택</span>
        {userAnswer && (
          <span style={{ fontSize:11, color:'#16a34a', fontWeight:700 }}>
            ✓ {userAnswer.label} {TYPE_LABEL[userAnswer.type]}
          </span>
        )}
      </div>

      {/* 팔레트 — 접점 종류별로 그룹 */}
      <div style={{ padding:'8px 16px', overflowX:'auto' }}>
        <div style={{ display:'flex', gap:6, flexWrap:'nowrap', minWidth:'max-content' }}>
          {palette.map((a, i) => {
            const c = TYPE_COLOR[a.type]
            const isSel = userAnswer?.label === a.label && userAnswer?.type === a.type
            return (
              <button
                key={i}
                onClick={() => onSelect(a)}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                  padding:'6px 10px', minWidth:72,
                  border:`1.5px solid ${isSel ? c.selBorder : c.border}`,
                  borderRadius:8,
                  background: isSel ? c.selBg : c.bg,
                  cursor:'pointer',
                  outline: isSel ? `2px solid ${c.selBorder}` : 'none',
                  outlineOffset: 1,
                  transition:'all .1s',
                }}
              >
                {/* 심볼 — 실제 도면과 동일한 크기로 */}
                <div
                  dangerouslySetInnerHTML={{ __html: getSymSvg(a.type, c.text) }}
                  style={{ lineHeight:0 }}
                />
                {/* 라벨 */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:c.text, fontFamily:'var(--font-mono)' }}>
                    {a.label}
                  </span>
                  <span style={{ fontSize:9, color:c.text, opacity:0.75 }}>
                    {TYPE_LABEL[a.type]}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
