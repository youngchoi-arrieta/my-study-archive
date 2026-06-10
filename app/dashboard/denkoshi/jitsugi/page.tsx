'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  KOUHO_MONDAI, DIFF_LABEL, JITSUGI_EXAM,
  type JitsugiAttempt,
} from '@/lib/constants-denkoshi-jitsugi'
import AttemptDots from './AttemptDots'

const dDay = () => {
  const target = new Date(JITSUGI_EXAM.dates[0] + 'T00:00:00+09:00')
  return Math.ceil((target.getTime() - Date.now()) / 86400000)
}

export default function DenkoshiJitsugiHub() {
  const router = useRouter()
  const [attempts, setAttempts] = useState<JitsugiAttempt[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('denkoshi_jitsugi_attempts')
      .select('id, problem_no, duration_sec, completed, passed_self, defect_codes, notes, created_at')
      .order('created_at', { ascending: false })
    setAttempts((data ?? []) as JitsugiAttempt[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const byProblem = useMemo(() => {
    const m = new Map<number, JitsugiAttempt[]>()
    for (const a of attempts) {
      const arr = m.get(a.problem_no) ?? []
      arr.push(a); m.set(a.problem_no, arr)
    }
    return m
  }, [attempts])

  // 전체 진척: 채점완료(=completed) 시도 수 / 합격 수
  const totalDone = attempts.filter(a => a.completed).length
  const totalPass = attempts.filter(a => a.passed_self).length
  const practiced = byProblem.size
  const passPct = totalDone ? Math.round((totalPass / totalDone) * 100) : 0
  const d = dDay()

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
          <span className="text-gray-700 mx-2">·</span>
          <Link href="/dashboard/denkoshi" className="text-gray-400 hover:text-white text-sm">학과 대시보드</Link>
        </div>

        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🔌</span>
          <h1 className="text-2xl font-bold">第二種電気工事士 실기 트레이너</h1>
          {d > 0 && <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full">D-{d}</span>}
        </div>
        <p className="text-gray-500 text-sm mb-1">
          {JITSUGI_EXAM.label} · 7/18(土)·7/19(日) · 작업시간 40분
        </p>
        <p className="text-amber-400/80 text-xs mb-6">
          ⚠ 점수제 아님 — 欠陥 0개면 합격(🟢) / 1개라도 있으면 불합격(🔴)
        </p>

        {/* 전체 진척 */}
        <div className="bg-gray-900 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-200">전체 진척</span>
            <Link href="/dashboard/denkoshi/jitsugi/stats"
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-lg transition">
              📊 전체 통계
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat label="연습한 문제" value={`${practiced} / 13`} />
            <Stat label="채점완료 시도" value={`${totalDone}회`} />
            <Stat label="합격률" value={`${passPct}%`}
              color={passPct >= 80 ? 'text-green-400' : passPct >= 50 ? 'text-yellow-400' : 'text-red-400'} />
          </div>
          {/* 문제 커버리지 바: 13문 중 최소 1회 합격한 문제 비율 */}
          <CoverageBar byProblem={byProblem} />
        </div>

        {/* 13문 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {KOUHO_MONDAI.map(p => {
            const hist = byProblem.get(p.no) ?? []
            const diff = DIFF_LABEL[p.difficulty]
            const passes = hist.filter(a => a.passed_self).length
            return (
              <button key={p.no}
                onClick={() => router.push(`/dashboard/denkoshi/jitsugi/${p.no}`)}
                className="text-left bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 transition border border-transparent hover:border-blue-600/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-blue-400">No.{p.no}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: diff.color + '22', color: diff.color }}>{diff.ko}</span>
                </div>
                <p className="text-sm leading-snug mb-2">{p.feature}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.tags.map(t => (
                    <span key={t} className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <AttemptDots attempts={hist} />
                  <span className="text-[11px] text-gray-500">
                    {hist.length > 0 ? `${hist.length}회 · 합격 ${passes}` : ''}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {loading && <p className="text-gray-600 text-sm mt-4">불러오는 중…</p>}
      </div>
    </main>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-3">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function CoverageBar({ byProblem }: { byProblem: Map<number, JitsugiAttempt[]> }) {
  // 각 문제 상태: 미연습(회색) / 연습했지만 미합격(빨강) / 합격(초록)
  return (
    <div>
      <div className="flex gap-1">
        {KOUHO_MONDAI.map(p => {
          const hist = byProblem.get(p.no) ?? []
          const passed = hist.some(a => a.passed_self)
          const tried = hist.length > 0
          const bg = passed ? '#22c55e' : tried ? '#ef4444' : '#374151'
          return (
            <div key={p.no} title={`No.${p.no}`}
              className="flex-1 h-2 rounded-full" style={{ background: bg }} />
          )
        })}
      </div>
      <p className="text-[10px] text-gray-600 mt-1.5">
        13문 커버리지 — 🟢 합격 · 🔴 연습했으나 미합격 · ⚪ 미연습
      </p>
    </div>
  )
}
