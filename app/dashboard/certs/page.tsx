'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Cert, CertStatus, CertStatusRow,
  CERTS, STATUS_ORDER, VISIBLE_STATUS_ORDER, STATUS_META, resolveStatuses, certsWith,
} from '@/lib/constants-certs'

// 자격증 문
// -------------------------------------------------------------------
// 홈에서 시험 나열을 걷어내고, 그 전체를 이 문 안으로 접어넣었다.
// 축은 「상태」: 진행 중 → 예정 → 취득. 안 쓰는 것은 보관(obsolete)으로
// 내려 편집 모드에서만 보이고, 본문에는 나오지 않는다.

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

function SectionLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">{children}</p>
      {sub && <p className="text-[10px] text-gray-700">{sub}</p>}
    </div>
  )
}

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

export default function CertsPage() {
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
  const obsolete = certsWith(statusMap, 'obsolete')

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition inline-block">← 홈</Link>
        </div>

        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold mb-1">📚 자격증</h1>
            <p className="text-gray-500 text-sm">진행 중 · 예정 · 취득 — 상태로 관리하는 시험 허브</p>
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
              진행 중 {active.length} · 예정 {planned.length} · 취득 {done.length} · 보관 {obsolete.length}.
              보관은 홈·문 어디에도 안 뜨고 편집 모드에서만 보입니다. 시험 자체를 새로 추가할 때만 lib/constants-certs.ts 에 한 줄을 넣으면 됩니다.
            </p>
          </>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <SectionLabel sub={STATUS_META.active.sub}>{STATUS_META.active.label}</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
                  {active.map(c => <ExamCard key={c.slug} c={c} />)}
                </div>
              </>
            )}

            {planned.length > 0 && (
              <>
                <SectionLabel sub={STATUS_META.planned.sub}>{STATUS_META.planned.label}</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-10">
                  {planned.map(c => <ExamRow key={c.slug} c={c} />)}
                </div>
              </>
            )}

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
