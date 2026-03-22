import Link from 'next/link'

export default function DashboardHome() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <h1 className="text-3xl font-bold mb-1">📊 시험별 기출문제 풀이 현황</h1>
        <p className="text-gray-500 text-sm mb-8">시험을 선택하세요</p>

        <div className="space-y-4">
          {/* 전기기사 실기 - 활성화 */}
          <Link href="/dashboard/engineer"
            className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">한국산업인력공단</p>
                <h2 className="text-2xl font-bold mb-1">⚡ 전기기사 실기</h2>
                <p className="text-gray-400 text-sm">합격률 낮은 순 · 회차별 점수 · 영역별 메모</p>
              </div>
              <span className="text-gray-400 text-lg">→</span>
            </div>
          </Link>

          {/* 電験 - 비활성화 */}
          <div className="block bg-gray-900 rounded-2xl p-6 opacity-40 cursor-not-allowed">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">일본 경제산업성 · 준비 중</p>
                <h2 className="text-2xl font-bold mb-1">🇯🇵 電験 (덴켄)</h2>
                <p className="text-gray-400 text-sm">電験三種 · 電験二種 · 電験一種</p>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">준비 중</span>
            </div>
          </div>

          {/* 기술고시 - 비활성화 */}
          <div className="block bg-gray-900 rounded-2xl p-6 opacity-40 cursor-not-allowed">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">인사혁신처 · 준비 중</p>
                <h2 className="text-2xl font-bold mb-1">🏛️ 기술고시</h2>
                <p className="text-gray-400 text-sm">전기직 기술고시 기출문제</p>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">준비 중</span>
            </div>
          </div>

          {/* GATE - 비활성화 */}
          <div className="block bg-gray-900 rounded-2xl p-6 opacity-40 cursor-not-allowed">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">IIT · 준비 중</p>
                <h2 className="text-2xl font-bold mb-1">🇮🇳 GATE (EE)</h2>
                <p className="text-gray-400 text-sm">Graduate Aptitude Test in Engineering — Electrical</p>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">준비 중</span>
            </div>
          </div>

          {/* 캐나다 Technical Exam - 비활성화 */}
          <div className="block bg-gray-900 rounded-2xl p-6 opacity-40 cursor-not-allowed">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">APEGS / PEO · 준비 중</p>
                <h2 className="text-2xl font-bold mb-1">🇨🇦 Technical Exam (EE)</h2>
                <p className="text-gray-400 text-sm">Canadian Professional Engineer — Electrical Engineering</p>
              </div>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded-full">준비 중</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
