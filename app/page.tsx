'use client'

import Link from 'next/link'

// 홈 = 상시 띠 + 문 3개 + 개인 영역
// -------------------------------------------------------------------
// 3축(채용·자격증·포트폴리오)으로 정리한다. 시험 나열은 홈에서
// 걷어내 「자격증」문 안으로 접어넣었다. 우선순위·마감처럼 어느 축에도
// 속하지 않지만 상시로 봐야 하는 것은 맨 위 띠 하나로 뽑았다.
//
//   상시 띠  → 주요 일정 & 우선순위 (마감 간트 + 우선순위 보드)
//   문 3개   → 채용 / 자격증 / 포트폴리오
//   개인     → Familia / Life Ops (맨 아래 작게)
//
// 안 쓰는 것(공기업 허브·경력 스킬트리·전기직 지도)은 홈에서 내렸다.
// 라우트와 데이터는 그대로 살아 있어 필요할 때 직접 열거나 되살릴 수 있다.

interface Gate {
  href: string
  emoji: string
  title: string
  desc: string
  color: string
  items: string[]
}

const GATES: Gate[] = [
  {
    href: '/jobs',
    emoji: '💼',
    title: '채용 & 이직',
    desc: '취업 확정 이후 — 유지 · 미래 서랍',
    color: '#5DCAA5',
    items: ['칸반 (공기업·사기업 전부)', '마감 타임라인', '면접 · 이직 대비'],
  },
  {
    href: '/dashboard/certs',
    emoji: '📚',
    title: '자격증',
    desc: '진행 · 예정 · 취득으로 상태 관리',
    color: '#85B7EB',
    items: ['진행 중 · 예정 · 취득', '기출 · 오답 · 채점', '해낸 것들'],
  },
  {
    href: '/dashboard/portfolio',
    emoji: '🌀',
    title: '포트폴리오',
    desc: '앞으로 커질 축',
    color: '#F0997B',
    items: ['찬란한 무용함', '레퍼런스 라이브러리'],
  },
]

function GateCard({ g }: { g: Gate }) {
  return (
    <Link href={g.href}
      className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-6 transition flex flex-col h-full group">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{g.emoji}</span>
        <div>
          <h2 className="text-lg font-bold leading-tight" style={{ color: g.color }}>{g.title}</h2>
          <p className="text-[11px] text-gray-500 leading-snug">{g.desc}</p>
        </div>
      </div>
      <ul className="space-y-1 mt-1 flex-1">
        {g.items.map(it => (
          <li key={it} className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="text-gray-700">·</span>{it}
          </li>
        ))}
      </ul>
      <span className="text-gray-700 group-hover:text-gray-400 transition text-sm mt-3 self-end">→</span>
    </Link>
  )
}

function MiniLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-2 bg-gray-900/50 hover:bg-gray-800 rounded-xl px-3 py-2.5 transition">
      <span className="text-base shrink-0">{emoji}</span>
      <span className="text-xs text-gray-400 truncate">{label}</span>
    </Link>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
          <p className="text-gray-500">電気工学 · 수학 · 물리 학습 아카이브</p>
        </div>

        {/* 상시 띠 — 어느 축에도 안 속하지만 항상 봐야 하는 것 (매일 여는 것) */}
        <div className="space-y-2 mb-10">
          <Link href="/dashboard/timeline"
            className="block bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-2xl px-5 py-4 transition">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-300 leading-tight">주요 일정 &amp; 우선순위</p>
                <p className="text-[11px] text-amber-200/60 leading-snug">마감 타임라인(간트) · 3층 우선순위 보드 — 항상 체크</p>
              </div>
              <span className="text-amber-500/50 text-sm shrink-0">→</span>
            </div>
          </Link>
          <Link href="/dashboard/company"
            className="block bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded-2xl px-5 py-4 transition">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏢</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-teal-300 leading-tight">회사생활</p>
                <p className="text-[11px] text-teal-200/60 leading-snug">오늘 체크·업무일지·일정 + 나침반·포트폴리오 — 퇴근 후 반성</p>
              </div>
              <span className="text-teal-500/50 text-sm shrink-0">→</span>
            </div>
          </Link>
        </div>

        {/* 문 3개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {GATES.map(g => <GateCard key={g.href} g={g} />)}
        </div>

        {/* 개인 영역 — 축 밖, 작게 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">개인</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniLink href="/familia" emoji="❤️" label="Familia Choi · Arrieta" />
          <MiniLink href="/lifeops" emoji="🌱" label="Life Ops" />
        </div>

      </div>
    </main>
  )
}
