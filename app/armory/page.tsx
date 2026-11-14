'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CORE_FAMILY, FAMILIES, familyColor } from '@/lib/constants-armory'
import { ARMORY_EVENT, fetchUnits, latestRev, stageOf, type Unit } from '@/lib/armory'
import { FamilyChip, SlotDots, StageChip, StatusBadge } from './_components/bits'
import IntakeModal from './_components/IntakeModal'
import LineageMap from './_components/LineageMap'
import ReleaseLedger from './_components/ReleaseLedger'

// 병기고 (Armory) — /armory
// -------------------------------------------------------------------
// 집 노트북에서 만든 MIL·SIL HTML Lab 을 '기체(마크)' 단위로 보관한다.
// 리비전 = ▶ 실행 HTML + 📦 소스 zip + 📐 제1원리 노트 PDF (한 번에 입고)
// 회사로는 소화 체크를 다 채운 리비전만 '출고'하고, 출고 대장에 남긴다.
//
//   격납고   계열별 기체 카드 (세 칸 채움 · 단계)
//   계보     계열 × 마크 번호 지도, 계승 화살표, 공통 코어 버스
//   출고 대장 입고 → 소화 중 → 출고 대기 → 출고됨 + 출고 기록

type Tab = 'hangar' | 'lineage' | 'ledger'
const TABS: { key: Tab; label: string }[] = [
  { key: 'hangar', label: '🛡 격납고' },
  { key: 'lineage', label: '🧬 계보' },
  { key: 'ledger', label: '🚚 출고 대장' },
]

function UnitCard({ u }: { u: Unit }) {
  const r = latestRev(u)
  const c = familyColor(u.family)
  return (
    <Link href={`/armory/${u.id}`}
      className="group bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 border border-gray-800 hover:border-gray-700 transition flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="text-2xl font-black leading-none tracking-tight" style={{ color: c }}>{u.code ?? '—'}</span>
        <div className="ml-auto"><StatusBadge status={u.status} /></div>
      </div>
      <p className="text-sm font-semibold text-gray-100 leading-snug">{u.name}</p>
      {u.summary && <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">{u.summary}</p>}
      <div className="mt-auto pt-2 flex items-center gap-2 border-t border-gray-800">
        <SlotDots rev={r} />
        <span className="text-[11px] text-gray-400 tabular-nums">{r?.ver ?? ''}</span>
        <span className="ml-auto"><StageChip rev={r} /></span>
      </div>
    </Link>
  )
}

function ArmoryInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'hangar'
  const [units, setUnits] = useState<Unit[]>([])
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')
  const [intake, setIntake] = useState(false)

  const load = useCallback(() => {
    fetchUnits().then(u => { setUnits(u); setErr(''); setReady(true) })
      .catch(e => { setErr(String(e?.message ?? e)); setReady(true) })
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(ARMORY_EVENT, load)
    return () => window.removeEventListener(ARMORY_EVENT, load)
  }, [load])

  const stats = useMemo(() => {
    const revs = units.flatMap(u => u.revisions)
    const n = (s: string) => revs.filter(r => stageOf(r) === s).length
    return {
      units: units.length,
      revs: revs.length,
      digesting: n('stock') + n('digesting'),
      ready: n('ready'),
      released: revs.reduce((s, r) => s + r.releases.length, 0),
      company: n('company'),
    }
  }, [units])

  // 격납고: 계열별 묶음 (알려진 순서 → 그 밖 → 계열 없음)
  const groups = useMemo(() => {
    const order = FAMILIES.map(f => f.label)
    const fams = [...new Set(units.map(u => u.family ?? ''))]
      .sort((a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0)
        || (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)))
    return fams.map(f => ({ family: f, list: units.filter(u => (u.family ?? '') === f) }))
  }, [units])

  const setTab = (t: Tab) => router.replace(t === 'hangar' ? '/armory' : `/armory?tab=${t}`, { scroll: false })

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">← 홈</Link>
        <div className="flex flex-wrap items-end gap-3 mt-2 mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold">🛡 병기고</h1>
            <p className="text-sm text-gray-500">집에서 만들고 · 소화한 뒤 · 회사로 출고 — MIL·SIL Lab 기체 보관소</p>
          </div>
          <button onClick={() => setIntake(true)} disabled={!!err}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl px-4 py-2.5 text-sm font-semibold">
            📥 한번에 입고
          </button>
        </div>

        {/* 상황판 */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
          {[
            ['기체', stats.units, '#E5E7EB'],
            ['리비전', stats.revs, '#E5E7EB'],
            ['소화 대기', stats.digesting, '#E0B341'],
            ['출고 대기', stats.ready, '#34D399'],
            ['출고 횟수', stats.released, '#F0997B'],
            ['🏢 회사 보관', stats.company, '#94A3B8'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
              <p className="text-[10px] text-gray-500">{l}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: c as string }}>{v}</p>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-1.5 mb-5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-sm px-3.5 py-1.5 rounded-lg ${tab === t.key ? 'bg-gray-100 text-gray-900 font-semibold' : 'bg-gray-900 text-gray-400 hover:text-gray-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {!ready ? <p className="text-sm text-gray-500">격납고 문 여는 중…</p>
          : err ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
              병기고를 불러오지 못했어요. Supabase 에서 <code className="text-red-200">supabase/armory_migration.sql</code> 을 먼저 실행해 주세요.
              <p className="text-[11px] text-red-400/70 mt-1">{err}</p>
            </div>
          ) : tab === 'lineage' ? <LineageMap units={units} />
          : tab === 'ledger' ? <ReleaseLedger units={units} />
          : (
            <div className="space-y-7">
              {groups.map(g => (
                <section key={g.family || '_none'}>
                  <div className="flex items-center gap-2 mb-2.5">
                    {g.family ? <FamilyChip family={g.family} /> : <span className="text-[11px] text-gray-500">계열 없음</span>}
                    <span className="text-[11px] text-gray-600">{g.list.length}</span>
                    {g.family === CORE_FAMILY && <span className="text-[10px] text-gray-600">— 다른 기체가 꽂히는 공통 부품</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {g.list.map(u => <UnitCard key={u.id} u={u} />)}
                  </div>
                </section>
              ))}
              {!units.length && <p className="text-sm text-gray-500">기체가 없어요. 📥 한번에 입고로 첫 기체를 넣어 보세요.</p>}
            </div>
          )}
      </div>

      {intake && (
        <IntakeModal units={units} onClose={() => setIntake(false)}
          onSaved={id => { setIntake(false); router.push(`/armory/${id}`) }} />
      )}
    </main>
  )
}

export default function ArmoryPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-950" />}>
      <ArmoryInner />
    </Suspense>
  )
}
