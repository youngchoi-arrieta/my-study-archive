import Link from 'next/link'

function HubCard({
  href, emoji, title, desc, accent
}: {
  href: string
  emoji: string
  title: string
  desc: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl p-5 transition h-full ${
        accent
          ? 'bg-blue-950 hover:bg-blue-900 ring-1 ring-blue-600/40'
          : 'bg-gray-900 hover:bg-gray-800'
      }`}
    >
      <div className="text-2xl mb-2">{emoji}</div>
      <h2 className="text-base font-bold mb-1">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </Link>
  )
}

export default function DashboardHome() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>

        {/* 전기기사 실기 허브 */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">⚡</span>
            <h1 className="text-2xl font-bold">전기기사 실기</h1>
            <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full ml-1">취득</span>
          </div>
          <p className="text-gray-500 text-sm mb-6">한국산업인력공단 · Engineer 학과/실기 통합 허브</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <HubCard
              href="/dashboard/engineer"
              emoji="📊"
              title="기출 점수 대시보드"
              desc="회차별 점수 · 합격률 · 영역별 메모"
              accent
            />
            <HubCard
              href="/diagram"
              emoji="📝"
              title="오답노트 데이터베이스"
              desc="주제별 분류 · 복수 태그 · 오답 추적"
            />
            <HubCard
              href="/flashcard?exam=engineer"
              emoji="🃏"
              title="플래시카드"
              desc="전기기사 전용 덱 · 인출 훈련"
            />
          </div>
        </div>

        {/* 전기기능사 실기 허브 */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🔧</span>
            <h1 className="text-2xl font-bold">전기기능사 실기</h1>
            <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full ml-1">취득</span>
          </div>
          <p className="text-gray-500 text-sm mb-6">한국산업인력공단 · 작업형 실기 전용</p>
          <HubCard
            href="/dashboard/practical"
            emoji="⏱"
            title="작업형 훈련 트레이너"
            desc="공정별 타이머 · 체크리스트 · 훈련 통계"
            accent
          />
        </div>

        {/* 다른 시험 */}
        <div className="border-t border-gray-800 pt-6">
          <p className="text-xs text-gray-600 mb-3">다른 시험</p>
          <Link
            href="/dashboard/denkoshi"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            🗾 第二種電気工事士 →
          </Link>
        </div>
        <div className="border-t border-gray-800 pt-6">
          <p className="text-xs text-gray-600 mb-3">진로 계획</p>
          <Link
            href="/dashboard/career"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
          >
            ⚡ Career Skill Tree →
          </Link>
        </div>
      </div>
    </main>
  )
}
