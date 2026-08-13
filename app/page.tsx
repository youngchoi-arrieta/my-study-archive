import Link from 'next/link'

// 홈 정리 원칙
// -------------------------------------------------------------------
// 축을 「국가」가 아니라 「상태」로 잡는다.
//   홈에서 실제로 하는 판단은 "지금 붙잡고 있는 게 뭐냐"지
//   "어느 나라 시험이냐"가 아니다. 국가는 국기 라벨로 충분하다.
//
// 3단 구성:
//   진행 중  → 큰 카드. 지금 실제로 여는 것들.
//   예정     → 한 줄 압축 행. 자리는 잡아두되 시선을 안 뺏는다.
//   취득 완료 → 더 작은 행. 아카이브로 눌러둔다.
//
// 시험이 늘어도 「예정」 줄만 길어지고 상단은 그대로다.

type Flag = '🇯🇵' | '🇰🇷'

// ── 진행 중: 큰 카드 ────────────────────────────────────────────────
function ExamCard({
  href, emoji, flag, org, title, desc,
}: {
  href: string; emoji: string; flag: Flag; org: string; title: string; desc: string
}) {
  return (
    <Link href={href} className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition h-full flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{emoji}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-400">진행 중</span>
      </div>
      <p className="text-xs text-gray-500 tracking-widest mb-1">{flag} {org}</p>
      <h2 className="text-base font-bold mb-1 leading-snug">{title}</h2>
      <p className="text-gray-400 text-xs">{desc}</p>
    </Link>
  )
}

// ── 예정: 한 줄 압축 행 ─────────────────────────────────────────────
function ExamRow({
  href, emoji, flag, title, meta,
}: {
  href: string; emoji: string; flag: Flag; title: string; meta: string
}) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 bg-gray-900/60 hover:bg-gray-800 rounded-xl px-3 py-2.5 transition">
      <span className="text-base shrink-0">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight truncate">{title}</p>
        <p className="text-[10px] text-gray-500 truncate">{flag} {meta}</p>
      </div>
      <span className="text-gray-700 text-xs shrink-0">→</span>
    </Link>
  )
}

// ── 취득 완료: 최소 행 ──────────────────────────────────────────────
function DoneRow({
  href, emoji, flag, title,
}: {
  href: string; emoji: string; flag: Flag; title: string
}) {
  return (
    <Link href={href}
      className="flex items-center gap-2 bg-gray-900/40 hover:bg-gray-800/70 rounded-lg px-3 py-2 transition">
      <span className="text-sm shrink-0 opacity-70">{emoji}</span>
      <p className="text-xs text-gray-400 truncate flex-1">{flag} {title}</p>
      <span className="text-[9px] text-green-500/70 shrink-0">취득</span>
    </Link>
  )
}

function ToolCard({
  href, emoji, title, desc,
}: {
  href: string; emoji: string; title: string; desc: string
}) {
  return (
    <Link href={href} className="block bg-gray-900 hover:bg-gray-800 rounded-xl p-4 transition">
      <span className="text-lg block mb-1">{emoji}</span>
      <h3 className="text-sm font-semibold mb-0.5">{title}</h3>
      <p className="text-gray-500 text-xs">{desc}</p>
    </Link>
  )
}

function SectionLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">{children}</p>
      {sub && <p className="text-[10px] text-gray-700">{sub}</p>}
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
        <p className="text-gray-500 mb-10">電気工学 · 수학 · 물리 학습 아카이브</p>

        {/* 도구 */}
        <SectionLabel>🛠 도구</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <ToolCard href="/jobs"      emoji="💼" title="진로 대시보드"          desc="칸반 · 마감일 · AI 파싱" />
          <ToolCard href="/library"   emoji="📖" title="레퍼런스 라이브러리"    desc="주제별 PDF · 드라이브" />
          <ToolCard href="/portfolio" emoji="🌀" title="찬란한 무용함"          desc="호기심대로 만드는 것들" />
          <ToolCard href="/familia"   emoji="❤️" title="Familia Choi · Arrieta" desc="로드맵 · 2026 · EN / ES" />
        </div>

        {/* 진행 중 */}
        <SectionLabel sub="지금 붙잡고 있는 것">📋 진행 중</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          <ExamCard
            href="/dashboard/jlpt-n4" emoji="🗣" flag="🇯🇵"
            org="일본어능력시험 · 목표 N2" title="JLPT"
            desc="교재 진도 · 채굴 예문 플래시카드" />
          <ExamCard
            href="/dashboard/denken" emoji="🏭" flag="🇯🇵"
            org="일본 경제산업성" title="電験三種"
            desc="20개년 기출 · 과목별 오답메모" />
          <ExamCard
            href="/dashboard/denkoshi/jitsugi" emoji="🔌" flag="🇯🇵"
            org="일본 경제산업성" title="第二種電気工事士 실기"
            desc="후보문제 · 작업 체크리스트" />
        </div>

        {/* 예정 */}
        <SectionLabel sub="자리만 잡아둔 것 · 필요할 때 연다">🗂 예정</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-10">
          <ExamRow href="/dashboard/denken12" emoji="🗼" flag="🇯🇵"
            title="電験一種・二種" meta="연 1회 · 一次 4과목 / 二次 記述式" />
          <ExamRow href="/dashboard/exam/enekan" emoji="⚡" flag="🇯🇵"
            title="エネルギー管理士 (전기)" meta="연 1회 · 4과목 각 60%" />
          <ExamRow href="/dashboard/exam/sekokan1" emoji="🏗" flag="🇯🇵"
            title="1級電気工事施工管理技士" meta="연 1회 · 一次 足切り / 二次 経験記述" />
          <ExamRow href="/dashboard/exam/koutan" emoji="🔗" flag="🇯🇵"
            title="工事担任者 (総合通信)" meta="연 2회 · 3과목 각 60점" />
          <ExamRow href="/dashboard/exam/dentsu-shunin" emoji="📡" flag="🇯🇵"
            title="電気通信主任技術者" meta="연 2회 · 伝送交換 · 設備 150점중 90점" />
          <ExamRow href="/dashboard/exam/gijutsushi" emoji="🎌" flag="🇯🇵"
            title="技術士 1차 (電気電子)" meta="연 1회 · 3과목 각 50%" />
          <ExamRow href="/dashboard/exam/gosi" emoji="🎓" flag="🇰🇷"
            title="기술고시 전기직" meta="5급 공채 · 2차 논술 3과목" />
        </div>

        {/* 취득 완료 */}
        <SectionLabel sub="아카이브">✅ 취득 완료</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <DoneRow href="/dashboard/denkoshi" emoji="🗾" flag="🇯🇵" title="第二種電気工事士 학과" />
          <DoneRow href="/dashboard" emoji="⚡" flag="🇰🇷" title="전기기사 실기" />
          <DoneRow href="/dashboard" emoji="🔧" flag="🇰🇷" title="전기기능사 실기" />
        </div>
      </div>
    </main>
  )
}
