'use client'

import { STATUS_META, SLOT_META, SLOTS, familyColor, type UnitStatus } from '@/lib/constants-armory'
import { STAGE_META, digestState, filePath, stageOf, type Revision } from '@/lib/armory'

// 병기고 화면 곳곳에서 같이 쓰는 작은 표시들

export function StatusBadge({ status }: { status: UnitStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="text-[10px] rounded-full px-2 py-0.5 leading-none border"
      style={{ color: m.color, borderColor: m.color + '55' }}>
      {m.dot} {m.label}
    </span>
  )
}

export function FamilyChip({ family }: { family: string | null }) {
  if (!family) return <span className="text-[10px] text-gray-600">계열 없음</span>
  const c = familyColor(family)
  return <span className="text-[10px] rounded px-1.5 py-0.5 leading-none" style={{ color: c, background: c + '1a' }}>{family}</span>
}

export function StageChip({ rev }: { rev: Revision | null }) {
  if (!rev) return <span className="text-[10px] text-gray-600">리비전 없음</span>
  const s = stageOf(rev)
  const m = STAGE_META[s]
  const d = digestState(rev)
  return (
    <span className="text-[10px] rounded-full px-2 py-0.5 leading-none font-medium"
      style={{ color: m.color, background: m.color + '1f' }}>
      {m.label}
      {s === 'digesting' && <span className="opacity-70"> {d.done}/{d.total}</span>}
      {s === 'released' && <span className="opacity-70"> {rev.releases.length}회</span>}
    </span>
  )
}

// ▶ 📦 📐 — 세 칸이 채워졌는지 한눈에
export function SlotDots({ rev }: { rev: Revision | null }) {
  return (
    <span className="inline-flex gap-1">
      {SLOTS.map(s => {
        const on = !!filePath(rev, s)
        return (
          <span key={s} title={`${SLOT_META[s].label} ${on ? '있음' : '없음'}`}
            className={`text-[11px] w-6 h-6 rounded-md grid place-items-center border ${on
              ? 'border-blue-500/40 bg-blue-500/10' : 'border-gray-800 bg-gray-950 opacity-35 grayscale'}`}>
            {SLOT_META[s].icon}
          </span>
        )
      })}
    </span>
  )
}
