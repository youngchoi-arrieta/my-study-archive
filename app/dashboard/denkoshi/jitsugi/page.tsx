'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  KOUHO_MONDAI, DIFF_LABEL, JITSUGI_EXAM,
  type Difficulty,
} from '@/lib/constants-denkoshi-jitsugi'

const FELT_ORDER: Difficulty[] = ['easy', 'mid', 'hard']

export default function DenkoshiJitsugiHub() {
  // 후보문제 no → 체감 난이도(felt_difficulty). 미설정이면 map에 없음.
  const [felt, setFelt] = useState<Map<number, Difficulty>>(new Map())
  // 후보문제 no → 연습 회차 수(attempts count)
  const [attemptCount, setAttemptCount] = useState<Map<number, number>>(new Map())
  const [savingNo, setSavingNo] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [{ data, error }, { data: atts }] = await Promise.all([
      supabase.from('denkoshi_jitsugi_problems').select('no, felt_difficulty'),
      supabase.from('denkoshi_jitsugi_attempts').select('problem_no'),
    ])
    if (!error && data) {
      const m = new Map<number, Difficulty>()
      for (const row of data as { no: number; felt_difficulty: Difficulty | null }[]) {
        if (row.felt_difficulty) m.set(row.no, row.felt_difficulty)
      }
      setFelt(m)
    }
    if (atts) {
      const c = new Map<number, number>()
      for (const row of atts as { problem_no: number }[]) {
        c.set(row.problem_no, (c.get(row.problem_no) ?? 0) + 1)
      }
      setAttemptCount(c)
    }
    // 컬럼/테이블이 아직 없어도(마이그레이션 미적용) 페이지는 정상 동작
  }, [])

  useEffect(() => { load() }, [load])

  // 같은 값 다시 누르면 해제(null), 아니면 해당 값으로 설정
  const setFeltFor = async (no: number, d: Difficulty) => {
    const cur = felt.get(no)
    const next: Difficulty | null = cur === d ? null : d
    setFelt(prev => {
      const m = new Map(prev)
      if (next) m.set(no, next); else m.delete(no)
      return m
    })
    setSavingNo(no)
    await supabase.from('denkoshi_jitsugi_problems').upsert(
      { no, felt_difficulty: next, updated_at: new Date().toISOString() },
      { onConflict: 'no' },
    )
    setSavingNo(null)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-3xl">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🔌</span>
          <h1 className="text-2xl font-bold">第二種電気工事士 실기</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">{JITSUGI_EXAM.label} · 7/18·7/19 · 작업시간 40분</p>

        {/* 단위작업 진입 */}
        <Link
          href="/dashboard/denkoshi/jitsugi/units"
          className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-2xl px-5 py-4 mb-3 transition"
        >
          <div>
            <p className="text-sm font-semibold">🧰 단위작업</p>
            <p className="text-xs text-gray-500 mt-0.5">HOZAN 単位作業 20개 · 캡쳐 이미지 + 캡션 정리</p>
          </div>
          <span className="text-gray-600 text-xs">→</span>
        </Link>

        {/* 시공 리스크 관리 진입 */}
        <Link
          href="/dashboard/denkoshi/jitsugi/risks"
          className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-2xl px-5 py-4 mb-6 transition"
        >
          <div>
            <p className="text-sm font-semibold">⚠️ 시공 리스크 관리</p>
            <p className="text-xs text-gray-500 mt-0.5">치수 · 유의사항 · 候補問題 태깅 · 🧵 전선 소요량</p>
          </div>
          <span className="text-gray-600 text-xs">→</span>
        </Link>
        </div>

        {/* 후보문제 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">候補問題 No.1~13</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {KOUHO_MONDAI.map(p => {
            const f = felt.get(p.no)                     // 체감 난이도(내 태깅)
            const fLabel = f ? DIFF_LABEL[f] : null
            const n = attemptCount.get(p.no) ?? 0        // 연습 회차 수
            return (
              <div key={p.no} className="bg-gray-900 rounded-2xl p-4">
                <Link
                  href={`/dashboard/denkoshi/jitsugi/${p.no}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-blue-400 group-hover:text-blue-300 transition">No.{p.no}</span>
                      <span className={`text-[10px] ${n > 0 ? 'text-gray-400' : 'text-gray-600'}`}>
                        {n > 0 ? `🔁 ${n}회` : '미연습'}
                      </span>
                    </span>
                    {/* 체감 난이도 — 설정돼 있으면 강조 배지 */}
                    {fLabel && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: fLabel.color, color: '#fff' }}>
                        체감 {fLabel.ko}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 leading-snug group-hover:text-white transition">{p.feature}</p>
                  <p className="text-xs text-gray-600 mt-1">{p.featureJa}</p>
                </Link>

                {/* 체감 난이도 태깅 (카드 이동과 분리) */}
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-800">
                  <span className="text-[10px] text-gray-500 mr-0.5">체감</span>
                  {FELT_ORDER.map(d => {
                    const on = f === d
                    const dl = DIFF_LABEL[d]
                    return (
                      <button
                        key={d}
                        onClick={() => setFeltFor(p.no, d)}
                        className="flex-1 text-[11px] py-1 rounded-lg font-semibold transition border"
                        style={on
                          ? { background: dl.color, color: '#fff', borderColor: dl.color }
                          : { background: 'transparent', color: '#9ca3af', borderColor: '#374151' }}
                      >
                        {dl.ko}
                      </button>
                    )
                  })}
                  {savingNo === p.no && <span className="text-[10px] text-gray-600 ml-0.5">…</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
