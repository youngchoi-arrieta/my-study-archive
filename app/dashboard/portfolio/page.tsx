'use client'

import Link from 'next/link'

// 포트폴리오 문
// -------------------------------------------------------------------
// 홈의 「포트폴리오」 카드가 여기로 들어온다. 흩어져 있던 포폴 성격의
// 페이지들을 한 곳에 모은다. 각 항목은 기존 라우트로 그대로 연결.

interface Item {
  href: string
  emoji: string
  title: string
  desc: string
  color: string
}

const ITEMS: Item[] = [
  {
    href: '/portfolio',
    emoji: '🌀',
    title: '찬란한 무용함',
    desc: '호기심이 이끄는 대로 만들어 보는 것들. 유용함은 부산물.',
    color: '#F0997B',
  },
  {
    href: '/library',
    emoji: '📖',
    title: '레퍼런스 라이브러리',
    desc: '주제별 PDF · 드라이브 자료 아카이브',
    color: '#85B7EB',
  },
  {
    href: '/diagram',
    emoji: '📐',
    title: '도식',
    desc: '등가회로 · 3상 · 고장이론 도식 카탈로그',
    color: '#5DCAA5',
  },
  {
    href: '/cards',
    emoji: '🗂',
    title: '카드',
    desc: '개념 · 핵심 정리 카드',
    color: '#AFA9EC',
  },
]

function ItemCard({ it }: { it: Item }) {
  return (
    <Link href={it.href}
      className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex items-start gap-4 group">
      <span className="text-2xl shrink-0">{it.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold mb-0.5" style={{ color: it.color }}>{it.title}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{it.desc}</p>
      </div>
      <span className="text-gray-700 group-hover:text-gray-400 transition text-sm shrink-0">→</span>
    </Link>
  )
}

export default function PortfolioHub() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition inline-block">← 홈</Link>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-1">🌀 포트폴리오</h1>
          <p className="text-gray-500 text-sm">만든 것 · 정리한 것 · 참고하는 것</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {ITEMS.map(it => <ItemCard key={it.href} it={it} />)}
        </div>

      </div>
    </main>
  )
}
