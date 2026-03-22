import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
        <p className="text-gray-500 mb-10">電気工学 · 수학 · 물리 학습 아카이브</p>

        <div className="space-y-4">
          <Link href="/cards" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">📚</div>
            <h2 className="text-2xl font-bold mb-1">증명형 문제</h2>
            <p className="text-gray-400 text-sm">정리 · 증명 · 공식 · LaTeX · Cloze · Flow</p>
          </Link>

          <Link href="/diagram" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">🗺️</div>
            <h2 className="text-2xl font-bold mb-1">자료해석형 문제</h2>
            <p className="text-gray-400 text-sm">도면해석 · Table spec · 시퀀스회로도</p>
          </Link>

          <Link href="/dashboard" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">📊</div>
            <h2 className="text-2xl font-bold mb-1">시험별 기출문제 풀이 현황 Dashboard</h2>
            <p className="text-gray-400 text-sm">전기기사 실기 · 電験 · 기술고시</p>
          </Link>


          <Link href="/jobs" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">💼</div>
            <h2 className="text-2xl font-bold mb-1">구직 대시보드</h2>
            <p className="text-gray-400 text-sm">채용공고 칸반 · 마감일 타임라인 · AI 파싱</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
