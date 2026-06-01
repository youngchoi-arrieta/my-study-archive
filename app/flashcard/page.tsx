'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Deck = {
  id: string
  name: string
  description: string | null
  created_at: string
  exam_type: string | null
  sort_order: number
  card_count?: number
}

const EXAM_META: Record<string, { label: string; back: string }> = {
  engineer:   { label: '⚡ 전기기사 실기', back: '/dashboard' },
  gineung:    { label: '🔧 전기기능사 실기', back: '/dashboard' },
  denkoshi:   { label: '🗾 第二種電気工事士', back: '/dashboard/denkoshi' },
  'jlpt-n4':  { label: '🗣 JLPT N4', back: '/dashboard/jlpt-n4' },
}

export default function FlashcardPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>
    }>
      <FlashcardPage />
    </Suspense>
  )
}

function FlashcardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const examParam = searchParams.get('exam') || 'all'

  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['어휘', '문법', '문형']))

  // 덱 이름으로 카테고리 분류
  const classifyDeck = (name: string): '어휘' | '문법' | '문형' => {
    if (name.includes('필수 단어') || name.includes('Day ')) return '어휘'
    if (name.includes('필수 문법')) return '문법'
    return '문형'
  }

  const GROUPS: { key: '어휘' | '문법' | '문형'; emoji: string; label: string }[] = [
    { key: '어휘',  emoji: '📚', label: '어휘' },
    { key: '문법',  emoji: '📝', label: '문법' },
    { key: '문형',  emoji: '💬', label: '문형' },
  ]

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }
  const USER_ID = 'flashcard_user'

  const loadDecks = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('flashcard_decks')
      .select('*, flashcard_cards(count)')
      .eq('user_id', USER_ID)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false }) // tie-breaker

    if (examParam !== 'all') {
      q = q.eq('exam_type', examParam)
    }

    const { data } = await q
    if (!data) { setLoading(false); return }
    setDecks(data.map(d => ({
      ...d,
      card_count: (d.flashcard_cards as unknown as { count: number }[])?.[0]?.count ?? 0,
    })))
    setLoading(false)
  }, [examParam])

  useEffect(() => { loadDecks() }, [loadDecks])

  const addDeck = async () => {
    if (!newName.trim()) return
    setSaving(true)
    // 같은 exam_type 그룹에서 max(sort_order) + 1 계산
    const examType = examParam !== 'all' ? examParam : null
    let maxQ = supabase
      .from('flashcard_decks')
      .select('sort_order')
      .eq('user_id', USER_ID)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (examType !== null) {
      maxQ = maxQ.eq('exam_type', examType)
    } else {
      maxQ = maxQ.is('exam_type', null)
    }
    const { data: maxRow } = await maxQ
    const nextOrder = (maxRow?.[0]?.sort_order ?? 0) + 1

    await supabase.from('flashcard_decks').insert({
      user_id: USER_ID,
      name: newName.trim(),
      description: newDesc.trim() || null,
      exam_type: examType,
      sort_order: nextOrder,
    })
    setNewName(''); setNewDesc(''); setShowAdd(false)
    await loadDecks()
    setSaving(false)
  }

  const deleteDeck = async (id: string) => {
    if (!confirm('덱을 삭제할까요? 카드도 전부 삭제됩니다.')) return
    await supabase.from('flashcard_decks').delete().eq('id', id)
    setDecks(prev => prev.filter(d => d.id !== id))
  }

  // 두 덱의 sort_order를 swap
  const swapOrder = async (idxA: number, idxB: number) => {
    if (reordering) return
    if (idxA < 0 || idxB < 0 || idxA >= decks.length || idxB >= decks.length) return
    setReordering(true)

    const deckA = decks[idxA]
    const deckB = decks[idxB]

    // 낙관적 UI 업데이트
    const newDecks = [...decks]
    newDecks[idxA] = { ...deckB, sort_order: deckA.sort_order }
    newDecks[idxB] = { ...deckA, sort_order: deckB.sort_order }
    setDecks(newDecks)

    // DB 업데이트 (두 번 update)
    await Promise.all([
      supabase.from('flashcard_decks').update({ sort_order: deckB.sort_order }).eq('id', deckA.id),
      supabase.from('flashcard_decks').update({ sort_order: deckA.sort_order }).eq('id', deckB.id),
    ])
    setReordering(false)
  }

  const moveUp   = (idx: number) => swapOrder(idx, idx - 1)
  const moveDown = (idx: number) => swapOrder(idx, idx + 1)

  const meta = EXAM_META[examParam]
  const backHref = meta?.back || '/'
  const pageTitle = meta ? `🃏 플래시카드 — ${meta.label}` : '🃏 플래시카드'

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push(backHref)} className="text-gray-400 hover:text-white text-sm">
            ← {meta?.label || '홈'}
          </button>
        </div>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">{pageTitle}</h1>
            <p className="text-gray-500 text-sm">멀티필드 인출 훈련 · 덱 관리</p>
          </div>
          <button
            onClick={() => setShowAdd(p => !p)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            + 새 덱
          </button>
        </div>

        {showAdd && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <h3 className="font-semibold mb-4">새 덱 만들기</h3>
            <input
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="덱 이름 (예: 법령 조문 핵심)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDeck()}
            />
            <input
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white mb-4 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="설명 (선택)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={addDeck} disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                {saving ? '저장 중...' : '만들기'}
              </button>
              <button onClick={() => setShowAdd(false)}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                취소
              </button>
            </div>
          </div>
        )}

        {decks.length === 0
          ? (
            <div className="text-gray-500 text-center py-16">
              <p className="mb-2">아직 덱이 없어요.</p>
              <p className="text-xs">+ 새 덱을 만들어 시작하세요.</p>
            </div>
          )
          : (
            <div className="space-y-3">
              {GROUPS.map(({ key, emoji, label }) => {
                const groupDecks = decks.filter(d => classifyDeck(d.name) === key)
                if (groupDecks.length === 0) return null
                const isOpen = openGroups.has(key)
                return (
                  <div key={key} className="bg-gray-900 rounded-2xl overflow-hidden">
                    {/* 그룹 헤더 */}
                    <button
                      onClick={() => toggleGroup(key)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span>{emoji}</span>
                        <span className="font-bold">{label}</span>
                        <span className="text-xs text-gray-500">{groupDecks.length}개</span>
                      </div>
                      <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {/* 덱 목록 */}
                    {isOpen && (
                      <div className="border-t border-gray-800 divide-y divide-gray-800">
                        {groupDecks.map((deck, idx) => {
                          const globalIdx = decks.indexOf(deck)
                          return (
                            <div key={deck.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800 transition group">
                              {/* 순서 변경 */}
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button onClick={() => moveUp(globalIdx)} disabled={globalIdx === 0 || reordering}
                                  className="text-gray-600 hover:text-white disabled:opacity-20 text-xs px-1 transition">▲</button>
                                <button onClick={() => moveDown(globalIdx)} disabled={globalIdx === decks.length - 1 || reordering}
                                  className="text-gray-600 hover:text-white disabled:opacity-20 text-xs px-1 transition">▼</button>
                              </div>

                              <div className="flex-1 cursor-pointer min-w-0" onClick={() => router.push(`/flashcard/${deck.id}`)}>
                                <p className="font-semibold text-sm leading-snug truncate">{deck.name}</p>
                                <p className="text-gray-600 text-xs mt-0.5">{deck.card_count}장</p>
                              </div>

                              <div className="flex gap-1.5 items-center shrink-0">
                                <button onClick={() => router.push(`/flashcard/${deck.id}/quiz`)}
                                  className="bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                                  ▶ 퀴즈
                                </button>
                                <button onClick={() => router.push(`/flashcard/${deck.id}`)}
                                  className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition">
                                  편집
                                </button>
                                <button onClick={() => deleteDeck(deck.id)}
                                  className="text-gray-700 hover:text-red-400 px-2 py-1.5 rounded-lg text-xs transition opacity-0 group-hover:opacity-100">
                                  🗑
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        }
      </div>
    </main>
  )
}
