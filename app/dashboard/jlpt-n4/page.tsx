'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TRAINERS, TRAINER_GROUPS } from '@/lib/constants-jlpt-trainers'
import { MockRow, levelSpec, verdict } from '@/lib/constants-jlpt-mocks'
import { BookStatus, BOOK_STATUS_META, BOOK_STATUS_NEXT, normalizeBookStatus } from '@/lib/constants-jlpt-books'
import BookStatusChip from './_components/BookStatusChip'

// ───────────────────────────────────────────────────────────────
// JLPT 허브 (목표: N2)
//   탭: 📚 교재  /  🃏 덱  /  🎯 트레이닝
//
//   덱은 교재에서 채굴한 것이라 교재 수만큼 늘어나고,
//   트레이닝은 규칙 단위라 주제 수만큼 늘어난다.
//   증가 축이 다르니 한 리스트에 섞지 않고 탭을 나눈다.
//   트레이닝 목록은 lib/constants-jlpt-trainers.ts에서 자동 생성.
// ───────────────────────────────────────────────────────────────

type Tab = 'books' | 'decks' | 'train'
type Book = { id: string; title: string; tag: string | null; color: string; sort_order: number; status: BookStatus }
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

function BookSectionLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">{children}</p>
      {sub && <p className="text-[10px] text-gray-700">{sub}</p>}
    </div>
  )
}

