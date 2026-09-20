'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CO_TABS, type CoTab } from '@/lib/constants-company'
import TodayTab from './_components/TodayTab'
import JournalTab from './_components/JournalTab'
import ScheduleTab from './_components/ScheduleTab'
import CompassTab from './_components/CompassTab'
import PortfolioTab from './_components/PortfolioTab'
import PeopleTab from './_components/PeopleTab'

// ───────────────────────────────────────────────────────────────
//  회사생활 — /dashboard/company
//  퇴근 후 반성용. 회사에서는 열지 않는 개인 앱.
//    매일   오늘 · 업무일지 · 업무일정
//    상시   나침반 · 포트폴리오
//    보류   사람 (잠금)
// ───────────────────────────────────────────────────────────────

export default function CompanyPage() {
  const [tab, setTab] = useState<CoTab>('today')
  const wide = tab === 'schedule' || tab === 'compass' || tab === 'portfolio'

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className={`mx-auto ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>

        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🏢</span>
          <h1 className="text-xl font-bold">회사생활</h1>
        </div>
        <p className="text-gray-600 text-[11px] mb-4">
          회사에서 잘 보이려고 쓰는 게 아니라, 하루를 나 혼자 정리하려고 쓰는 것
        </p>

        {/* 탭 */}
        <div className="flex flex-wrap gap-1 bg-gray-900 rounded-xl p-1 mb-5">
          {CO_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                tab === t.key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'today' && <TodayTab />}
        {tab === 'journal' && <JournalTab />}
        {tab === 'schedule' && <ScheduleTab />}
        {tab === 'compass' && <CompassTab />}
        {tab === 'portfolio' && <PortfolioTab />}
        {tab === 'people' && <PeopleTab />}

      </div>
    </main>
  )
}
