'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DENKOSHI_UNITS, UNIT_CATEGORIES, getCategory, type UnitCategory } from '@/lib/constants-denkoshi-units'

type Tab = 'all' | UnitCategory

export default function UnitsListPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<Tab>('all')

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('denkoshi_unit_slides').select('unit_slug')
      const c: Record<string, number> = {}
      ;(data || []).forEach((r: { unit_slug: string }) => { c[r.unit_slug] = (c[r.unit_slug] || 0) + 1 })
      setCounts(c)
    })()
  }, [])

  const units = tab === 'all' ? DENKOSHI_UNITS : DENKOSHI_UNITS.filter(u => u.category === tab)
  const filled = DENKOSHI_UNITS.filter(u => (counts[u.slug] || 0) > 0).length

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/dashboard/denkoshi/jitsugi" className="text-gray-400 hover:text-white text-sm">← 실기 허브</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🧰</span>
          <h1 className="text-2xl font-bold">단위작업</h1>
          <span className="text-xs text-gray-500">{filled}/{DENKOSHI_UNITS.length} 작성</span>
        </div>
        <p className="text-gray-500 text-sm mb-6">HOZAN 単位作業 · 캡쳐 이미지 + 캡션 슬라이드로 핵심 정리</p>

        {/* 카테고리 탭 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setTab('all')} className={tabCls(tab === 'all')}>전체</button>
          {UNIT_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setTab(c.key)} className={tabCls(tab === c.key)}>{c.ko}</button>
          ))}
        </div>

        {/* 카드 그리드 */}
        <div className="grid sm:grid-cols-2 gap-3">
          {units.map(u => {
            const cat = getCategory(u.category)!
            const n = counts[u.slug] || 0
            return (
              <Link
                key={u.slug}
                href={`/dashboard/denkoshi/jitsugi/units/${u.slug}`}
                className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${cat.color}22`, color: cat.color }}>{cat.ko}</span>
                  <span className={`text-[11px] ${n > 0 ? 'text-blue-400' : 'text-gray-600'}`}>{n > 0 ? `슬라이드 ${n}` : '비어있음'}</span>
                </div>
                <p className="text-sm font-semibold leading-snug">{u.titleKo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{u.titleJa}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function tabCls(active: boolean) {
  return `px-3 py-1.5 rounded-lg text-sm transition ${active ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'}`
}
