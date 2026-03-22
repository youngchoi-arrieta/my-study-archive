import Link from 'next/link'

function ActiveCard({ href, flag, org, title, desc }: { href: string, flag?: string, org: string, title: string, desc: string }) {
  return (
    <Link href={href} className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition h-full">
      {flag && <p className="text-lg mb-1">{flag}</p>}
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{org}</p>
      <h2 className="text-lg font-bold mb-1 leading-snug">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </Link>
  )
}

function InactiveCard({ flag, org, title, desc }: { flag?: string, org: string, title: string, desc: string }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 opacity-40 cursor-not-allowed h-full">
      {flag && <p className="text-lg mb-1">{flag}</p>}
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{org} · 준비 중</p>
      <h2 className="text-lg font-bold mb-1 leading-snug">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </div>
  )
}

export default function DashboardHome() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <h1 className="text-3xl font-bold mb-1">📊 시험별 기출문제 풀이 현황</h1>
        <p className="text-gray-500 text-sm mb-8">시험을 선택하세요</p>

        <div className="grid grid-cols-2 gap-4">
          {/* 왼쪽: 한국 시험 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">🇰🇷 한국</p>
            <ActiveCard href="/dashboard/engineer" org="한국산업인력공단"
              title="⚡ 전기기사 실기" desc="합격률 낮은 순 · 회차별 점수 · 영역별 메모" />
            <ActiveCard href="/dashboard/practical" org="한국산업인력공단"
              title="🔧 전기기능사 실기" desc="작업형 실기 · 공정별 타이머 · 훈련 통계" />
            <InactiveCard org="인사혁신처" title="🏛️ 기술고시" desc="전기직 기술고시 기출문제" />
          </div>

          {/* 오른쪽: 해외 시험 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">🌏 해외</p>
            <InactiveCard flag="🇯🇵" org="일본 경제산업성" title="電験 (덴켄)" desc="電験三種 · 電験二種 · 電験一種" />
            <InactiveCard flag="🇮🇳" org="IIT" title="GATE (EE)" desc="Graduate Aptitude Test in Engineering" />
            <InactiveCard flag="🇨🇦" org="APEGS / PEO" title="Technical Exam (EE)" desc="Canadian Professional Engineer — EE" />
          </div>
        </div>
      </div>
    </main>
  )
}
