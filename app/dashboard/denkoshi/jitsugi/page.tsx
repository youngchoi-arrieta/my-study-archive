import Link from 'next/link'

export default function DenkoshiJitsugiPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🔌</span>
          <h1 className="text-2xl font-bold">第二種電気工事士 실기</h1>
          <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full">준비 중</span>
        </div>
        <p className="text-gray-500 text-sm mb-8">일본 경제산업성 · 후보문제 · 작업 체크리스트</p>

        <div className="bg-gray-900 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-3">🔧</p>
          <p className="text-gray-400 text-sm">실기 대시보드 준비 중입니다.</p>
          <p className="text-gray-600 text-xs mt-1">후보문제 체크리스트 · 작업 시간 기록 등이 추가될 예정이에요.</p>
        </div>
      </div>
    </main>
  )
}
