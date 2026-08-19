'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  BookStatus, BOOK_STATUS_ORDER, BOOK_STATUS_META, BOOK_STATUS_NEXT, normalizeBookStatus,
} from '@/lib/constants-jlpt-books'

// ───────────────────────────────────────────────────────────────
// 자유 추가형 교재 진도 트래커
//   - 교재(jp_books)를 자유롭게 추가/삭제
//   - 각 교재 안에 노드(jp_nodes)를 재귀 트리로 무한 추가
//     예) 독해 실모 → 1회~5회 → 문제10~14 → 10번 세부문항 5개
//   - 말단(자식 없는) 노드 상태: 미완 → 완료 → 약점 순환
//   - 부모는 말단 완료 수를 자동 집계
//   - 교재 자체는 홈 허브와 같은 3단(진행중/예정/완료)으로 묶어 본다
//     · 상태 칩을 누르면 진행중 → 예정 → 완료 → 진행중 순환
// ───────────────────────────────────────────────────────────────

type Book = {
  id: string
  title: string
  tag: string | null
  color: string
  sort_order: number
  status: BookStatus
}

type Node = {
  id: string
  book_id: string
  parent_id: string | null
  title: string
  sort_order: number
  status: 0 | 1 | 2
  memo: string | null
}

type TreeNode = Node & { children: TreeNode[] }

const STATUS_NEXT: Record<number, 0 | 1 | 2> = { 0: 1, 1: 2, 2: 0 }
const STATUS_LABEL: Record<number, string> = { 0: '미완', 1: '완료', 2: '약점' }
const STATUS_DOT: Record<number, string> = {
  0: 'bg-gray-700',
  1: 'bg-blue-500',
  2: 'bg-amber-500',
}

const BOOK_COLORS = ['#2563eb', '#7c3aed', '#059669', '#b45309', '#db2777', '#0891b2']

// 플랫 노드 → 트리
function buildTree(nodes: Node[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  nodes.forEach(n => byId.set(n.id, { ...n, children: [] }))
  const roots: TreeNode[] = []
  byId.forEach(n => {
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(n)
    else roots.push(n)
  })
  const sortRec = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order)
    arr.forEach(c => sortRec(c.children))
  }
  sortRec(roots)
  return roots
}

// 서브트리 말단 통계
function leafStats(n: TreeNode): { done: number; total: number; weak: number } {
  if (n.children.length === 0) {
    return { total: 1, done: n.status >= 1 ? 1 : 0, weak: n.status === 2 ? 1 : 0 }
  }
  return n.children.reduce(
    (acc, c) => {
      const s = leafStats(c)
      return { done: acc.done + s.done, total: acc.total + s.total, weak: acc.weak + s.weak }
    },
    { done: 0, total: 0, weak: 0 }
  )
}

// 교재(플랫 노드) 진도 — 목록 카드용
function flatBookProgress(nodes: Node[], bookId: string): { done: number; total: number; weak: number } {
  const own = nodes.filter(n => n.book_id === bookId)
  const childOf = new Map<string | null, Node[]>()
  own.forEach(n => {
    const arr = childOf.get(n.parent_id) ?? []
    arr.push(n); childOf.set(n.parent_id, arr)
  })
  const leaves = own.filter(n => !(childOf.get(n.id)?.length))
  return {
    total: leaves.length,
    done: leaves.filter(n => n.status >= 1).length,
    weak: leaves.filter(n => n.status === 2).length,
  }
}

export default function BooksPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">📚</div>
    }>
      <BooksPage />
    </Suspense>
  )
}

