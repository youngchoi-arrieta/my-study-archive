'use client'

import Link from 'next/link'

const TREES = [
  {
    type: 'career',
    icon: '🗺',
    title: '경력 마일스톤',
    desc: '한국 · 일본 · 캐나다 · 호주 진출 경로별 자격증 및 비자 마일스톤',
    color: '#f87171',
  },
  {
    type: 'technical',
    icon: '⚙',
    title: '기술 스택',
    desc: '전력전자 · 모터제어 · 전력계통 · 신재생에너지 · 계측제어 분야별 역량 트리',
    color: '#60a5fa',
  },
]

export default function CareerDashboard() {
  return (
    <main
      className="min-h-screen text-white p-6 md:p-10"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0d0b1e 0%, #04040a 60%)' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/jobs" className="text-gray-500 hover:text-white text-sm">← 진로 대시보드</Link>
        </div>

        <h1
          className="text-xl font-bold tracking-widest mb-1"
          style={{ color: '#d4af37', textShadow: '0 0 20px #d4af3760', fontFamily: 'Georgia, serif', letterSpacing: '4px' }}
        >
          ⚡ CAREER SKILL TREE
        </h1>
        <p className="text-gray-600 text-xs mb-8">마일스톤을 클릭해서 달성 표시 · 편집 모드로 자유롭게 노드 추가 및 수정</p>

        <div className="space-y-3">
          {TREES.map(t => (
            <Link
              key={t.type}
              href={`/dashboard/career/${t.type}`}
              className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition group"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm mb-0.5" style={{ color: t.color }}>{t.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
                </div>
                <span className="text-gray-700 group-hover:text-gray-400 transition text-lg">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
