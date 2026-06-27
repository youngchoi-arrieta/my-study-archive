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
  denken:     { label: '🏭 電験三種', back: '/dashboard/denken' },
  'jlpt-n4':  { label: '🗣 JLPT N4', back: '/dashboard/jlpt-n4' },
}

// 시험별 카테고리 프리셋 — 덱 그룹 헤더/만들기 분류에 사용
const CAT_PRESETS: Record<string, { cats: string[]; emoji: Record<string, string> }> = {
  'jlpt-n4': { cats: ['어휘', '문법', '문형'], emoji: { '어휘': '📚', '문법': '📝', '문형': '💬' } },
  denken:    { cats: ['理論', '電力', '機械', '法規'], emoji: { '理論': '📐', '電力': '⚡', '機械': '⚙️', '法規': '📜' } },
}
const DEFAULT_PRESET = { cats: ['어휘', '문법', '문형'], emoji: { '어휘': '📚', '문법': '📝', '문형': '💬' } }

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

  // 시험 맥락에 맞는 카테고리 프리셋 (덴켄=理論/電力/機械/法規, JLPT=어휘/문법/문형 …)
  const preset = CAT_PRESETS[examParam] ?? DEFAULT_PRESET
  const PRESET_CATS = preset.cats
  const CAT_EMOJI: Record<string, string> = preset.emoji

  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState<string>(PRESET_CATS[0])
  const [customCategory, setCustomCategory] = useState('')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [reordering, setReordering] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [splitting, setSplitting] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(PRESET_CATS))

  // description [태그] 우선 추출, 없으면 이름 패턴 폴백
  const classifyDeck = (name: string, description?: string | null): string => {
    const match = description?.match(/^\[([^\]]+)\]/)
    if (match) return match[1]
    if (name.includes('필수 단어') || name.includes('Day ')) return '어휘'
    if (name.includes('필수 문법')) return '문법'
    return '기타'
  }

  // 덱에서 실제 사용 중인 카테고리 목록 동적 생성
  const allCats = [...new Set(decks.map(d => classifyDeck(d.name, d.description)))]
  const sortedCats = [
    ...PRESET_CATS.filter(c => allCats.includes(c)),
    ...allCats.filter(c => !PRESET_CATS.includes(c)).sort(),
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

    const finalCat = newCategory === '__custom__'
      ? (customCategory.trim() || '기타')
      : newCategory
    const ttsSuffix = ttsEnabled ? '' : '[notts]'
    const taggedDesc = newDesc.trim()
      ? `[${finalCat}]${ttsSuffix} ${newDesc.trim()}`
      : `[${finalCat}]${ttsSuffix}`

    await supabase.from('flashcard_decks').insert({
      user_id: USER_ID,
      name: newName.trim(),
      description: taggedDesc,
      exam_type: examType,
      sort_order: nextOrder,
    })
    setNewName(''); setNewDesc(''); setShowAdd(false); setTtsEnabled(true)
    await loadDecks()
    setSaving(false)
  }

  const deleteDeck = async (id: string) => {
    if (!confirm('덱을 삭제할까요? 카드도 전부 삭제됩니다.')) return
    await supabase.from('flashcard_decks').delete().eq('id', id)
    setDecks(prev => prev.filter(d => d.id !== id))
  }

  // ── 덱 분할 ──────────────────────────────────────────────────
  const splitDeck = async (deck: Deck, parts: number) => {
    setSplitting(null)
    const { data: cards } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deck.id)
    if (!cards || cards.length === 0) return alert('카드가 없어서 분할할 수 없어요.')
    const chunkSize = Math.ceil(cards.length / parts)
    const maxOrder = Math.max(...decks.map(d => d.sort_order), 0)
    for (let i = 0; i < parts; i++) {
      const chunk = cards.slice(i * chunkSize, (i + 1) * chunkSize)
      if (chunk.length === 0) continue
      const { data: newDeck } = await supabase.from('flashcard_decks').insert({
        name: `${deck.name} (${i + 1}/${parts})`,
        exam_type: deck.exam_type, description: deck.description,
        user_id: 'flashcard_user', sort_order: maxOrder + i + 1,
      }).select('id').single()
      if (!newDeck) continue
      await supabase.from('flashcard_cards').insert(
        chunk.map(c => ({ deck_id: newDeck.id, card_type: c.card_type, fields: c.fields, occlusion: c.occlusion }))
      )
    }
    await supabase.from('flashcard_decks').delete().eq('id', deck.id)
    await loadDecks()
  }

  // ── 덱 합치기 ──────────────────────────────────────────────────
  const mergeDecks = async () => {
    if (selectedIds.size < 2) return
    const sel = decks.filter(d => selectedIds.has(d.id))
    const defaultName = sel.map(d => d.name).join(' + ')
    const newName = prompt('합칠 덱의 이름을 입력하세요:', defaultName)
    if (!newName) return
    const maxOrder = Math.max(...decks.map(d => d.sort_order), 0)
    const { data: newDeck } = await supabase.from('flashcard_decks').insert({
      name: newName, exam_type: sel[0].exam_type, description: sel[0].description,
      user_id: 'flashcard_user', sort_order: maxOrder + 1,
    }).select('id').single()
    if (!newDeck) return
    for (const deck of sel) {
      const { data: cards } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deck.id)
      if (cards?.length) await supabase.from('flashcard_cards').insert(
        cards.map(c => ({ deck_id: newDeck.id, card_type: c.card_type, fields: c.fields, occlusion: c.occlusion }))
      )
      await supabase.from('flashcard_decks').delete().eq('id', deck.id)
    }
    setSelectedIds(new Set()); setSelectMode(false); await loadDecks()
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
          <div className="flex gap-2">
            <button onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition ${selectMode?'bg-violet-600 text-white':'bg-gray-700 hover:bg-gray-600 text-white'}`}>
              {selectMode ? '선택 취소' : '선택'}
            </button>
            <button onClick={() => setShowAdd(p => !p)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
              + 새 덱
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <h3 className="font-semibold mb-4">새 덱 만들기</h3>
            {/* 카테고리 선택 */}
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {PRESET_CATS.map(cat => (
                <button key={cat} onClick={() => { setNewCategory(cat); setCustomCategory('') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    newCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {CAT_EMOJI[cat] ?? '🏷'} {cat}
                </button>
              ))}
              <button onClick={() => setNewCategory('__custom__')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  newCategory === '__custom__' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                + 직접 입력
              </button>
            </div>
            {newCategory === '__custom__' && (
              <input
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white mb-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="태그 이름 (예: 복습노트, 약점단어)"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
              />
            )}
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
              {/* TTS 설정 */}
            <button
              type="button"
              onClick={() => setTtsEnabled(v => !v)}
              className={`w-full mb-3 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                ttsEnabled ? 'bg-gray-800 text-gray-300' : 'bg-gray-800 text-gray-600'
              }`}
            >
              <span className={ttsEnabled ? 'opacity-100' : 'opacity-30'}>🔊</span>
              {ttsEnabled ? '음성 재생 켜짐' : '음성 재생 꺼짐'}
            </button>
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
              {selectMode && selectedIds.size >= 2 && (
                <div className="bg-violet-900 rounded-xl px-4 py-3 flex items-center justify-between">
                  <p className="text-sm text-violet-200">{selectedIds.size}개 선택됨</p>
                  <button onClick={mergeDecks}
                    className="bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg text-xs font-bold transition">
                    🔗 하나로 합치기
                  </button>
                </div>
              )}
              {selectMode && selectedIds.size < 2 && (
                <p className="text-xs text-gray-600 text-center py-1">합칠 덱을 2개 이상 선택하세요</p>
              )}
              {sortedCats.map(key => {
                const emoji = CAT_EMOJI[key] ?? '🏷'
                const label = key
                const groupDecks = decks.filter(d => classifyDeck(d.name, d.description) === key)
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
                            <div key={deck.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-800 transition group ${selectMode && selectedIds.has(deck.id) ? 'bg-violet-950' : ''}`}>
                              {selectMode ? (
                                <button onClick={() => setSelectedIds(prev => { const n=new Set(prev); n.has(deck.id)?n.delete(deck.id):n.add(deck.id); return n })}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${selectedIds.has(deck.id)?'bg-violet-600 border-violet-600':'border-gray-600'}`}>
                                  {selectedIds.has(deck.id) && <span className="text-white text-xs">✓</span>}
                                </button>
                              ) : (
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button onClick={() => moveUp(globalIdx)} disabled={globalIdx === 0 || reordering}
                                    className="text-gray-600 hover:text-white disabled:opacity-20 text-xs px-1 transition">▲</button>
                                  <button onClick={() => moveDown(globalIdx)} disabled={globalIdx === decks.length - 1 || reordering}
                                    className="text-gray-600 hover:text-white disabled:opacity-20 text-xs px-1 transition">▼</button>
                                </div>
                              )}
                              <div className="flex-1 cursor-pointer min-w-0" onClick={() => selectMode
                                ? setSelectedIds(prev => { const n=new Set(prev); n.has(deck.id)?n.delete(deck.id):n.add(deck.id); return n })
                                : router.push(`/flashcard/${deck.id}`)}>
                                <p className="font-semibold text-sm leading-snug truncate">{deck.name}</p>
                                <p className="text-gray-600 text-xs mt-0.5">{deck.card_count}장</p>
                              </div>
                              {!selectMode && (
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <div className="flex gap-1.5">
                                    <button onClick={() => router.push(`/flashcard/${deck.id}/quiz`)}
                                      className="bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition">▶ 퀴즈</button>
                                    <button onClick={() => router.push(`/flashcard/${deck.id}`)}
                                      className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition">편집</button>
                                  </div>
                                  {splitting === deck.id ? (
                                    <div className="flex gap-1">
                                      <button onClick={() => splitDeck(deck, 2)}
                                        className="bg-orange-700 hover:bg-orange-600 px-2 py-1 rounded-lg text-xs font-bold transition">2분할</button>
                                      <button onClick={() => splitDeck(deck, 3)}
                                        className="bg-orange-700 hover:bg-orange-600 px-2 py-1 rounded-lg text-xs font-bold transition">3분할</button>
                                      <button onClick={() => setSplitting(null)}
                                        className="text-gray-400 px-1.5 py-1 rounded-lg text-xs">✕</button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1.5">
                                      <button onClick={() => setSplitting(deck.id)}
                                        className="text-orange-500 hover:text-orange-400 text-xs px-2 py-1 rounded-lg bg-gray-800 transition">✂️ 분할</button>
                                      <button onClick={() => deleteDeck(deck.id)}
                                        className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg bg-gray-800 transition">🗑 삭제</button>
                                    </div>
                                  )}
                                </div>
                              )}
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
