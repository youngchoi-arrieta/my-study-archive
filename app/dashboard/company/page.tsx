'use client'

import Link from 'next/link'
import TodayTab from './_components/TodayTab'

// ───────────────────────────────────────────────────────────────
//  회사생활 — /dashboard/company
//  퇴근 후 2분. 회사에서는 열지 않는 개인 앱.
//
//  2026-10 재편: 생각 정리는 클로드와의 대화 → PDF 노트 → 서가(/notes)로 옮겼다.
//  여기에는 매일 보는 것만 남긴다.
//    북극성 · 안 끝난 지시 · 위생 체크 · 하지 말 것 / 하려 할 것 · 저녁 삼분법
//
//  업무일지 · 업무일정 · 나침반 · 포트폴리오 · 사람 탭은 화면에서만 내렸다.
//  컴포넌트(_components/*Tab.tsx)와 테이블(co_*)·데이터는 그대로 있다.
// ───────────────────────────────────────────────────────────────

export default function CompanyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="mx-auto max-w-3xl">

        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🏢</span>
          <h1 className="text-xl font-bold">회사생활</h1>
          <Link href="/notes" className="ml-auto text-xs text-blue-300 hover:text-blue-200">📚 서가 →</Link>
        </div>
        <p className="text-gray-600 text-[11px] mb-5">
          회사에서 잘 보이려고 쓰는 게 아니라, 하루를 나 혼자 정리하려고 쓰는 것
        </p>

        <TodayTab />

      </div>
    </main>
  )
}
