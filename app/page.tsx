import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
        <p className="text-gray-500 mb-10">電気工学 · 수학 · 물리 학습 아카이브</p>

        <div className="grid grid-cols-2 gap-4">
          {/* 왼쪽: 문제 데이터베이스 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">📚 문제 데이터베이스</p>
            <Link href="/cards" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex-1">
              <div className="text-2xl mb-2">📚</div>
              <h2 className="text-lg font-bold mb-1">증명형 문제</h2>
              <p className="text-gray-400 text-xs">정리 · 증명 · 공식 · LaTeX · Cloze · Flow</p>
            </Link>
            <Link href="/diagram" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex-1">
              <div className="text-2xl mb-2">⚡</div>
              <h2 className="text-lg font-bold mb-1">전기기사 실기 오답노트</h2>
              <p className="text-gray-400 text-xs">주제별 분류 · 복수 태그 · 오답 추적</p>
            </Link>
            <Link href="/flashcard" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex-1">
              <div className="text-2xl mb-2">🃏</div>
              <h2 className="text-lg font-bold mb-1">플래시카드</h2>
              <p className="text-gray-400 text-xs">멀티필드 · 랜덤 인출 훈련</p>
            </Link>
          </div>

          {/* 오른쪽: 대시보드 */}
          <div className="flex flex-col gap-4">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">📊 대시보드</p>
            <Link href="/dashboard" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex-1">
              <div className="text-2xl mb-2">📊</div>
              <h2 className="text-lg font-bold mb-1">시험별 학습 대시보드</h2>
              <p className="text-gray-400 text-xs">전기기사 · 電験 · 기술고시 · GATE</p>
            </Link>
            <Link href="/library" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex-1">
              <div className="text-2xl mb-2">📖</div>
              <h2 className="text-lg font-bold mb-1">레퍼런스 라이브러리</h2>
              <p className="text-gray-400 text-xs">주제별 PDF · 구글 드라이브 연동</p>
            </Link>
            <Link href="/jobs" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex-1">
              <div className="text-2xl mb-2">💼</div>
              <h2 className="text-lg font-bold mb-1">구직 대시보드</h2>
              <p className="text-gray-400 text-xs">채용공고 칸반 · 마감일 타임라인 · AI 파싱</p>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
