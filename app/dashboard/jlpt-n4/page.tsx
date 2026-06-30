'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ───────────────────────────────────────────────────────────────
// JLPT 허브 (목표: N2)
//   탭: 📚 교재  /  🔥 매일 루틴  /  🃏 플래시카드
//   - 교재 진도는 jp_books / jp_nodes (자유 추가형) 기반
//   - 매일 루틴은 jlpt_n4_daily (청해·어휘 스트릭) — 표만 재사용
// ───────────────────────────────────────────────────────────────

type Book = { id: string; title: string; tag: string | null; color: string; sort_order: number }
type Node = { id: string; book_id: string; parent_id: string | null; status: 0 | 1 | 2 }

// 교재별 말단 완료/전체 집계 (플랫 노드로 계산)
function bookProgress(nodes: Node[], bookId: string): { done: number; total: number; weak: number } {
  const own = nodes.filter(n => n.book_id === bookId)
  const childOf = new Map<string | null, Node[]>()
  own.forEach(n => {
    const arr = childOf.get(n.parent_id) ?? []
    arr.push(n); childOf.set(n.parent_id, arr)
  })
  const isLeaf = (id: string) => !(childOf.get(id)?.length)
  const leaves = own.filter(n => isLeaf(n.id))
  return {
    total: leaves.length,
    done: leaves.filter(n => n.status >= 1).length,
    weak: leaves.filter(n => n.status === 2).length,
  }
}

// ── 매일 루틴 ────────────────────────────────────────────────────
const DAILY_PARTS = ['청해', '문자·어휘'] as const
type DailyPart = typeof DAILY_PARTS[number]
const DAILY_COLOR: Record<DailyPart, string> = { '청해': '#b45309', '문자·어휘': '#2563eb' }

type DailyRow = { date: string; part: string; done: boolean }

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return toDateStr(d)
  })
}

