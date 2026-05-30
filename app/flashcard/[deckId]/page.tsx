'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
const RichEditor = dynamic(() => import('@/app/components/RichEditor'), {
  ssr: false,
  loading: () => <div style={{ height: 80, background: '#1e293b', borderRadius: 8, opacity: 0.5 }} />,
})
import { OcclusionEditor, OcclusionView, type OcclusionData } from '../OcclusionEditor'

type CardType = 'basic' | 'multi' | 'cloze' | 'occlusion'
type Field = { name: string; value: string; type: 'text' | 'rich'; canBeGiven?: boolean }
type Card = { id: string; deck_id: string; card_type: CardType; fields: Field[]; occlusion?: OcclusionData; created_at: string }
type Deck = { id: string; name: string; description: string | null; exam_type: string | null }

const TYPE_LABELS: Record<CardType, string> = {
  basic: '🔵 Basic', multi: '🟣 Multi-field', cloze: '🟠 Cloze', occlusion: '🔴 Occlusion',
}

function ClozePreview({ text }: { text: string }) {
  return (
    <p className="text-sm text-gray-200 whitespace-pre-wrap">
      {text.split(/(\{\{[^}]+\}\})/g).map((p, i) =>
        p.startsWith('{{') && p.endsWith('}}')
          ? <span key={i} className="bg-yellow-900 text-yellow-300 px-1 rounded">{p.slice(2, -2)}</span>
          : <span key={i}>{p}</span>
      )}
    </p>
  )
}

