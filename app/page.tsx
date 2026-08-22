'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Cert, CertStatus, CertStatusRow,
  CERTS, STATUS_ORDER, STATUS_META, resolveStatuses, certsWith,
} from '@/lib/constants-certs'

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
// 상태는 편집 모드에서 직접 바꾼다. 시험 하나가 다음 단계로
// 넘어갈 때 코드를 고치러 오지 않아도 되도록.

function ExamCard({ c }: { c: Cert }) {
  return (
    <Link href={c.href} className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition h-full flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{c.emoji}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/30 text-blue-400">진행 중</span>
      </div>
      <p className="text-xs text-gray-500 tracking-widest mb-1">{c.flag} {c.org}</p>
      <h2 className="text-base font-bold mb-1 leading-snug">{c.title}</h2>
      <p className="text-gray-400 text-xs">{c.desc}</p>
    </Link>
  )
}

function ExamRow({ c }: { c: Cert }) {
  return (
    <Link href={c.href}
      className="flex items-center gap-2.5 bg-gray-900/60 hover:bg-gray-800 rounded-xl px-3 py-2.5 transition">
      <span className="text-base shrink-0">{c.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight truncate">{c.title}</p>
        <p className="text-[10px] text-gray-500 truncate">{c.flag} {c.meta}</p>
      </div>
      <span className="text-gray-700 text-xs shrink-0">→</span>
    </Link>
  )
}

function DoneRow({ c }: { c: Cert }) {
  return (
    <Link href={c.href}
      className="flex items-center gap-2 bg-gray-900/40 hover:bg-gray-800/70 rounded-lg px-3 py-2 transition">
      <span className="text-sm shrink-0 opacity-70">{c.emoji}</span>
      <p className="text-xs text-gray-400 truncate flex-1">{c.flag} {c.title}</p>
      <span className="text-[9px] text-green-500/70 shrink-0">취득</span>
    </Link>
  )
}

function ToolCard({ href, emoji, title, desc }: {
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

// ── 편집 모드: 상태 선택기 한 줄 ───────────────────────────────────
function EditRow({ c, status, onChange, busy }: {
  c: Cert; status: CertStatus; onChange: (s: CertStatus) => void; busy: boolean
}) {
  return (
    <div className="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2.5">
      <span className="text-base shrink-0 w-6 text-center">{c.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight truncate">
          <span className="text-gray-600 mr-1">{c.flag}</span>{c.title}
        </p>
        <p className="text-[10px] text-gray-600 truncate">{c.org}</p>
      </div>
      <div className="flex gap-0.5 bg-gray-950 rounded-lg p-0.5 shrink-0">
        {STATUS_ORDER.map(s => (
          <button key={s} onClick={() => onChange(s)} disabled={busy}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition disabled:opacity-50 ${
              status === s ? STATUS_META[s].chip : 'text-gray-600 hover:text-gray-400'
            }`}>
            {STATUS_META[s].short}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [overrides, setOverrides] = useState<CertStatusRow[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase.from('cert_status').select('slug, status, sort')
    setOverrides((data as CertStatusRow[]) || [])
    setLoaded(true)
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const statusMap = useMemo(() => resolveStatuses(overrides), [overrides])

  const setStatus = async (slug: string, status: CertStatus) => {
    if (busy) return
    setBusy(true)
    // 낙관적 갱신
    setOverrides(prev => {
      const rest = prev.filter(o => o.slug !== slug)
      return [...rest, { slug, status, sort: null }]
    })
    await supabase.from('cert_status')
      .upsert({ slug, status, updated_at: new Date().toISOString() }, { onConflict: 'slug' })
    setBusy(false)
  }

  const active = certsWith(statusMap, 'active')
  const planned = certsWith(statusMap, 'planned')
  const done = certsWith(statusMap, 'done')

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold mb-1">⚡ 나의 전기공학 도장</h1>
            <p className="text-gray-500">電気工学 · 수학 · 물리 학습 아카이브</p>
          </div>
          <button onClick={() => setEditing(v => !v)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              editing ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
            }`}>
            {editing ? '완료' : '✎ 상태 편집'}
          </button>
        </div>

        {editing ? (
          <>
            <SectionLabel sub="상태를 눌러 옮기면 바로 저장됩니다">🎛 상태 편집</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
              {CERTS.map(c => (
                <EditRow key={c.slug} c={c} status={statusMap[c.slug]} busy={busy}
                  onChange={s => setStatus(c.slug, s)} />
              ))}
            </div>
            <p className="text-[10px] text-gray-700 leading-relaxed">
              진행 중 {active.length} · 예정 {planned.length} · 취득 {done.length}.
              시험 자체를 새로 추가할 때만 lib/constants-certs.ts 에 한 줄을 넣으면 됩니다.
            </p>
          </>
        ) : (
          <>
            {/* 도구 */}
            <SectionLabel>🛠 도구</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 mb-10">
              <ToolCard href="/dashboard/achievements" emoji="🏅" title="해낸 것들" desc="자격증·어학 연표 · 증빙 PDF" />
              <ToolCard href="/dashboard/timeline" emoji="🗓" title="시험 일정" desc="접수·시험일 간트 · 트랙 통합" />
              <ToolCard href="/jobs" emoji="💼" title="진로 대시보드" desc="칸반 · 마감일 · AI 파싱" />
              <ToolCard href="/library" emoji="📖" title="레퍼런스 라이브러리" desc="주제별 PDF · 드라이브" />
              <ToolCard href="/portfolio" emoji="🌀" title="찬란한 무용함" desc="호기심대로 만드는 것들" />
              <ToolCard href="/familia" emoji="❤️" title="Familia Choi · Arrieta" desc="로드맵 · 2026 · EN / ES" />
            </div>

            {/* 진행 중 */}
            {active.length > 0 && (
              <>
                <SectionLabel sub={STATUS_META.active.sub}>{STATUS_META.active.label}</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
                  {active.map(c => <ExamCard key={c.slug} c={c} />)}
                </div>
              </>
            )}

            {/* 예정 */}
            {planned.length > 0 && (
              <>
                <SectionLabel sub={STATUS_META.planned.sub}>{STATUS_META.planned.label}</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-10">
                  {planned.map(c => <ExamRow key={c.slug} c={c} />)}
                </div>
              </>
            )}

            {/* 취득 완료 */}
            {done.length > 0 && (
              <>
                <SectionLabel sub={STATUS_META.done.sub}>{STATUS_META.done.label}</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {done.map(c => <DoneRow key={c.slug} c={c} />)}
                </div>
              </>
            )}

            {!loaded && (
              <p className="text-[10px] text-gray-700 mt-6">상태 불러오는 중...</p>
            )}
          </>
        )}

      </div>
    </main>
  )
}