// ── 메인 ────────────────────────────────────────────────────────
export default function JlptHub() {
  const [activeTab, setActiveTab] = useState<'books' | 'daily' | 'cards'>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: bk }, { data: nd }, { data: daily }] = await Promise.all([
      supabase.from('jp_books').select('id, title, tag, color, sort_order')
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('jp_nodes').select('id, book_id, parent_id, status'),
      supabase.from('jlpt_n4_daily').select('date, part, done'),
    ])
    setBooks((bk as Book[]) || [])
    setNodes((nd as Node[]) || [])
    setDailyRows((daily as DailyRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // 매일 루틴 토글
  const toggleDaily = async (date: string, part: DailyPart) => {
    const existing = dailyRows.find(r => r.date === date && r.part === part)
    const newDone = !(existing?.done ?? false)
    setDailyRows(prev => [...prev.filter(r => !(r.date === date && r.part === part)), { date, part, done: newDone }])
    await supabase.from('jlpt_n4_daily').upsert({ date, part, done: newDone }, { onConflict: 'date,part' })
  }

  const days = last30Days()
  const today = toDateStr(new Date())
  const dailyMap = useMemo(() => {
    const m = new Map<string, boolean>()
    dailyRows.forEach(r => m.set(`${r.date}__${r.part}`, r.done))
    return m
  }, [dailyRows])

  // 전체 교재 진도 요약
  const overall = useMemo(() => {
    return books.reduce((acc, b) => {
      const p = bookProgress(nodes, b.id)
      return { done: acc.done + p.done, total: acc.total + p.total }
    }, { done: 0, total: 0 })
  }, [books, nodes])
  const overallPct = overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗣</span>
          <h1 className="text-2xl font-bold">JLPT</h1>
          <span className="text-xs bg-emerald-600/30 text-emerald-400 px-2 py-0.5 rounded-full">목표 N2</span>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          독해·어휘 양치기 · 교재 자유 추가 · 채굴 예문 플래시카드
        </p>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { key: 'books', label: '📚 교재' },
            { key: 'daily', label: '🔥 매일 루틴' },
            { key: 'cards', label: '🃏 플래시카드' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 교재 탭 ── */}
        {activeTab === 'books' && (
          <div>
            {/* 전체 진도 요약 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-widest">전체 진도</span>
                <span className="text-sm font-bold text-blue-400">
                  {overall.done}/{overall.total} · {overallPct}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${overallPct}%` }} />
              </div>
            </div>

            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : books.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">아직 등록한 교재가 없어요.</p>
                <Link href="/dashboard/jlpt-n4/books"
                  className="inline-block bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-lg text-sm font-semibold transition">
                  + 첫 교재 추가하기
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {books.map(b => {
                    const p = bookProgress(nodes, b.id)
                    const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100)
                    return (
                      <Link
                        key={b.id}
                        href={`/dashboard/jlpt-n4/books?book=${b.id}`}
                        className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 transition"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                          {b.tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold">{b.tag}</span>}
                          <span className="text-[10px] text-gray-600 ml-auto">
                            {p.done}/{p.total}{p.weak > 0 && <span className="text-amber-500"> · 약점 {p.weak}</span>}
                          </span>
                        </div>
                        <p className="font-bold text-sm leading-snug mb-2">{b.title}</p>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                        </div>
                      </Link>
                    )
                  })}
                </div>
                <Link href="/dashboard/jlpt-n4/books"
                  className="block text-center border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3 text-sm transition">
                  + 교재 추가 · 목차 관리
                </Link>
              </>
            )}
          </div>
        )}

        {/* ── 매일 루틴 탭 ── */}
        {activeTab === 'daily' && (
          <div>
            <p className="text-xs text-gray-500 mb-4">청해와 어휘는 매일 반복이 기본. 오늘 체크하면 스트릭에 기록됩니다.</p>

            <div className="bg-gray-900 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">오늘 ({today})</p>
              <div className="flex gap-3">
                {DAILY_PARTS.map(part => {
                  const done = dailyMap.get(`${today}__${part}`) ?? false
                  return (
                    <button
                      key={part}
                      onClick={() => toggleDaily(today, part)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${done ? 'text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
                      style={done ? { backgroundColor: DAILY_COLOR[part] } : undefined}
                    >
                      {done ? '✓ ' : ''}{part}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">30일 스트릭</p>
              <div className="space-y-4">
                {DAILY_PARTS.map(part => {
                  const color = DAILY_COLOR[part]
                  const streak = (() => {
                    let s = 0
                    for (let i = days.length - 1; i >= 0; i--) {
                      if (dailyMap.get(`${days[i]}__${part}`)) s++; else break
                    }
                    return s
                  })()
                  const total30 = days.filter(d => dailyMap.get(`${d}__${part}`)).length
                  return (
                    <div key={part}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm font-medium">{part}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-600">연속 {streak}일</span>
                          <span className="text-xs text-gray-600">{total30}/30일</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {days.map(d => {
                          const done = dailyMap.get(`${d}__${part}`) ?? false
                          const isToday = d === today
                          return (
                            <button
                              key={d}
                              onClick={() => toggleDaily(d, part)}
                              title={d}
                              className={`h-5 flex-1 rounded-sm transition ${isToday ? 'ring-1 ring-white/30' : ''}`}
                              style={{ backgroundColor: done ? color : '#1f2937', opacity: done ? 1 : 0.4 }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 플래시카드 탭 ── */}
        {activeTab === 'cards' && (
          <div className="space-y-2">
            <Link href="/flashcard?exam=jlpt-n4"
              className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-4 transition">
              <div>
                <p className="text-sm font-semibold">🃏 단어·문형 플래시카드</p>
                <p className="text-xs text-gray-500 mt-0.5">채굴한 예문 cloze · 음성 인출 훈련</p>
              </div>
              <span className="text-gray-600 text-xs">→</span>
            </Link>
            <Link href="/dashboard/jlpt-n4/verb-practice"
              className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-4 transition">
              <div>
                <p className="text-sm font-semibold">⚡ 動詞活用練習</p>
                <p className="text-xs text-gray-500 mt-0.5">동사 활용형 반사신경 트레이닝</p>
              </div>
              <span className="text-gray-600 text-xs">→</span>
            </Link>
          </div>
        )}

      </div>
    </main>
  )
}
