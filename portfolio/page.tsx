import { Suspense } from 'react'
import Link from 'next/link'
import PortfolioView from '../jobs/components/PortfolioView'

export const metadata = {
  title: '찬란한 무용함 | 나의 전기공학 도장',
  description: '호기심이 이끄는 대로 만들어 보는 것들. 유용함은 부산물.',
}

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-5 py-6">
        <div className="mb-6">
          <Link href="/" className="text-gray-500 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">🌀 찬란한 무용함</h1>
          <p className="text-gray-500 text-sm">호기심이 이끄는 대로 만들어 보는 것들. 유용함은 부산물.</p>
        </div>
        <Suspense fallback={null}>
          <PortfolioView />
        </Suspense>
      </div>
    </main>
  )
}
