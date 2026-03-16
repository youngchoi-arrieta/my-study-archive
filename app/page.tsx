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
            <h2 className="text-2xl font-bold mb-1">개념 카드</h2>
            <p className="text-gray-400 text-sm">정리 · 증명 · 공식 · LaTeX · Cloze · Flow</p>
          </Link>

          <Link href="/diagram" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">🗺️</div>
            <h2 className="text-2xl font-bold mb-1">도면해석 · Table spec</h2>
            <p className="text-gray-400 text-sm">도면 · 표 · 시퀀스회로도 실기 문제</p>
          </Link>

          <Link href="/dashboard" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">📊</div>
            <h2 className="text-2xl font-bold mb-1">기출문제 대시보드</h2>
            <p className="text-gray-400 text-sm">합격률 낮은 순 · 회차별 점수 · 영역별 메모</p>
          </Link>

          <Link href="/tools" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="text-3xl mb-2">🔧</div>
            <h2 className="text-2xl font-bold mb-1">전공 도구</h2>
            <p className="text-gray-400 text-sm">대칭좌표법 · 고장전류 · 변압기 벡터도</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
