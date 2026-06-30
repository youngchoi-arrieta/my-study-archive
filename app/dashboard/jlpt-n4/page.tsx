'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ───────────────────────────────────────────────────────────────
// JLPT 허브 (목표: N2)
//   탭: 📚 교재  /  🃏 플래시카드
// ───────────────────────────────────────────────────────────────

type Book = { id: string; title: string; tag: string | null; color: string; sort_order: number }
type Node = { id: string; book_id: string; parent_id: string | null; status: 0 | 1 | 2 }

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

export default function JlptHub() {
  const [activeTab, setActiveTab] = useState<'books' | 'cards'>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: bk }, { data: nd }] = await Promise.all([
      supabase.from('jp_books').select('id, title, tag, color, sort_order')
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('jp_nodes').select('id, book_id, parent_id, status'),
    ])
    setBooks((bk as Book[]) || [])
    setNodes((nd as Node[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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

        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { key: 'books', label: '📚 교재' },
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

        {activeTab === 'books' && (
          <div>
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

        {activeTab === 'cards' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-1">교재를 골라 들어가면 그 교재의 덱만 모여요. 덱 안에서는 어휘·문법·문형 태그로 분류됩니다.</p>
            {books.map(b => (
              <Link key={b.id} href={`/flashcard?exam=jlpt-n4&book=${b.id}`}
                className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-4 transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">📘 {b.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">덱 만들기·관리 {b.tag ? `· ${b.tag}` : ''}</p>
                  </div>
                </div>
                <span className="text-gray-600 text-xs shrink-0">→</span>
              </Link>
            ))}
            <Link href="/flashcard?exam=jlpt-n4&book=none"
              className="flex items-center justify-between bg-gray-900/60 hover:bg-gray-800 rounded-xl px-4 py-3 transition">
              <div>
                <p className="text-sm font-semibold text-gray-300">🗂 미분류 카드</p>
                <p className="text-xs text-gray-600 mt-0.5">교재에 묶이지 않은 기존 덱</p>
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
