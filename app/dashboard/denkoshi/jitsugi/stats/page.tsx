'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  KOUHO_MONDAI, KEKKAN_ITEM_MAP, fmtDur,
  type JitsugiAttempt,
} from '@/lib/constants-denkoshi-jitsugi'
import AttemptDots from '../AttemptDots'

export default function JitsugiStatsPage() {
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

  // 자주 나오는 欠陥 TOP
  const topDefects = useMemo(() => {
    const cnt = new Map<string, number>()
    for (const a of attempts)
      for (const c of (a.defect_codes ?? []))
        cnt.set(c, (cnt.get(c) ?? 0) + 1)
    return Array.from(cnt.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [attempts])

  const totalDone = attempts.filter(a => a.completed).length
  const totalPass = attempts.filter(a => a.passed_self).length
  const passedProblems = KOUHO_MONDAI.filter(p => (byProblem.get(p.no) ?? []).some(a => a.passed_self)).length

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-2">
          <Link href="/dashboard/denkoshi/jitsugi" className="text-gray-400 hover:text-white text-sm">← 트레이너</Link>
        </div>
        <h1 className="text-2xl font-bold mb-1">📊 실기 전체 통계</h1>
        <p className="text-gray-500 text-sm mb-6">13문 진척 · 시간 단축 · 자주 내는 欠陥</p>

        {/* 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="합격한 문제" value={`${passedProblems} / 13`} />
          <Stat label="채점완료 시도" value={`${totalDone}회`} />
          <Stat label="합격 시도" value={`${totalPass}회`} color="text-green-400" />
          <Stat label="합격률" value={totalDone ? `${Math.round(totalPass / totalDone * 100)}%` : '–'} />
        </div>

        {/* 문제별 진척 테이블 */}
        <div className="bg-gray-900 rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold mb-3">문제별 진척 · 베스트 타임</p>
          <div className="space-y-1">
            {KOUHO_MONDAI.map(p => {
              const hist = byProblem.get(p.no) ?? []
              const durs = hist.map(a => a.duration_sec).filter((d): d is number => d != null)
              const best = durs.length ? Math.min(...durs) : null
              const first = durs.length ? durs[durs.length - 1] : null // 가장 오래된(=첫) 기록은 배열 끝(desc 정렬)
              const improved = best != null && first != null && first > best
              return (
                <Link key={p.no} href={`/dashboard/denkoshi/jitsugi/${p.no}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition">
                  <span className="font-bold text-blue-400 w-10 text-sm shrink-0">No.{p.no}</span>
                  <span className="text-xs text-gray-400 w-40 truncate shrink-0">{p.feature}</span>
                  <div className="w-28 shrink-0"><AttemptDots attempts={hist} size={9} /></div>
                  <span className="text-xs text-gray-500 ml-auto shrink-0">
                    {best != null ? <>베스트 <span className="font-mono text-gray-300">{fmtDur(best)}</span></> : '–'}
                    {improved && <span className="text-green-400 ml-1">↓</span>}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* 자주 내는 欠陥 */}
        <div className="bg-gray-900 rounded-2xl p-5">
          <p className="text-sm font-semibold mb-3">내가 자주 내는 欠陥 TOP</p>
          {topDefects.length === 0 ? (
            <p className="text-gray-600 text-sm">아직 기록된 欠陥이 없어요. (또는 전부 합격!)</p>
          ) : (
            <div className="space-y-2">
              {topDefects.map(([code, n]) => {
                const it = KEKKAN_ITEM_MAP.get(code)
                const max = topDefects[0][1]
                return (
                  <div key={code} className="flex items-center gap-3">
                    <span className="text-xs w-44 shrink-0" style={{ color: it?.catColor ?? '#9ca3af' }}>
                      {code} {it?.ko ?? ''}
                    </span>
                    <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: it?.catColor ?? '#6b7280' }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right shrink-0">×{n}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {loading && <p className="text-gray-600 text-sm mt-4">불러오는 중…</p>}
      </div>
    </main>
  )
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
