import Link from 'next/link'

function ExamCard({
  href, emoji, org, title, desc, badge
}: {
  href: string
  emoji: string
  org: string
  title: string
  desc: string
  badge?: string
}) {
  return (
    <Link href={href} className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition h-full">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{emoji}</span>
        {badge && (
          <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{org}</p>
      <h2 className="text-base font-bold mb-1 leading-snug">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </Link>
  )
}

function InactiveExamCard({
  emoji, org, title, desc
}: {
  emoji: string
  org: string
  title: string
  desc: string
}) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 opacity-35 cursor-not-allowed h-full">
      <span className="text-2xl block mb-2">{emoji}</span>
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{org} · 준비 중</p>
      <h2 className="text-base font-bold mb-1 leading-snug">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </div>
  )
}

function ToolCard({
  href, emoji, title, desc
}: {
  href: string
  emoji: string
  title: string
  desc: string
}) {
  return (
    <Link href={href} className="block bg-gray-900 hover:bg-gray-800 rounded-xl p-4 transition">
      <span className="text-lg block mb-1">{emoji}</span>
      <h3 className="text-sm font-semibold mb-0.5">{title}</h3>
      <p className="text-gray-500 text-xs">{desc}</p>
    </Link>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
        <p className="text-gray-500 mb-10">電気工学 · 수학 · 물리 학습 아카이브</p>

        {/* 도구 — 최상단 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">🛠 도구</p>
        <div className="grid grid-cols-2 gap-3 mb-10">
          <ToolCard href="/jobs"       emoji="💼" title="진로 대시보드"       desc="칸반 · 마감일 · AI 파싱" />
          <ToolCard href="/library"    emoji="📖" title="레퍼런스 라이브러리" desc="주제별 PDF · 구글 드라이브" />
          <ToolCard href="/portfolio"    emoji="🌀" title="찬란한 무용함"    desc="호기심이 이끄는 대로 만들어 보는 것들" />
          <ToolCard href="/familia"    emoji="❤️" title="Familia Choi · Arrieta" desc="로드맵 · 2026 · EN / ES" />
        </div>

        {/* 시험 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">📋 시험</p>

        {/* 일본 — 우선 */}
        <p className="text-xs text-gray-700 mb-2 ml-1">🇯🇵 일본</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <ExamCard
            href="/dashboard/denkoshi"
            emoji="🗾"
            org="일본 경제산업성"
            title="第二種電気工事士 학과"
            desc="기출 PDF · 출제경향 분석 · 플래시카드"
            badge="준비 중"
          />
          <InactiveExamCard
            emoji="🏭"
            org="일본 경제산업성"
            title="電験三種"
            desc="理論 · 電力 · 機械 · 法規"
          />
        </div>

        {/* 한국 — 취득 완료 */}
        <p className="text-xs text-gray-700 mb-2 ml-1">🇰🇷 한국 (취득 완료)</p>
        <div className="grid grid-cols-2 gap-3">
          <ExamCard
            href="/dashboard"
            emoji="⚡"
            org="한국산업인력공단"
            title="전기기사 실기"
            desc="오답노트 · 기출 점수 · 플래시카드"
            badge="취득"
          />
          <ExamCard
            href="/dashboard"
            emoji="🔧"
            org="한국산업인력공단"
            title="전기기능사 실기"
            desc="작업형 공정 타이머 · 훈련 통계"
            badge="취득"
          />
        </div>
      </div>
    </main>
  )
}