export default function JlptHub() {
  const [activeTab, setActiveTab] = useState<Tab>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [latestMock, setLatestMock] = useState<MockRow | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: bk }, { data: nd }, { data: mk }] = await Promise.all([
      supabase.from('jp_books').select('id, title, tag, color, sort_order, status')
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('jp_nodes').select('id, book_id, parent_id, status'),
      supabase.from('jlpt_mocks').select('*')
        .order('taken_on', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    ])
    setBooks(((bk as Book[]) || []).map(b => ({ ...b, status: normalizeBookStatus(b.status) })))
    setNodes((nd as Node[]) || [])
    setLatestMock(((mk as MockRow[]) || [])[0] ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // 허브에서도 바로 상태를 옮긴다. 교재 목록까지 들어가야만 분류할 수 있으면
  // 정작 매일 여는 화면에서는 아무것도 못 바꾸는 셈이 된다.
  const cycleStatus = async (b: Book) => {
    const next = BOOK_STATUS_NEXT[b.status]
    setBooks(prev => prev.map(x => x.id === b.id ? { ...x, status: next } : x))
    const { error } = await supabase.from('jp_books')
      .update({ status: next, status_updated_at: new Date().toISOString() }).eq('id', b.id)
    if (error) {
      setBooks(prev => prev.map(x => x.id === b.id ? { ...x, status: b.status } : x))
      alert(`상태를 바꾸지 못했습니다.\n${error.message}`)
    }
  }

  const byStatus = useMemo(() => ({
    active: books.filter(b => b.status === 'active'),
    planned: books.filter(b => b.status === 'planned'),
    done: books.filter(b => b.status === 'done'),
  }), [books])

  // 전체 진도는 「예정」을 뺀다 — 아직 펴지도 않은 교재가 비율을 눌러버리면
  // 진도 막대가 실제 상태를 못 보여준다.
  const overall = useMemo(() => {
    return books.filter(b => b.status !== 'planned').reduce((acc, b) => {
      const p = bookProgress(nodes, b.id)
      return { done: acc.done + p.done, total: acc.total + p.total }
    }, { done: 0, total: 0 })
  }, [books, nodes])
  const overallPct = overall.total === 0 ? 0 : Math.round((overall.done / overall.total) * 100)

  const needle = q.trim().toLowerCase()
  const STATUS_RANK: Record<BookStatus, number> = { active: 0, planned: 1, done: 2 }
  const filteredBooks = useMemo(
    () => (needle ? books.filter(b => b.title.toLowerCase().includes(needle)) : books)
      .slice()
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [books, needle],
  )
  const filteredTrainers = useMemo(() => {
    if (!needle) return TRAINERS
    return TRAINERS.filter(t =>
      t.ja.toLowerCase().includes(needle) ||
      t.ko.toLowerCase().includes(needle) ||
      t.tags.some(g => g.toLowerCase().includes(needle)),
    )
  }, [needle])

  const showSearch = (activeTab === 'decks' && books.length > 5) || activeTab === 'train'

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

        <Link href="/dashboard/jlpt-n4/mocks"
          className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 mb-4 transition">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg shrink-0">📊</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">모의고사 기록</p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {latestMock
                  ? `최근 ${levelSpec(latestMock.level).label} · ${latestMock.title} · ${latestMock.taken_on}`
                  : 'N5 · N4 · N3 채점 결과 남기기'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {latestMock && (() => {
              const spec = levelSpec(latestMock.level)
              const v = verdict(latestMock, spec)
              return (
                <span className={`text-sm font-bold ${v.passed ? 'text-green-400' : 'text-amber-400'}`}>
                  {v.total}<span className="text-[10px] text-gray-600">/180</span>
                </span>
              )
            })()}
            <span className="text-gray-600 text-xs">→</span>
          </div>
        </Link>

        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-4">
          {([
            { key: 'books', label: '📚 교재' },
            { key: 'decks', label: `🃏 덱${books.length ? ` ${books.length}` : ''}` },
            { key: 'train', label: `🎯 트레이닝 ${TRAINERS.length}` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setQ('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {showSearch && (
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={activeTab === 'train' ? '조수사, 경어, 한자음…' : '교재 이름으로 찾기'}
            className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-xl px-4 py-2.5 text-sm mb-4 outline-none transition placeholder:text-gray-600"
          />
        )}

        {/* ── 교재 ── */}
        {activeTab === 'books' && (
          <div>
            <div className="bg-gray-900 rounded-xl p-4 mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-widest">
                  전체 진도<span className="normal-case tracking-normal text-[10px] text-gray-700 ml-1.5">예정 제외</span>
                </span>
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
                <p className="text-[10px] text-gray-700 mb-3 leading-relaxed">
                  카드 오른쪽의 상태 칩을 누르면 진행중 → 예정 → 완료 순으로 옮겨집니다.
                  한 번에 정리하려면 아래 <span className="text-gray-500">교재 추가 · 상태·목차 관리</span>에서 「⚡ 진도대로 정리」를 쓰세요.
                </p>

                {/* 진행 중 — 큰 카드 */}
                {byStatus.active.length > 0 && (
                  <>
                    <BookSectionLabel sub={BOOK_STATUS_META.active.sub}>{BOOK_STATUS_META.active.label}</BookSectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                      {byStatus.active.map(b => {
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
                              <BookStatusChip status={b.status} onCycle={() => cycleStatus(b)} />
                            </div>
                            <p className="font-bold text-sm leading-snug mb-2">{b.title}</p>
                            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* 예정 — 한 줄 */}
                {byStatus.planned.length > 0 && (
                  <>
                    <BookSectionLabel sub={BOOK_STATUS_META.planned.sub}>{BOOK_STATUS_META.planned.label}</BookSectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                      {byStatus.planned.map(b => {
                        const p = bookProgress(nodes, b.id)
                        return (
                          <Link key={b.id} href={`/dashboard/jlpt-n4/books?book=${b.id}`}
                            className="flex items-center gap-2.5 bg-gray-900/60 hover:bg-gray-800 rounded-xl px-3 py-2.5 transition">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold leading-tight truncate">{b.title}</p>
                              <p className="text-[10px] text-gray-500 truncate">
                                {b.tag ? `${b.tag} · ` : ''}{p.total > 0 ? `${p.done}/${p.total} 항목` : '목차 미입력'}
                              </p>
                            </div>
                            <BookStatusChip status={b.status} onCycle={() => cycleStatus(b)} size="sm" />
                            <span className="text-gray-700 text-xs shrink-0">→</span>
                          </Link>
                        )
                      })}
                    </div>
                  </>
                )}

                {/* 완료 — 최소 행 */}
                {byStatus.done.length > 0 && (
                  <>
                    <BookSectionLabel sub={BOOK_STATUS_META.done.sub}>{BOOK_STATUS_META.done.label}</BookSectionLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                      {byStatus.done.map(b => {
                        const p = bookProgress(nodes, b.id)
                        const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100)
                        return (
                          <Link key={b.id} href={`/dashboard/jlpt-n4/books?book=${b.id}`}
                            className="flex items-center gap-2 bg-gray-900/40 hover:bg-gray-800/70 rounded-lg px-3 py-2 transition">
                            <span className="w-2 h-2 rounded-full shrink-0 opacity-60" style={{ backgroundColor: b.color }} />
                            <p className="text-xs text-gray-400 truncate flex-1">
                              {b.title}
                              {p.weak > 0 && <span className="text-amber-600/80 ml-2">약점 {p.weak}</span>}
                            </p>
                            <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{pct}%</span>
                            <BookStatusChip status={b.status} onCycle={() => cycleStatus(b)} size="sm" />
                          </Link>
                        )
                      })}
                    </div>
                  </>
                )}

                <Link href="/dashboard/jlpt-n4/books"
                  className="block text-center border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3 text-sm transition">
                  + 교재 추가 · 상태·목차 관리
                </Link>
              </>
            )}
          </div>
        )}

        {/* ── 덱 ── */}
        {activeTab === 'decks' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-1">
              교재에서 채굴한 카드. 덱 안에서는 어휘·문법·문형 태그로 분류됩니다.
            </p>
            {filteredBooks.map(b => (
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
            {needle && filteredBooks.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">일치하는 교재가 없어요.</p>
            )}
            {!needle && (
              <Link href="/flashcard?exam=jlpt-n4&book=none"
                className="flex items-center justify-between bg-gray-900/60 hover:bg-gray-800 rounded-xl px-4 py-3 transition">
                <div>
                  <p className="text-sm font-semibold text-gray-300">🗂 미분류 카드</p>
                  <p className="text-xs text-gray-600 mt-0.5">교재에 묶이지 않은 기존 덱</p>
                </div>
                <span className="text-gray-600 text-xs">→</span>
              </Link>
            )}
          </div>
        )}

        {/* ── 트레이닝 ── */}
        {activeTab === 'train' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              규칙으로 문제를 만들어내는 훈련. 교재와 무관하게 언제든 돌릴 수 있어요.
            </p>
            {TRAINER_GROUPS.map(g => {
              const items = filteredTrainers.filter(t => t.group === g.key)
              if (!items.length) return null
              return (
                <div key={g.key} className="mb-5">
                  <div className="flex items-baseline gap-2 mb-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{g.label}</h2>
                    <span className="text-[10px] text-gray-700">{g.hint}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map(t => (
                      <Link key={t.slug} href={`/dashboard/jlpt-n4/${t.slug}`}
                        className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3.5 transition">
                        <span className="text-xl shrink-0">{t.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{t.ja}</p>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{t.ko}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
            {filteredTrainers.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-8">일치하는 트레이닝이 없어요.</p>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
