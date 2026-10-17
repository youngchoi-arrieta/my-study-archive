'use client'

// 태그 칩 하나. on=켜짐(색 채움) / off=테두리만 / pending=아직 없는 새 태그(점선)
export default function TagChip({
  label, color, on = true, pending = false, count, onClick, title, small = false,
}: {
  label: string
  color: string
  on?: boolean
  pending?: boolean
  count?: number
  onClick?: () => void
  title?: string
  small?: boolean
}) {
  const size = small ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2.5 py-1'
  const style = pending
    ? { borderColor: color, color, borderStyle: 'dashed' as const }
    : on
      ? { backgroundColor: color + '26', borderColor: color + '80', color }
      : { borderColor: '#1f2937', color: '#6b7280' }
  const cls = `inline-flex items-center gap-1 rounded-full border font-medium leading-none transition ${size} ${onClick ? 'hover:brightness-125 cursor-pointer' : ''}`
  const body = (
    <>
      <span>#{label}</span>
      {typeof count === 'number' && <span className="opacity-60">{count}</span>}
    </>
  )
  return onClick
    ? <button type="button" onClick={onClick} title={title} className={cls} style={style}>{body}</button>
    : <span title={title} className={cls} style={style}>{body}</span>
}
