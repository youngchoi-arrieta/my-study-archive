import Link from 'next/link'
import { supabase } from '../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: cards } = await supabase.from('cards').select('status')
  const { data: diagrams } = await supabase.from('diagram_cards').select('status')

  const cardTotal = cards?.length || 0
  const cardWrong = cards?.filter(c => c.status === '오답노트').length || 0
  const cardDone = cards?.filter(c => c.status === '완료').length || 0

  const diagTotal = diagrams?.length || 0
  const diagWrong = diagrams?.filter(c => c.status === '오답노트').length || 0
  const diagDone = diagrams?.filter(c => c.status === '완료').length || 0

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
        <p className="text-gray-500 mb-10">電気工学 · 수학 · 물리 학습 아카이브</p>

        <div className="space-y-4">
          <Link href="/cards" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">개념 카드</p>
                <h2 className="text-2xl font-bold mb-1">📚 정리 · 증명 · 공식</h2>
                <p className="text-gray-400 text-sm">LaTeX · Cloze · Flow · 키워드 모드</p>
              </div>
              <span className="text-3xl font-bold text-white">{cardTotal}</span>
            </div>
            <div className="flex gap-4 mt-5 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-sm text-gray-400">오답노트 <span className="text-white font-semibold">{cardWrong}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm text-gray-400">완료 <span className="text-white font-semibold">{cardDone}</span></span>
              </div>
            </div>
          </Link>

          <Link href="/diagram" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">실기 문제</p>
                <h2 className="text-2xl font-bold mb-1">🗺️ 도면 · Table · 시퀀스</h2>
                <p className="text-gray-400 text-sm">도면해석 · Table spec · 시퀀스회로도</p>
              </div>
              <span className="text-3xl font-bold text-white">{diagTotal}</span>
            </div>
            <div className="flex gap-4 mt-5 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-sm text-gray-400">오답노트 <span className="text-white font-semibold">{diagWrong}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm text-gray-400">완료 <span className="text-white font-semibold">{diagDone}</span></span>
              </div>
            </div>
          </Link>

          <Link href="/dashboard" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">기출문제</p>
                <h2 className="text-2xl font-bold mb-1">📊 풀이 대시보드</h2>
                <p className="text-gray-400 text-sm">합격률 낮은 순 · 회차별 점수 · 영역별 메모</p>
              </div>
            </div>
          </Link>

          <Link href="/tools" className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">인터랙티브</p>
                <h2 className="text-2xl font-bold mb-1">🔧 전공 도구</h2>
                <p className="text-gray-400 text-sm">대칭좌표법 · 고장전류 · 변압기 벡터도</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