function BooksPage() {
  const searchParams = useSearchParams()
  const [books, setBooks] = useState<Book[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [activeBook, setActiveBook] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 허브에서 ?book=<id> 로 들어오면 해당 교재 바로 열기 (최초 1회)
  useEffect(() => {
    const b = searchParams.get('book')
    if (b) setActiveBook(b)
  }, [searchParams])

  // 교재 추가 폼
  const [showAddBook, setShowAddBook] = useState(false)
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookTag, setNewBookTag] = useState('')
  const [newBookColor, setNewBookColor] = useState(BOOK_COLORS[0])
  const [newBookStatus, setNewBookStatus] = useState<BookStatus>('active')

  // ── 로드 ────────────────────────────────────────────────────
  const loadBooks = useCallback(async () => {
    const { data } = await supabase
      .from('jp_books')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    // status 컬럼이 아직 없는 환경(마이그레이션 전)에서도 진행중으로 흡수
    setBooks(((data as Book[]) || []).map(b => ({ ...b, status: normalizeBookStatus(b.status) })))
    setLoading(false)
  }, [])

  // 전체 노드를 한 번에 로드 (목록 카드의 교재별 진도 계산에 사용)
  const loadNodes = useCallback(async () => {
    const { data } = await supabase.from('jp_nodes').select('*')
    setNodes((data as Node[]) || [])
  }, [])

  useEffect(() => { loadBooks(); loadNodes() }, [loadBooks, loadNodes])

  // ── 교재 CRUD ───────────────────────────────────────────────
  const addBook = async () => {
    if (!newBookTitle.trim()) return
    const nextOrder = (books.at(-1)?.sort_order ?? 0) + 1
    const { data } = await supabase
      .from('jp_books')
      .insert({
        title: newBookTitle.trim(),
        tag: newBookTag.trim() || null,
        color: newBookColor,
        sort_order: nextOrder,
        status: newBookStatus,
      })
      .select('*')
      .single()
    if (data) setBooks(prev => [...prev, { ...(data as Book), status: normalizeBookStatus((data as Book).status) }])
    setNewBookTitle(''); setNewBookTag(''); setNewBookColor(BOOK_COLORS[0])
    setNewBookStatus('active'); setShowAddBook(false)
  }

  // 상태 변경 (낙관적) — 칩 클릭은 순환, 특정 상태로 바로 보낼 수도 있다
  const setBookStatus = async (b: Book, next?: BookStatus) => {
    const s = next ?? BOOK_STATUS_NEXT[b.status]
    if (s === b.status) return
    setBooks(prev => prev.map(x => x.id === b.id ? { ...x, status: s } : x))
    const { error } = await supabase
      .from('jp_books')
      .update({ status: s, status_updated_at: new Date().toISOString() })
      .eq('id', b.id)
    if (error) {
      setBooks(prev => prev.map(x => x.id === b.id ? { ...x, status: b.status } : x))
      alert(`상태를 바꾸지 못했습니다.\n${error.message}\n\nsupabase/jp_books_status_migration.sql 을 먼저 실행했는지 확인하세요.`)
    }
  }

  const renameBook = async (b: Book) => {
    const title = prompt('교재 이름', b.title)
    if (!title?.trim()) return
    const tag = prompt('태그 (N4·N2·독해·기출 등, 비워도 됨)', b.tag ?? '') ?? ''
    setBooks(prev => prev.map(x => x.id === b.id ? { ...x, title: title.trim(), tag: tag.trim() || null } : x))
    await supabase.from('jp_books').update({ title: title.trim(), tag: tag.trim() || null }).eq('id', b.id)
  }

  const deleteBook = async (b: Book) => {
    if (!confirm(`"${b.title}" 교재를 삭제할까요? 안의 모든 목차도 삭제됩니다.`)) return
    const bookSnap = books, nodeSnap = nodes
    setBooks(prev => prev.filter(x => x.id !== b.id))
    setNodes(prev => prev.filter(n => n.book_id !== b.id))
    if (activeBook === b.id) setActiveBook(null)

    // 노드를 먼저 비우고 교재를 지운다 (cascade가 없어도 통과하도록)
    const own = nodeSnap.filter(n => n.book_id === b.id)
    const byDepth: string[][] = []
    let level = own.filter(n => n.parent_id === null).map(n => n.id)
    while (level.length) {
      byDepth.push(level)
      const parents = level
      level = own.filter(n => n.parent_id && parents.includes(n.parent_id)).map(n => n.id)
    }
    for (let i = byDepth.length - 1; i >= 0; i--) {
      const { error } = await supabase.from('jp_nodes').delete().in('id', byDepth[i])
      if (error) {
        setBooks(bookSnap); setNodes(nodeSnap)
        alert(`삭제하지 못했습니다.\n${error.message}`)
        return
      }
    }
    const { error } = await supabase.from('jp_books').delete().eq('id', b.id)
    if (error) {
      setBooks(bookSnap); setNodes(nodeSnap)
      alert(`교재를 삭제하지 못했습니다.\n${error.message}`)
    }
  }

  // ── 노드 CRUD (낙관적) ──────────────────────────────────────
  const siblingsOf = useCallback(
    (parentId: string | null) =>
      nodes.filter(n => n.book_id === activeBook && n.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [nodes, activeBook]
  )

  const addNodes = async (parentId: string | null, titles: string[]) => {
    if (!activeBook) return
    const clean = titles.map(t => t.trim()).filter(Boolean)
    if (clean.length === 0) return
    const base = (siblingsOf(parentId).at(-1)?.sort_order ?? 0) + 1
    const rows = clean.map((title, i) => ({
      book_id: activeBook,
      parent_id: parentId,
      title,
      sort_order: base + i,
      status: 0 as const,
      memo: null,
    }))
    const { data } = await supabase.from('jp_nodes').insert(rows).select('*')
    if (data) setNodes(prev => [...prev, ...(data as Node[])])
  }

  const cycleStatus = async (n: Node) => {
    const next = STATUS_NEXT[n.status]
    setNodes(prev => prev.map(x => x.id === n.id ? { ...x, status: next } : x))
    await supabase.from('jp_nodes').update({ status: next }).eq('id', n.id)
  }

  const renameNode = async (id: string, title: string) => {
    setNodes(prev => prev.map(x => x.id === id ? { ...x, title } : x))
    await supabase.from('jp_nodes').update({ title }).eq('id', id)
  }

  const saveMemo = async (id: string, memo: string) => {
    const v = memo.trim() || null
    setNodes(prev => prev.map(x => x.id === id ? { ...x, memo: v } : x))
    await supabase.from('jp_nodes').update({ memo: v }).eq('id', id)
  }

  const deleteNode = async (id: string) => {
    const target = nodes.find(n => n.id === id)
    if (!target) return

    // 서브트리를 깊이별로 모은다.
    // DB에 on delete cascade가 걸려 있지 않으면 부모부터 지울 때
    // 외래키 위반으로 조용히 실패하므로, 반드시 아래층부터 지운다.
    const levels: string[][] = [[id]]
    const seen = new Set<string>([id])
    for (;;) {
      const parents = levels[levels.length - 1]
      const kids = nodes
        .filter(n => n.parent_id && parents.includes(n.parent_id) && !seen.has(n.id))
        .map(n => n.id)
      if (!kids.length) break
      kids.forEach(k => seen.add(k))
      levels.push(kids)
    }

    const childCount = seen.size - 1
    const msg = childCount
      ? `"${target.title}" 과 그 아래 ${childCount}개 항목을 삭제할까요?`
      : `"${target.title}" 을(를) 삭제할까요?`
    if (!confirm(msg)) return

    const snapshot = nodes
    setNodes(prev => prev.filter(n => !seen.has(n.id)))

    for (let i = levels.length - 1; i >= 0; i--) {
      const { error } = await supabase.from('jp_nodes').delete().in('id', levels[i])
      if (error) {
        setNodes(snapshot)   // 실패하면 화면을 되돌린다 — 지워진 척하지 않도록
        alert(`삭제하지 못했습니다.\n${error.message}`)
        return
      }
    }
  }

  const reorder = async (n: Node, dir: -1 | 1) => {
    const sibs = siblingsOf(n.parent_id)
    const idx = sibs.findIndex(s => s.id === n.id)
    const target = sibs[idx + dir]
    if (!target) return
    setNodes(prev => prev.map(x => {
      if (x.id === n.id) return { ...x, sort_order: target.sort_order }
      if (x.id === target.id) return { ...x, sort_order: n.sort_order }
      return x
    }))
    await Promise.all([
      supabase.from('jp_nodes').update({ sort_order: target.sort_order }).eq('id', n.id),
      supabase.from('jp_nodes').update({ sort_order: n.sort_order }).eq('id', target.id),
    ])
  }

  const tree = useMemo(() => buildTree(nodes.filter(n => n.book_id === activeBook)), [nodes, activeBook])
  const book = books.find(b => b.id === activeBook) || null

  // 상태별 묶음 (각 그룹 안에서는 기존 sort_order 유지)
  const byStatus = useMemo(() => ({
    active: books.filter(b => b.status === 'active'),
    planned: books.filter(b => b.status === 'planned'),
    done: books.filter(b => b.status === 'done'),
  }), [books])

  // ── 교재 목록 화면 ──────────────────────────────────────────
  if (!book) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-2">
            <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT</Link>
          </div>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">📚 교재 진도</h1>
              <p className="text-gray-500 text-sm">교재를 자유롭게 추가하고, 목차·세부문항을 직접 구성하세요.</p>
            </div>
            <button
              onClick={() => setShowAddBook(v => !v)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0"
            >
              + 새 교재
            </button>
          </div>

          {showAddBook && (
            <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700 space-y-3">
              <input
                autoFocus
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="교재 이름 (예: N2 독해 실전모의고사)"
                value={newBookTitle}
                onChange={e => setNewBookTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBook()}
              />
              <input
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="태그 (선택 · N4·N2·독해·기출 등)"
                value={newBookTag}
                onChange={e => setNewBookTag(e.target.value)}
              />
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-500">색</span>
                {BOOK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewBookColor(c)}
                    className={`w-6 h-6 rounded-full transition ${newBookColor === c ? 'ring-2 ring-white' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-500">상태</span>
                <div className="flex gap-0.5 bg-gray-950 rounded-lg p-0.5">
                  {BOOK_STATUS_ORDER.map(s => (
                    <button
                      key={s}
                      onClick={() => setNewBookStatus(s)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                        newBookStatus === s ? BOOK_STATUS_META[s].chip : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {BOOK_STATUS_META[s].short}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addBook} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
                  만들기
                </button>
                <button onClick={() => setShowAddBook(false)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                  취소
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-gray-500 text-sm">불러오는 중...</p>
          ) : books.length === 0 ? (
            <div className="text-gray-500 text-center py-16">
              <p className="mb-2">아직 교재가 없어요.</p>
              <p className="text-xs">+ 새 교재로 시작하세요.</p>
            </div>
          ) : (
            <>
              {/* 진행 중 — 큰 카드 */}
              {byStatus.active.length > 0 && (
                <>
                  <SectionLabel sub={BOOK_STATUS_META.active.sub}>{BOOK_STATUS_META.active.label}</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                    {byStatus.active.map(b => (
                      <BookCard
                        key={b.id}
                        book={b}
                        progress={flatBookProgress(nodes, b.id)}
                        onOpen={() => setActiveBook(b.id)}
                        onCycle={() => setBookStatus(b)}
                        onFinish={() => setBookStatus(b, 'done')}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* 예정 — 한 줄 압축 행 */}
              {byStatus.planned.length > 0 && (
                <>
                  <SectionLabel sub={BOOK_STATUS_META.planned.sub}>{BOOK_STATUS_META.planned.label}</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
                    {byStatus.planned.map(b => (
                      <BookRow
                        key={b.id}
                        book={b}
                        progress={flatBookProgress(nodes, b.id)}
                        onOpen={() => setActiveBook(b.id)}
                        onCycle={() => setBookStatus(b)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* 완료 — 최소 행 */}
              {byStatus.done.length > 0 && (
                <>
                  <SectionLabel sub={BOOK_STATUS_META.done.sub}>{BOOK_STATUS_META.done.label}</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
                    {byStatus.done.map(b => (
                      <BookDoneRow
                        key={b.id}
                        book={b}
                        progress={flatBookProgress(nodes, b.id)}
                        onOpen={() => setActiveBook(b.id)}
                        onCycle={() => setBookStatus(b)}
                      />
                    ))}
                  </div>
                </>
              )}

              <p className="text-[10px] text-gray-700 leading-relaxed">
                진행중 {byStatus.active.length} · 예정 {byStatus.planned.length} · 완료 {byStatus.done.length}
                {' '}· 카드 오른쪽 위 상태 칩을 누르면 진행중 → 예정 → 완료 순으로 옮겨집니다.
              </p>
            </>
          )}
        </div>
      </main>
    )
  }

  // ── 단일 교재: 트리 화면 ────────────────────────────────────
  const bookStats = tree.reduce(
    (acc, n) => {
      const s = leafStats(n)
      return { done: acc.done + s.done, total: acc.total + s.total, weak: acc.weak + s.weak }
    },
    { done: 0, total: 0, weak: 0 }
  )
  const pct = bookStats.total === 0 ? 0 : Math.round((bookStats.done / bookStats.total) * 100)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <button onClick={() => setActiveBook(null)} className="text-gray-400 hover:text-white text-sm">
            ← 교재 목록
          </button>
        </div>

        {/* 교재 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <span className="w-3 h-3 rounded-full mt-2" style={{ backgroundColor: book.color }} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{book.title}</h1>
                {book.tag && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold">{book.tag}</span>}
                <StatusChip status={book.status} onCycle={() => setBookStatus(book)} />
              </div>
              <p className="text-gray-500 text-sm mt-1">
                완료 {bookStats.done}/{bookStats.total}
                {bookStats.weak > 0 && <span className="text-amber-500"> · 약점 {bookStats.weak}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => renameBook(book)} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg bg-gray-800 transition">편집</button>
            <button onClick={() => deleteBook(book)} className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg bg-gray-800 transition">삭제</button>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="bg-gray-900 rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest">진행률</span>
            <span className="text-sm font-bold text-blue-400">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          {pct === 100 && bookStats.total > 0 && book.status !== 'done' && (
            <button
              onClick={() => setBookStatus(book, 'done')}
              className="mt-3 w-full bg-green-900/40 hover:bg-green-900/70 text-green-400 rounded-lg py-2 text-xs font-semibold transition"
            >
              ✅ 이 교재를 완료로 옮기기
            </button>
          )}
        </div>

        {/* 사용법 안내 */}
        <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">
          맨 아래 <span className="text-gray-400">+ 최상위 항목</span>으로 회차·챕터를 추가하고, 각 항목의 <span className="text-blue-400">＋하위</span>로 세부문항을 넣으세요.
          여러 줄을 붙여넣으면 한꺼번에 등록돼요. 말단 항목의 <span className="text-gray-400">동그라미</span>를 누르면 미완→완료→약점으로 바뀝니다.
        </p>

        {/* 트리 */}
        <div className="space-y-1">
          {tree.map(n => (
            <TreeNodeRow
              key={n.id}
              node={n}
              depth={0}
              siblingCount={tree.length}
              onAdd={addNodes}
              onCycle={cycleStatus}
              onRename={renameNode}
              onMemo={saveMemo}
              onDelete={deleteNode}
              onReorder={reorder}
            />
          ))}
        </div>

        {/* 최상위 추가 */}
        <TopAdder onAdd={titles => addNodes(null, titles)} />
      </div>
    </main>
  )
}

// ───────────────────────────────────────────────────────────────
// 상태 3단 UI — 홈 허브(app/page.tsx)와 같은 어휘·밀도를 쓴다
// ───────────────────────────────────────────────────────────────
type Progress = { done: number; total: number; weak: number }
const pctOf = (p: Progress) => (p.total === 0 ? 0 : Math.round((p.done / p.total) * 100))

function SectionLabel({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">{children}</p>
      {sub && <p className="text-[10px] text-gray-700">{sub}</p>}
    </div>
  )
}

/** 누르면 진행중 → 예정 → 완료 → 진행중 으로 순환 */
function StatusChip({ status, onCycle, size = 'md' }: {
  status: BookStatus; onCycle: () => void; size?: 'sm' | 'md'
}) {
  const m = BOOK_STATUS_META[status]
  return (
    <button
      onClick={e => { e.stopPropagation(); onCycle() }}
      title="눌러서 상태 바꾸기 (진행중 → 예정 → 완료)"
      className={`shrink-0 rounded-full font-bold transition hover:brightness-125 ${m.chip} ${
        size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
    >
      {m.short}
    </button>
  )
}

// 진행 중 — 진도 바까지 보이는 큰 카드
function BookCard({ book, progress, onOpen, onCycle, onFinish }: {
  book: Book; progress: Progress; onOpen: () => void; onCycle: () => void; onFinish: () => void
}) {
  const pct = pctOf(progress)
  const finished = pct === 100 && progress.total > 0
  return (
    <div
      onClick={onOpen}
      className="cursor-pointer text-left bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: book.color }} />
        {book.tag && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-bold">{book.tag}</span>
        )}
        <span className="text-[10px] text-gray-600 ml-auto">
          {progress.done}/{progress.total}{progress.weak > 0 && <span className="text-amber-500"> · 약점 {progress.weak}</span>}
        </span>
        <StatusChip status={book.status} onCycle={onCycle} />
      </div>
      <p className="font-bold leading-snug mb-2">{book.title}</p>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: book.color }} />
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <p className="text-[11px] text-gray-600">{pct}% · 탭하여 목차 편집 →</p>
        {finished && (
          <button
            onClick={e => { e.stopPropagation(); onFinish() }}
            className="ml-auto text-[10px] text-green-500 hover:text-green-400 font-semibold"
          >
            완료로 옮기기 ↓
          </button>
        )}
      </div>
    </div>
  )
}

// 예정 — 한 줄 압축 행
function BookRow({ book, progress, onOpen, onCycle }: {
  book: Book; progress: Progress; onOpen: () => void; onCycle: () => void
}) {
  return (
    <div
      onClick={onOpen}
      className="cursor-pointer flex items-center gap-2.5 bg-gray-900/60 hover:bg-gray-800 rounded-xl px-3 py-2.5 transition"
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: book.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight truncate">{book.title}</p>
        <p className="text-[10px] text-gray-500 truncate">
          {book.tag ? `${book.tag} · ` : ''}{progress.total > 0 ? `${progress.done}/${progress.total} 항목` : '목차 미입력'}
        </p>
      </div>
      <StatusChip status={book.status} onCycle={onCycle} size="sm" />
      <span className="text-gray-700 text-xs shrink-0">→</span>
    </div>
  )
}

// 완료 — 최소 행 (아카이브)
function BookDoneRow({ book, progress, onOpen, onCycle }: {
  book: Book; progress: Progress; onOpen: () => void; onCycle: () => void
}) {
  return (
    <div
      onClick={onOpen}
      className="cursor-pointer flex items-center gap-2 bg-gray-900/40 hover:bg-gray-800/70 rounded-lg px-3 py-2 transition"
    >
      <span className="w-2 h-2 rounded-full shrink-0 opacity-60" style={{ backgroundColor: book.color }} />
      <p className="text-xs text-gray-400 truncate flex-1">
        {book.title}
        {progress.weak > 0 && <span className="text-amber-600/80 ml-2">약점 {progress.weak}</span>}
      </p>
      <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{pctOf(progress)}%</span>
      <StatusChip status={book.status} onCycle={onCycle} size="sm" />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// 재귀 노드 행
// ───────────────────────────────────────────────────────────────
function TreeNodeRow({
  node, depth, siblingCount, onAdd, onCycle, onRename, onMemo, onDelete, onReorder,
}: {
  node: TreeNode
  depth: number
  siblingCount: number
  onAdd: (parentId: string | null, titles: string[]) => void
  onCycle: (n: Node) => void
  onRename: (id: string, title: string) => void
  onMemo: (id: string, memo: string) => void
  onDelete: (id: string) => void
  onReorder: (n: Node, dir: -1 | 1) => void
}) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(node.title)
  const [adding, setAdding] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoText, setMemoText] = useState(node.memo ?? '')

  const hasChildren = node.children.length > 0
  const s = leafStats(node)

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-lg hover:bg-gray-900 transition py-1.5 pr-1.5"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        {/* 펼침 토글 / 들여쓰기 가이드 */}
        {hasChildren ? (
          <button onClick={() => setOpen(v => !v)} className="text-gray-600 hover:text-white text-xs w-4 shrink-0">
            {open ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* 상태 점 (말단=직접 토글 / 부모=집계 표시) */}
        {hasChildren ? (
          <span className="text-[10px] text-gray-600 w-10 shrink-0 text-center tabular-nums">
            {s.done}/{s.total}
          </span>
        ) : (
          <button
            onClick={() => onCycle(node)}
            title={STATUS_LABEL[node.status]}
            className={`w-4 h-4 rounded-full shrink-0 transition ${STATUS_DOT[node.status]} hover:brightness-125`}
          />
        )}

        {/* 제목 */}
        {editing ? (
          <input
            autoFocus
            className="flex-1 bg-gray-800 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => { onRename(node.id, editTitle.trim() || node.title); setEditing(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRename(node.id, editTitle.trim() || node.title); setEditing(false) }
              if (e.key === 'Escape') { setEditTitle(node.title); setEditing(false) }
            }}
          />
        ) : (
          <span
            onClick={() => { setEditTitle(node.title); setEditing(true) }}
            className={`flex-1 text-sm leading-snug cursor-text ${
              !hasChildren && node.status === 1 ? 'text-blue-300' :
              !hasChildren && node.status === 2 ? 'text-amber-400' : ''
            }`}
          >
            {node.title}
            {node.memo && <span className="text-[10px] text-gray-600 ml-2">📝</span>}
          </span>
        )}

        {/* 액션 (항상 표시) */}
        <div className="flex items-center gap-0.5 transition shrink-0">
          <button onClick={() => onReorder(node, -1)} title="위로" className="text-gray-600 hover:text-white text-xs px-1">▲</button>
          <button onClick={() => onReorder(node, 1)} title="아래로" className="text-gray-600 hover:text-white text-xs px-1">▼</button>
          <button onClick={() => setAdding(v => !v)} title="하위 항목 추가" className="text-blue-500 hover:text-blue-400 text-sm px-1.5 font-bold">＋하위</button>
          <button onClick={() => { setMemoText(node.memo ?? ''); setMemoOpen(v => !v) }} title="메모"
            className={`text-[11px] px-1.5 py-0.5 rounded transition ${node.memo ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-white'}`}>메모</button>
          <button onClick={() => onDelete(node.id)} title="삭제"
            className="text-[11px] px-1.5 py-0.5 rounded text-gray-600 hover:text-white hover:bg-red-800 transition">삭제</button>
        </div>
      </div>

      {/* 메모 편집 */}
      {memoOpen && (
        <div className="space-y-1.5 py-2" style={{ paddingLeft: depth * 16 + 28 }}>
          <textarea
            rows={2}
            value={memoText}
            onChange={e => setMemoText(e.target.value)}
            placeholder="헷갈린 포인트·오답 원인..."
            className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <button
            onClick={() => { onMemo(node.id, memoText); setMemoOpen(false) }}
            className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs font-semibold transition"
          >
            저장
          </button>
        </div>
      )}

      {/* 하위 추가 입력 */}
      {adding && (
        <div style={{ paddingLeft: (depth + 1) * 16 + 28 }}>
          <InlineAdder
            onAdd={titles => { onAdd(node.id, titles); setAdding(false) }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {/* 자식 */}
      {open && hasChildren && (
        <div>
          {node.children.map(c => (
            <TreeNodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              siblingCount={node.children.length}
              onAdd={onAdd}
              onCycle={onCycle}
              onRename={onRename}
              onMemo={onMemo}
              onDelete={onDelete}
              onReorder={onReorder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 여러 줄 붙여넣기 → 일괄 추가 지원하는 입력
function InlineAdder({ onAdd, onCancel }: { onAdd: (titles: string[]) => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  const submit = () => {
    const titles = text.split('\n').map(t => t.trim()).filter(Boolean)
    if (titles.length) onAdd(titles)
  }
  return (
    <div className="py-2 space-y-1.5">
      <textarea
        autoFocus
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="항목 입력 · 여러 줄 붙여넣으면 한꺼번에 추가 (예: 문제10 / 문제11 …)"
        className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />
      <div className="flex gap-1.5">
        <button onClick={submit} className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs font-semibold transition">
          추가
        </button>
        <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">
          취소
        </button>
        <span className="text-[10px] text-gray-600 self-center ml-1">⌘/Ctrl+Enter</span>
      </div>
    </div>
  )
}

// 최상위 추가 (책 직속)
function TopAdder({ onAdd }: { onAdd: (titles: string[]) => void }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-600 hover:text-gray-400 rounded-xl py-3 text-sm transition"
      >
        + 최상위 항목 추가 (회차·챕터 등)
      </button>
    )
  }
  return (
    <div className="mt-4 bg-gray-900 rounded-xl p-3">
      <InlineAdder onAdd={titles => { onAdd(titles); setOpen(false) }} onCancel={() => setOpen(false)} />
    </div>
  )
}
