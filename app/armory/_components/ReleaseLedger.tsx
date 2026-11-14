'use client'

import Link from 'next/link'
import { PIPELINE, STAGE_META, digestState, stageOf, unitLabel, type Revision, type Unit } from '@/lib/armory'

// 출고 대장
// -------------------------------------------------------------------
//   입고 ─▶ 소화 중 ─▶ 출고 대기 ─▶ 출고됨        (🏢 회사 보관은 줄 밖)
//   아래 표 = 언제 · 무엇을 · 누구에게 · 어떤 형태로 내보냈나

interface Row { unit: Unit; rev: Revision }

export default function ReleaseLedger({ units }: { units: Unit[] }) {
  const rows: Row[] = units.flatMap(u => u.revisions.map(rev => ({ unit: u, rev })))
  const col = (s: (typeof PIPELINE)[number]) => {
    const list = rows.filter(r => stageOf(r.rev) === s)
    // 출고됨 칸은 기체마다 가장 최근 것만 (예전 출고본은 아래 대장에)
    if (s !== 'released') return list
    const seen = new Set<string>()
    return list.filter(r => (seen.has(r.unit.id) ? false : (seen.add(r.unit.id), true)))
  }
  const company = rows.filter(r => r.rev.keep === 'company')
  const log = rows.flatMap(r => r.rev.releases.map(rel => ({ ...r, rel })))
    .sort((a, b) => b.rel.released_on.localeCompare(a.rel.released_on) || b.rel.created_at.localeCompare(a.rel.created_at))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {PIPELINE.map((s, i) => {
          const list = col(s)
          const m = STAGE_META[s]
          return (
            <div key={s} className="bg-gray-900 rounded-2xl p-3 border border-gray-800 min-h-[140px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: m.color }}>{m.label}</span>
                <span className="text-[11px] text-gray-600">{list.length}</span>
                {i < PIPELINE.length - 1 && <span className="ml-auto text-gray-700 hidden md:inline">▶</span>}
              </div>
              <p className="text-[10px] text-gray-600 mb-2 leading-snug">
                {s === 'stock' ? '격납고에 들어왔지만 아직 소화 체크 전'
                  : s === 'digesting' ? '설명·근거·보안 체크를 채우는 중'
                  : s === 'ready' ? '소화 완료 — 내보내도 되는 상태'
                  : '회사에 나간 적 있음 (기체별 최신)'}
              </p>
              <ul className="space-y-1.5">
                {list.map(({ unit, rev }) => {
                  const d = digestState(rev)
                  return (
                    <li key={rev.id}>
                      <Link href={`/armory/${unit.id}?rev=${rev.id}`}
                        className="block bg-gray-950 hover:bg-gray-800 rounded-lg px-2.5 py-1.5 transition">
                        <p className="text-xs text-gray-200 truncate">{unitLabel(unit)}</p>
                        <p className="text-[10px] text-gray-500">
                          {rev.ver} · {rev.made_on.slice(5)}
                          {s === 'digesting' && <> · 체크 {d.done}/{d.total}</>}
                          {s === 'released' && <> · {rev.releases[0]?.released_on.slice(5)} → {rev.releases[0]?.target}</>}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>

      {company.length > 0 && (
        <div className="bg-gray-900/60 rounded-2xl p-3 border border-gray-800">
          <p className="text-xs font-semibold text-gray-400 mb-2">🏢 회사 보관 — 파일은 회사 PC 에, 여기엔 카드만</p>
          <div className="flex flex-wrap gap-1.5">
            {company.map(({ unit, rev }) => (
              <Link key={rev.id} href={`/armory/${unit.id}?rev=${rev.id}`}
                className="text-[11px] bg-gray-950 hover:bg-gray-800 rounded-lg px-2.5 py-1 text-gray-300">
                {unitLabel(unit)} <span className="text-gray-500">{rev.ver}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-bold text-gray-300 mb-2">📒 출고 기록</p>
        {log.length === 0 ? <p className="text-xs text-gray-600">아직 내보낸 기록이 없어요.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 text-left">
                <tr className="border-b border-gray-800">
                  <th className="py-1.5 pr-3 font-medium">날짜</th>
                  <th className="py-1.5 pr-3 font-medium">기체</th>
                  <th className="py-1.5 pr-3 font-medium">버전</th>
                  <th className="py-1.5 pr-3 font-medium">받는 곳</th>
                  <th className="py-1.5 pr-3 font-medium">형태</th>
                  <th className="py-1.5 font-medium">메모</th>
                </tr>
              </thead>
              <tbody>
                {log.map(({ unit, rev, rel }) => (
                  <tr key={rel.id} className="border-b border-gray-900 text-gray-300">
                    <td className="py-1.5 pr-3 tabular-nums text-gray-500">{rel.released_on}</td>
                    <td className="py-1.5 pr-3"><Link href={`/armory/${unit.id}?rev=${rev.id}`} className="hover:text-white">{unitLabel(unit)}</Link></td>
                    <td className="py-1.5 pr-3">{rev.ver}</td>
                    <td className="py-1.5 pr-3">{rel.target}</td>
                    <td className="py-1.5 pr-3 text-gray-400">{rel.form}</td>
                    <td className="py-1.5 text-gray-500">{rel.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
