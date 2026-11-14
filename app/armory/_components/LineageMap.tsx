'use client'

import { useRouter } from 'next/navigation'
import { CORE_FAMILY, FAMILIES, STATUS_META, familyColor } from '@/lib/constants-armory'
import { STAGE_META, latestRev, stageOf, type Unit } from '@/lib/armory'

// 계보 — 계열(가로줄) × 마크 번호(왼→오)
// -------------------------------------------------------------------
//   ──▶  계승: 이전 마크를 고쳐 만든 기체 (기체 정보의 '계승한 마크')
//   ⚙    코어 장착: 맨 아래 공통 코어 버스에 꽂힌 기체
//   아래 색 띠 = 최신 리비전의 단계 (입고·소화 중·출고 대기·출고됨)

const NW = 156, NH = 58, GX = 18, LANE = 82, LABEL = 96, PAD = 16

export default function LineageMap({ units }: { units: Unit[] }) {
  const router = useRouter()
  const cores = units.filter(u => u.family === CORE_FAMILY)
  const rest = units.filter(u => u.family !== CORE_FAMILY)

  // 계열 순서: 알려진 계열 → 그 밖 → 계열 없음
  const known = FAMILIES.map(f => f.label).filter(l => l !== CORE_FAMILY)
  const extra = [...new Set(rest.map(u => u.family ?? '').filter(f => f && !known.includes(f)))]
  const lanes = [...known, ...extra, ''].filter(l => rest.some(u => (u.family ?? '') === l))

  const pos = new Map<string, { x: number; y: number }>()
  let maxCols = 1
  lanes.forEach((l, li) => {
    const row = rest.filter(u => (u.family ?? '') === l)
    maxCols = Math.max(maxCols, row.length)
    row.forEach((u, i) => pos.set(u.id, { x: LABEL + i * (NW + GX), y: PAD + li * LANE }))
  })
  const busY = PAD + lanes.length * LANE + 12
  const W = LABEL + maxCols * (NW + GX) + PAD
  const H = busY + (cores.length ? 64 : 8)

  const edges = rest.filter(u => u.parent_id && pos.has(u.parent_id) && pos.has(u.id))
  const coreLinks = cores.length ? rest.filter(u => u.on_core && pos.has(u.id)) : []

  if (!units.length) return <p className="text-sm text-gray-500 py-10 text-center">아직 기체가 없어요.</p>

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto bg-gray-950 border border-gray-800 rounded-2xl">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label="기체 계보">
          <defs>
            <marker id="arm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#F0997B" />
            </marker>
          </defs>

          {/* 계열 줄 */}
          {lanes.map((l, li) => (
            <g key={l || '_none'}>
              <rect x={4} y={PAD + li * LANE - 8} width={W - 8} height={LANE - 8} rx={10}
                fill={li % 2 ? '#0b1220' : '#0d1526'} />
              <text x={14} y={PAD + li * LANE + NH / 2 + 4} fontSize={12} fontWeight={700}
                fill={l ? familyColor(l) : '#6B7280'}>{l || '계열 없음'}</text>
            </g>
          ))}

          {/* 계승 화살표 */}
          {edges.map(u => {
            const a = pos.get(u.parent_id!)!, b = pos.get(u.id)!
            const sameRow = a.y === b.y
            const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2
            const d = sameRow && x2 > x1
              ? `M${x1},${y1} L${x2 - 2},${y2}`
              : `M${a.x + NW / 2},${a.y + (b.y > a.y ? NH : 0)} C${a.x + NW / 2},${(a.y + b.y + NH) / 2} ${b.x + NW / 2},${(a.y + b.y + NH) / 2} ${b.x + NW / 2},${b.y + (b.y > a.y ? 0 : NH)}`
            return <path key={'e' + u.id} d={d} fill="none" stroke="#F0997B" strokeWidth={1.8} markerEnd="url(#arm-arrow)" />
          })}

          {/* 기체 */}
          {rest.map(u => {
            const p = pos.get(u.id)!
            const r = latestRev(u)
            const st = r ? STAGE_META[stageOf(r)] : null
            const c = familyColor(u.family)
            const nm = u.name.length > 12 ? u.name.slice(0, 11) + '…' : u.name
            return (
              <g key={u.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer"
                onClick={() => router.push(`/armory/${u.id}`)}>
                <title>{`${u.code ?? ''} ${u.name}\n${u.summary ?? ''}`}</title>
                <rect width={NW} height={NH} rx={9} fill="#111827" stroke={c} strokeOpacity={u.status === 'concept' ? 0.5 : 0.9}
                  strokeWidth={1.5} strokeDasharray={u.status === 'concept' ? '5 4' : undefined} />
                <text x={10} y={20} fontSize={14} fontWeight={800} fill={c}>{u.code ?? '—'}</text>
                <text x={NW - 10} y={19} fontSize={9.5} textAnchor="end" fill={STATUS_META[u.status].color}>
                  {STATUS_META[u.status].dot} {STATUS_META[u.status].label}
                </text>
                <text x={10} y={37} fontSize={11.5} fill="#E5E7EB">{nm}</text>
                <text x={10} y={51} fontSize={9.5} fill="#6B7280">{r ? r.ver : '리비전 없음'}</text>
                {u.on_core && cores.length > 0 && (
                  <text x={NW - 10} y={51} fontSize={9.5} textAnchor="end" fill="#FBBF24">⚙ 코어</text>
                )}
                {st && <rect x={0} y={NH - 4} width={NW} height={4} rx={2} fill={st.color} />}
              </g>
            )
          })}

          {/* 공통 코어 버스 */}
          {cores.length > 0 && (
            <g>
              <rect x={LABEL - 6} y={busY} width={W - LABEL - PAD + 6} height={10} rx={5} fill="#FBBF24" fillOpacity={0.85} />
              {cores.map((u, i) => (
                <g key={u.id} className="cursor-pointer" onClick={() => router.push(`/armory/${u.id}`)}>
                  <text x={LABEL + i * 260} y={busY + 30} fontSize={13} fontWeight={800} fill="#FBBF24">
                    {u.code ?? '코어'} {u.name}
                  </text>
                  <text x={LABEL + i * 260} y={busY + 46} fontSize={10} fill="#9CA3AF">
                    {(u.summary ?? '').slice(0, 34)}
                  </text>
                </g>
              ))}
              {coreLinks.length > 0 && (
                <text x={W - PAD} y={busY + 30} fontSize={11} textAnchor="end" fill="#FBBF24" fillOpacity={0.8}>
                  꽂힌 기체: {coreLinks.map(u => u.code ?? u.name).join(' · ')}
                </text>
              )}
              <text x={14} y={busY + 9} fontSize={11} fontWeight={700} fill="#FBBF24">코어</text>
            </g>
          )}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span><span className="text-[#F0997B]">──▶</span> 계승 (이전 마크를 고쳐 만듦)</span>
        <span><span className="text-[#FBBF24]">⚙</span> 공통 코어 장착</span>
        <span>점선 테두리 = 설계 단계</span>
        <span>아래 색 띠 = 최신 리비전 단계:</span>
        {(['stock', 'digesting', 'ready', 'released', 'company'] as const).map(s => (
          <span key={s} style={{ color: STAGE_META[s].color }}>■ {STAGE_META[s].label}</span>
        ))}
      </div>
    </div>
  )
}