export default function DeckEditPage() {
  const router = useRouter()
  const { deckId } = useParams() as { deckId: string }
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [allDecks, setAllDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Field[]>([])
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState<CardType>('basic')
  const [newFields, setNewFields] = useState<Field[]>([
    { name: '앞면', value: '', type: 'rich' },
    { name: '뒷면', value: '', type: 'rich' },
  ])
  const [newClozeText, setNewClozeText] = useState('')
  const [newOcclusion, setNewOcclusion] = useState<OcclusionData>({ imageUrl: '', blocks: [] })
  const [editOcclusion, setEditOcclusion] = useState<OcclusionData>({ imageUrl: '', blocks: [] })
  // 덱 이름/설명 편집
  const [editingDeck, setEditingDeck] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [deckDesc, setDeckDesc] = useState('')
  // 카드 이동
  const [movingCard, setMovingCard] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  // 검색/필터/정렬
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<CardType | 'all'>('all')
  const [sortKey, setSortKey] = useState<'newest' | 'oldest' | 'type' | 'alpha'>('newest')
  // JLPT용 퀴즈 방향 — localStorage로 덱별 유지
  const QUIZ_DIR_KEY = `quizDir_${deckId}`
  const [quizDir, setQuizDirState] = useState<'default' | 'word' | 'reading'>('default')
  const setQuizDir = (dir: 'default' | 'word' | 'reading') => {
    setQuizDirState(dir)
    try { localStorage.setItem(QUIZ_DIR_KEY, dir) } catch {}
  }

  useEffect(() => {
    loadData()
    try {
      const saved = localStorage.getItem(`quizDir_${deckId}`)
      if (saved === 'word' || saved === 'reading' || saved === 'default') setQuizDirState(saved)
    } catch {}
  }, [deckId])

  const changeNewType = (t: CardType) => {
    setNewType(t)
    if (t === 'basic') setNewFields([{ name: '앞면', value: '', type: 'rich' }, { name: '뒷면', value: '', type: 'rich' }])
    else if (t === 'multi') setNewFields([{ name: '', value: '', type: 'rich' }, { name: '', value: '', type: 'rich' }])
    else if (t === 'occlusion') setNewOcclusion({ imageUrl: '', blocks: [] })
    else setNewClozeText('')
  }

  const loadData = async () => {
    const { data: d } = await supabase.from('flashcard_decks').select('*').eq('id', deckId).single()
    if (d) { setDeck(d); setDeckName(d.name); setDeckDesc(d.description ?? '') }
    const { data: c } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deckId).order('created_at', { ascending: false })
    if (c) setCards(c)
    const { data: allD } = await supabase.from('flashcard_decks').select('id, name, description, exam_type').neq('id', deckId)
    if (allD) setAllDecks(allD)
    setLoading(false)
  }

  const saveDeckInfo = async () => {
    if (!deckName.trim()) return
    await supabase.from('flashcard_decks').update({ name: deckName.trim(), description: deckDesc.trim() || null }).eq('id', deckId)
    setDeck(prev => prev ? { ...prev, name: deckName.trim(), description: deckDesc.trim() || null } : prev)
    setEditingDeck(false)
  }

  const moveCard = async (cardId: string, targetDeckId: string) => {
    await supabase.from('flashcard_cards').update({ deck_id: targetDeckId }).eq('id', cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
    setMovingCard(null)
  }

  const updateNewField = (idx: number, updated: Partial<Field>) =>
    setNewFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updated } : f))

  const updateEditField = (idx: number, updated: Partial<Field>) =>
    setEditFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updated } : f))

  const addCard = async () => {
    setSaving(true)
    if (newType === 'occlusion') {
      if (!newOcclusion.imageUrl) { alert('이미지를 추가해주세요'); setSaving(false); return }
      await supabase.from('flashcard_cards').insert({ deck_id: deckId, card_type: 'occlusion', fields: [], occlusion: newOcclusion })
      setNewOcclusion({ imageUrl: '', blocks: [] })
    } else {
      let fields: Field[] = []
      if (newType === 'cloze') {
        if (!newClozeText.includes('{{')) { alert('{{빈칸}} 형식으로 빈칸을 표시해주세요'); setSaving(false); return }
        fields = [{ name: 'cloze', value: newClozeText, type: 'text' }]
      } else {
        if (newFields.some(f => !f.name.trim())) { alert('필드명을 입력해주세요'); setSaving(false); return }
        fields = newFields
      }
      await supabase.from('flashcard_cards').insert({ deck_id: deckId, card_type: newType, fields })
    }
    changeNewType('basic')
    setShowAddCard(false)
    await loadData()
    setSaving(false)
  }

  const startEdit = (card: Card) => {
    setEditingCard(card.id)
    setEditFields(JSON.parse(JSON.stringify(card.fields)))
    if (card.card_type === 'occlusion') setEditOcclusion(card.occlusion ?? { imageUrl: '', blocks: [] })
  }

  const saveEdit = async (card: Card) => {
    setSaving(true)
    if (card.card_type === 'occlusion') {
      await supabase.from('flashcard_cards').update({ occlusion: editOcclusion }).eq('id', card.id)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, occlusion: editOcclusion } : c))
    } else {
      await supabase.from('flashcard_cards').update({ fields: editFields }).eq('id', card.id)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, fields: editFields } : c))
    }
    setEditingCard(null)
    setSaving(false)
  }

  const deleteCard = async (id: string) => {
    if (!confirm('카드를 삭제할까요?')) return
    await supabase.from('flashcard_cards').delete().eq('id', id)
    setCards(prev => prev.filter(c => c.id !== id))
  }

  const renderFieldRow = (f: Field, i: number, onUpdate: (idx: number, u: Partial<Field>) => void, canDelete = false, onDelete?: () => void, showGivenToggle = false) => (
    <div key={i} className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <input className="w-28 bg-gray-800 rounded-lg px-3 py-1.5 text-white text-sm outline-none"
          placeholder="필드명" value={f.name}
          onChange={e => onUpdate(i, { name: e.target.value })} />
        {showGivenToggle && (
          <button
            onClick={() => onUpdate(i, { canBeGiven: f.canBeGiven === false ? true : false })}
            className={`px-2 py-1 rounded text-xs font-semibold transition flex-shrink-0 ${f.canBeGiven === false ? 'bg-gray-700 text-gray-500' : 'bg-blue-900 text-blue-300 border border-blue-700'}`}
            title="Given으로 출제 여부">
            {f.canBeGiven === false ? 'Given ✕' : 'Given ✓'}
          </button>
        )}
        {canDelete && onDelete && (
          <button onClick={onDelete} className="text-gray-600 hover:text-red-400 text-sm ml-auto">✕</button>
        )}
      </div>
      <RichEditor content={f.value} onChange={v => onUpdate(i, { value: v, type: 'rich' })} placeholder="내용 입력 (Ctrl+V로 이미지 붙여넣기)" />
    </div>
  )

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push(deck?.exam_type ? `/flashcard?exam=${deck.exam_type}` : '/flashcard')} className="text-gray-400 hover:text-white text-sm mb-4 block">← 덱 목록</button>
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 mr-4">
            {editingDeck ? (
              <div className="space-y-2">
                <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white font-bold text-xl outline-none"
                  value={deckName} onChange={e => setDeckName(e.target.value)} />
                <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-gray-400 text-sm outline-none"
                  placeholder="설명 (선택)" value={deckDesc} onChange={e => setDeckDesc(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={saveDeckInfo} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-sm transition">저장</button>
                  <button onClick={() => setEditingDeck(false)} className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition">취소</button>
                </div>
              </div>
            ) : (
              <div className="group/deck flex items-start gap-2">
                <div>
                  <h1 className="text-2xl font-bold">{deck?.name}</h1>
                  {deck?.description && <p className="text-gray-500 text-sm mt-1">{deck.description}</p>}
                  <p className="text-gray-600 text-xs mt-1">{cards.length}장</p>
                </div>
                <button onClick={() => setEditingDeck(true)}
                  className="text-gray-600 hover:text-gray-300 text-xs mt-1 opacity-0 group-hover/deck:opacity-100 transition">✏️</button>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {cards.length > 0 && (
              <button onClick={() => router.push(`/flashcard/${deckId}/quiz?dir=${quizDir}`)}
                className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition">▶ 퀴즈</button>
            )}
            <button onClick={() => setShowAddCard(p => !p)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">+ 카드 추가</button>
          </div>
        </div>

        {showAddCard && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <h3 className="font-semibold mb-4">새 카드</h3>
            <div className="flex gap-2 mb-5 flex-wrap">
              {(['basic', 'multi', 'cloze', 'occlusion'] as CardType[]).map(t => (
                <button key={t} onClick={() => changeNewType(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${newType === t ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            {(newType === 'basic' || newType === 'multi') && (
              <>
                {newFields.map((f, i) => renderFieldRow(f, i, updateNewField,
                  newType === 'multi' && newFields.length > 2,
                  () => setNewFields(prev => prev.filter((_, j) => j !== i)),
                  newType === 'multi'
                ))}
                {newType === 'multi' && (
                  <button onClick={() => setNewFields(prev => [...prev, { name: '', value: '', type: 'rich', canBeGiven: true }])}
                    className="text-blue-400 text-sm hover:text-blue-300 mb-3">+ 필드 추가</button>
                )}
              </>
            )}
            {newType === 'cloze' && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2">빈칸: <code className="bg-gray-800 px-1 rounded text-yellow-300">{`{{텍스트}}`}</code></p>
                <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none h-24"
                  placeholder={`예: 케이블헤드는 {{고압 케이블}}을 {{인입}}할 때 사용한다.`}
                  value={newClozeText} onChange={e => setNewClozeText(e.target.value)} />
                {newClozeText && <div className="mt-2 bg-gray-800 rounded-lg p-3"><ClozePreview text={newClozeText} /></div>}
              </div>
            )}
            {newType === 'occlusion' && (
              <div className="mb-4">
                <OcclusionEditor data={newOcclusion} onChange={setNewOcclusion} />
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={addCard} disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowAddCard(false)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">취소</button>
            </div>
          </div>
        )}

        {cards.length === 0
          ? <div className="text-gray-500 text-center py-16">카드가 없어요!</div>
          : (() => {
            const filtered = cards.filter(card => {
              const matchType = filterType === 'all' || card.card_type === filterType
              if (!matchType) return false
              if (!searchQuery.trim()) return true
              const q = searchQuery.toLowerCase()
              return card.fields.some(f => f.value?.toLowerCase().includes(q) || f.name?.toLowerCase().includes(q))
            })

            // 정렬
            const TYPE_ORDER: Record<string, number> = { occlusion: 0, basic: 1, cloze: 2, multi: 3 }
            const sorted = [...filtered].sort((a, b) => {
              if (sortKey === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              if (sortKey === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              if (sortKey === 'type') return (TYPE_ORDER[a.card_type ?? ''] ?? 9) - (TYPE_ORDER[b.card_type ?? ''] ?? 9)
              if (sortKey === 'alpha') {
                const aText = a.fields?.[0]?.value ?? ''
                const bText = b.fields?.[0]?.value ?? ''
                return aText.localeCompare(bText, 'ja')
              }
              return 0
            })
            const PAGE = 15
            const pageCount = Math.ceil(sorted.length / PAGE)
            const paginated = sorted.slice(page * PAGE, (page + 1) * PAGE)
            return (
            <div>
              {/* 퀴즈 방향 토글 (multi-field 카드가 있을 때만) */}
              {cards.some(c => c.card_type === 'multi') && (
                <div className="flex items-center gap-2 mb-3 bg-gray-900 rounded-xl p-2">
                  <span className="text-xs text-gray-500 shrink-0 px-1">퀴즈 방향</span>
                  {([
                    { k: 'default',  label: '카드별 설정' },
                    { k: 'word',     label: '단어 → 뜻' },
                    { k: 'reading',  label: '요미가나 → 뜻' },
                  ] as const).map(({ k, label }) => (
                    <button key={k} onClick={() => setQuizDir(k)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                        quizDir === k ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* 검색 + 타입 필터 + 정렬 */}
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex gap-2">
                  <input
                    className="flex-1 min-w-0 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="🔍 카드 내용 검색..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setPage(0) }}
                  />
                </div>
                <div className="flex gap-2 flex-wrap items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {(['all', 'basic', 'multi', 'cloze', 'occlusion'] as const).map(t => (
                      <button key={t} onClick={() => { setFilterType(t); setPage(0) }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${filterType === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {t === 'all' ? '전체' : TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 items-center">
                    <span className="text-[10px] text-gray-600 mr-1">정렬</span>
                    {([
                      { k: 'newest', label: '최신순' },
                      { k: 'oldest', label: '오래된순' },
                      { k: 'type',   label: '타입별' },
                      { k: 'alpha',  label: '가나다' },
                    ] as const).map(({ k, label }) => (
                      <button key={k} onClick={() => { setSortKey(k); setPage(0) }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${sortKey === k ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {sorted.length === 0
                ? <div className="text-gray-500 text-center py-12 text-sm">검색 결과가 없어요</div>
                : <>
              <div className="space-y-3">
              {paginated.map((card, ci) => {
                const isEditing = editingCard === card.id
                const globalIdx = page * PAGE + ci
                return (
                  <div key={card.id} className="bg-gray-900 rounded-2xl p-4 group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs">#{globalIdx + 1}</span>
                        <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">{TYPE_LABELS[card.card_type ?? 'basic']}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(card)} disabled={saving}
                              className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs disabled:opacity-50">
                              {saving ? '...' : '저장'}
                            </button>
                            <button onClick={() => setEditingCard(null)} className="bg-gray-700 px-3 py-1 rounded text-xs">취소</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(card)} className="text-gray-400 hover:text-white px-2 py-1 rounded text-xs">편집</button>
                            {allDecks.length > 0 && (
                              <div className="relative">
                                <button onClick={() => setMovingCard(movingCard === card.id ? null : card.id)}
                                  className="text-gray-400 hover:text-blue-400 px-2 py-1 rounded text-xs">이동</button>
                                {movingCard === card.id && (
                                  <div className="absolute right-0 top-6 bg-gray-800 border border-gray-700 rounded-lg py-1 z-10 min-w-[140px] shadow-xl">
                                    {allDecks.map(d => (
                                      <button key={d.id} onClick={() => moveCard(card.id, d.id)}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition">
                                        → {d.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <button onClick={() => deleteCard(card.id)} className="text-gray-600 hover:text-red-400 px-2 py-1 rounded text-xs">🗑</button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      card.card_type === 'cloze'
                        ? <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none h-24"
                            value={editFields[0]?.value ?? ''}
                            onChange={e => setEditFields([{ name: 'cloze', value: e.target.value, type: 'text' }])} />
                        : card.card_type === 'occlusion'
                          ? <OcclusionEditor data={editOcclusion} onChange={setEditOcclusion} />
                          : <div>
                              {editFields.map((f, i) => renderFieldRow(
                                f, i, updateEditField,
                                card.card_type === 'multi' && editFields.length > 2,
                                () => setEditFields(prev => prev.filter((_, j) => j !== i)),
                                card.card_type === 'multi'
                              ))}
                              {card.card_type === 'multi' && (
                                <button onClick={() => setEditFields(prev => [...prev, { name: '', value: '', type: 'rich', canBeGiven: true }])}
                                  className="text-blue-400 text-sm hover:text-blue-300 mb-3">+ 필드 추가</button>
                              )}
                            </div>
                    ) : (
                      card.card_type === 'cloze'
                        ? <div className="bg-gray-800 rounded-xl p-3"><ClozePreview text={card.fields[0]?.value ?? ''} /></div>
                        : card.card_type === 'occlusion'
                          ? <div className="bg-gray-800 rounded-xl p-2">
                              {card.occlusion?.imageUrl
                                ? <OcclusionView data={card.occlusion} />
                                : <p className="text-gray-500 text-xs text-center py-4">이미지 없음</p>}
                            </div>
                          : card.card_type === 'multi' && card.fields.length <= 3 ? (
                            // 테이블 뷰 (3필드 이하 multi-field)
                            (() => {
                              // 현재 방향에서 given 인덱스 계산
                              const givenIdx = quizDir === 'word' ? 0
                                : quizDir === 'reading' ? 1
                                : null // default: canBeGiven 기준
                              return (
                                <div className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-gray-800">
                                  {card.fields.map((f, i) => {
                                    const isGiven = givenIdx !== null ? i === givenIdx : f.canBeGiven !== false
                                    return (
                                      <div key={i} className={`flex-1 p-2.5 ${i < card.fields.length - 1 ? 'border-r border-gray-800' : ''} ${isGiven ? 'bg-blue-950/60 border-b-2 border-b-blue-500' : 'bg-gray-800/50'}`}>
                                        <p className={`text-[10px] font-semibold mb-1 ${isGiven ? 'text-blue-400' : 'text-gray-500'}`}>
                                          {f.name}{isGiven ? ' ✦' : ''}
                                        </p>
                                        <p className="text-sm text-gray-200 whitespace-pre-wrap font-medium">{f.value || '—'}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })()
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {card.fields.map((f, i) => (
                                <div key={i} className="bg-gray-800 rounded-xl p-3">
                                  <div className="flex items-center gap-1 mb-1">
                                    <p className="text-xs text-blue-400 font-semibold">{f.name}</p>
                                    {card.card_type === 'multi' && f.canBeGiven === false &&
                                      <span className="text-xs text-gray-600">(Given ✕)</span>}
                                  </div>
                                  {f.type === 'rich'
                                    ? <div className="prose prose-invert prose-sm max-w-none [&_img]:max-w-full [&_img]:rounded"
                                        dangerouslySetInnerHTML={{ __html: f.value }} />
                                    : <p className="text-sm text-gray-200 whitespace-pre-wrap">{f.value || '—'}</p>
                                  }
                                </div>
                              ))}
                            </div>
                          )
                    )}
                  </div>
                )
              })}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm disabled:opacity-30 transition">← 이전</button>
                  <span className="text-gray-500 text-sm">{page + 1} / {pageCount}</span>
                  <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page === pageCount - 1}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm disabled:opacity-30 transition">다음 →</button>
                </div>
              )}
              </>}
            </div>
            )
          })()
        }
      </div>
    </main>
  )
}
