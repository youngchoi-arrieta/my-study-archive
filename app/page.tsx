import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: cards } = await supabase
    .from('cards')
    .select('status')

  const total = cards?.length || 0
  const wrongNote = cards?.filter(c => c.status === '오답노트').length || 0
  const done = cards?.filter(c => c.status === '완료').length || 0
  const mastered = cards?.filter(c => c.status === '완전숙지').length || 0

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">⚡ 영이의 전기공학 체육관</h1>
        <p className="text-gray-400 mb-8">電気工学 · 수학 · 물리 학습 아카이브</p>

        {/* 통계 */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-gray-400 text-sm mt-1">전체 카드</p>
          </div>
          <div className="bg-red-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{wrongNote}</p>
            <p className="text-gray-400 text-sm mt-1">❌ 오답노트</p>
          </div>
          <div className="bg-green-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{mastered}</p>
            <p className="text-gray-400 text-sm mt-1">✅ 완전숙지</p>
          </div>
          <div className="bg-blue-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{done}</p>
            <p className="text-gray-400 text-sm mt-1">📦 완료</p>
          </div>
        </div>

        {/* 메뉴 */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/cards" className="bg-gray-800 hover:bg-gray-700 rounded-xl p-6 transition">
            <div className="text-3xl mb-2">📚</div>
            <h2 className="text-xl font-semibold">카드 목록</h2>
            <p className="text-gray-400 text-sm mt-1">저장된 문제 · 정리 · 증명 보기</p>
          </Link>
          <Link href="/cards/new" className="bg-blue-900 hover:bg-blue-800 rounded-xl p-6 transition">
            <div className="text-3xl mb-2">✏️</div>
            <h2 className="text-xl font-semibold">새 카드 추가</h2>
            <p className="text-gray-400 text-sm mt-1">문제 · 정리 · 증명 새로 입력</p>
          </Link>
          <Link href="/cards?status=오답노트" className="bg-red-900 hover:bg-red-800 rounded-xl p-6 transition">
            <div className="text-3xl mb-2">❌</div>
            <h2 className="text-xl font-semibold">오답노트</h2>
            <p className="text-gray-400 text-sm mt-1">틀린 문제 · 취약 개념 모아보기</p>
          </Link>
          <Link href="/cards?status=완전숙지" className="bg-green-900 hover:bg-green-800 rounded-xl p-6 transition">
            <div className="text-3xl mb-2">✅</div>
            <h2 className="text-xl font-semibold">완전숙지</h2>
            <p className="text-gray-400 text-sm mt-1">완벽하게 이해한 카드 모아보기</p>
          </Link>
        </div>
      </div>
    </main>
  )
}