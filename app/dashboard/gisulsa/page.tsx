'use client'

// 한국 기술사 허브 — /dashboard/gisulsa
// -------------------------------------------------------------------
// 일본 시험 허브와 화면을 나눈 이유는 구조가 달라서다.
// 덴켄·에관사는 「과목별 점수」가 축이지만 기술사는 과목이 없고
// 31문 중 9문을 버리는 선택제라, 축이 회차가 아니라 토픽이다.
// 그래서 허브 첫 화면도 회차 목록이 아니라 종목 + 서브노트 보드로 간다.

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  GISULSA_SPECS, SESSION_SPECS, PICK_TOTAL, DROP_TOTAL, FULL_MARK, PASS_MARK,
} from '@/lib/constants-gisulsa'
import { seedOf, loadDbQuestions, mergeQuestions, loadDenkenRefs } from '@/lib/gisulsaData'
import { TOPICS, isKoreaOnly } from '@/lib/constants-topics'
import type { GisulsaQuestion } from '@/lib/constants-gisulsa'

export default function GisulsaHub() {
  const [db, setDb] = useState<GisulsaQuestion[]>([])
  const [jpCount, setJpCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      const [rows, refs] = await Promise.all([loadDbQuestions(), loadDenkenRefs()])
      setDb(rows)
      setJpCount([...refs.values()].reduce((a, v) => a + v.length, 0))
      setLoaded(true)
    })()
  }, [])

  const perJong = useMemo(() => {
    const m: Record<string, GisulsaQuestion[]> = {}
    GISULSA_SPECS.forEach(s => {
      m[s.slug] = mergeQuestions(seedOf(s.slug), db.filter(q => q.jong === s.slug))
    })
    return m
  }, [db])

  const totalQ = Object.values(perJong).reduce((a, v) => a + v.length, 0)
  // 서브노트 장수 = 기출에 실제로 등장한 태그(논점) 수
  const sheets = new Set(Object.values(perJong).flat().flatMap(q => q.topics)).size
  const krOnly = TOPICS.filter(isKoreaOnly).length

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🇰🇷</span>
          <h1 className="text-2xl font-bold">한국 기술사</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          하루 4교시 · 전 교시 합산 {PASS_MARK}/{FULL_MARK}점이면 합격.
          과목도 과목합격도 없고 {PICK_TOTAL + DROP_TOTAL}문 중 <b className="text-gray-300">{DROP_TOTAL}문을 버릴 수 있다</b>.
          전 범위 커버가 아니라 버릴 것을 정하는 시험이라, 이 허브의 축은 회차가 아니라 토픽이다.
        </p>

        {/* 서브노트 보드 — 이 허브의 본체 */}
        <Link href="/dashboard/gisulsa/subnote"
          className="block bg-gradient-to-br from-blue-900/40 to-violet-900/30 hover:from-blue-900/60 hover:to-violet-900/50 border border-blue-800/40 rounded-2xl p-5 mb-6 transition">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] text-blue-300/70 tracking-widest uppercase mb-1">Subnote priority board</p>
              <h2 className="text-lg font-bold mb-1">📐 서브노트 우선순위 보드</h2>
              <p className="text-gray-400 text-xs leading-relaxed">
                기술사 기출과 電験 1·2종 출제를 같은 주제 체계로 묶는다. 대주제로 분류하고
                논점으로 쪼개, 서브노트 한 장이 양쪽에서 동시에 쓰이는 순서대로 정렬한다.
              </p>
            </div>
            <span className="text-gray-600 shrink-0">→</span>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-[11px]">
            <span className="text-gray-500">대주제 <b className="text-gray-200">{TOPICS.length}</b></span>
            <span className="text-gray-500">서브노트 <b className="text-gray-200">{sheets}</b>장</span>
            <span className="text-gray-500">태깅된 기술사 문항 <b className="text-blue-300">{totalQ}</b></span>
            <span className="text-gray-500">電験 참조 <b className="text-violet-300">{loaded ? jpCount : '…'}</b></span>
            <span className="text-gray-500">한국 전용 토픽 <b className="text-amber-300">{krOnly}</b></span>
          </div>
        </Link>

        {/* 종목 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">📚 종목</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {GISULSA_SPECS.map(s => {
            const qs = perJong[s.slug] ?? []
            const exams = new Set(qs.map(q => q.exam)).size
            const has = qs.length > 0
            return (
              <Link key={s.slug} href={`/dashboard/gisulsa/${s.slug}`}
                className="bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={has
                      ? { backgroundColor: `${s.accent}30`, color: s.accent }
                      : { backgroundColor: '#1f2937', color: '#6b7280' }}>
                    {has ? `${exams}개 회차 · ${qs.length}문항` : '기출 미입력'}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-1">{s.name}</h3>
                <p className="text-gray-400 text-xs leading-relaxed flex-1">{s.intro}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {s.focus.map(f => (
                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{f}</span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>

        {/* 교시 구조 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">🕐 교시 구조 (전 종목 공통)</p>
        <div className="bg-gray-900 rounded-2xl p-4 mb-6">
          <div className="space-y-2">
            {SESSION_SPECS.map(s => (
              <div key={s.session} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[12px] font-bold text-gray-300">{s.session}교시</span>
                <span className="w-28 shrink-0 text-[11px] text-gray-500 tabular-nums">
                  {s.total}문 중 {s.pick}문
                </span>
                <span className="w-16 shrink-0 text-[11px] text-gray-600 tabular-nums">{s.points}점</span>
                <span className="text-[11px] text-gray-600 truncate">{s.note}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-700 mt-3 leading-relaxed">
            총 {PICK_TOTAL + DROP_TOTAL}문 출제 · {PICK_TOTAL}문 작성 · {FULL_MARK}점 만점.
            400분 동안 손글씨로 40페이지 안팎을 쓴다. 실제 병목은 지식이 아니라 작성 속도다.
          </p>
        </div>

        {!loaded && <p className="text-[10px] text-gray-700">불러오는 중...</p>}
      </div>
    </main>
  )
}
