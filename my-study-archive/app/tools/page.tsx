import Link from 'next/link'

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <h1 className="text-3xl font-bold mb-1">🎮 디지털 토이</h1>
        <p className="text-gray-500 mb-8">전기공학 직관 훈련용 인터랙티브 시뮬레이터</p>

        <div className="space-y-4">
          <Link href="/tools/symmetrical-components"
            className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">대칭좌표법</p>
                <h2 className="text-xl font-bold mb-1">⚡ 불평형 3상 → 대칭성분 변환</h2>
                <p className="text-gray-400 text-sm">Va·Vb·Vc 페이저를 드래그해서 V0·V1·V2 조립 과정을 애니메이션으로 확인</p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>

          <Link href="/tools/trainer"
            className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">전기기능사 실기</p>
                <h2 className="text-xl font-bold mb-1">🔌 시퀀스 트레이너</h2>
                <p className="text-gray-400 text-sm">유접점 회로도 완성 · 타임차트 · 핀번호 (예정)</p>
              </div>
              <span className="text-2xl">→</span>
            </div>
          </Link>

          <div className="block bg-gray-900 rounded-2xl p-6 opacity-40 cursor-not-allowed">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">준비 중</p>
            <h2 className="text-xl font-bold mb-1">⚡ 고장전류 계산기</h2>
            <p className="text-gray-400 text-sm">1선/2선/3선 지락 고장전류 시각화</p>
          </div>

          <div className="block bg-gray-900 rounded-2xl p-6 opacity-40 cursor-not-allowed">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">준비 중</p>
            <h2 className="text-xl font-bold mb-1">🔄 변압기 벡터도</h2>
            <p className="text-gray-400 text-sm">결선 방식에 따른 1·2차 전압 위상 관계</p>
          </div>
        </div>
      </div>
    </main>
  )
}
