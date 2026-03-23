'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import RichEditor from '@/app/components/RichEditor'

type CardType = 'basic' | 'multi' | 'cloze'
type Field = { name: string; value: string; type: 'text' | 'rich'; canBeGiven?: boolean }
type Card = { id: string; deck_id: string; card_type: CardType; fields: Field[]; created_at: string }
type Deck = { id: string; name: string; description: string | null }

const TYPE_LABELS: Record<CardType, string> = {
  basic: '🔵 Basic', multi: '🟣 Multi-field', cloze: '🟠 Cloze',
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
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Field[]>([])
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState<CardType>('basic')
  const [newFields, setNewFields] = useState<Field[]>([
    { name: '앞면', value: '', type: 'text' },
    { name: '뒷면', value: '', type: 'text' },
  ])
  const [newClozeText, setNewClozeText] = useState('')

  useEffect(() => { loadData() }, [deckId])

  const changeNewType = (t: CardType) => {
    setNewType(t)
    if (t === 'basic') setNewFields([{ name: '앞면', value: '', type: 'rich' }, { name: '뒷면', value: '', type: 'rich' }])
    else if (t === 'multi') setNewFields([{ name: '', value: '', type: 'rich' }, { name: '', value: '', type: 'rich' }])
    else setNewClozeText('')
  }

  const loadData = async () => {
    const { data: d } = await supabase.from('flashcard_decks').select('*').eq('id', deckId).single()
    if (d) setDeck(d)
    const { data: c } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deckId).order('created_at')
    if (c) setCards(c)
    setLoading(false)
  }

  const updateNewField = (idx: number, updated: Partial<Field>) =>
    setNewFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updated } : f))

  const updateEditField = (idx: number, updated: Partial<Field>) =>
    setEditFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updated } : f))

  const addCard = async () => {
    setSaving(true)
    let fields: Field[] = []
    if (newType === 'cloze') {
      if (!newClozeText.includes('{{')) { alert('{{빈칸}} 형식으로 빈칸을 표시해주세요'); setSaving(false); return }
      fields = [{ name: 'cloze', value: newClozeText, type: 'text' }]
    } else {
      if (newFields.some(f => !f.name.trim())) { alert('필드명을 입력해주세요'); setSaving(false); return }
      fields = newFields
    }
    await supabase.from('flashcard_cards').insert({ deck_id: deckId, card_type: newType, fields })
    changeNewType('basic')
    setShowAddCard(false)
    await loadData()
    setSaving(false)
  }

  const startEdit = (card: Card) => {
    setEditingCard(card.id)
    setEditFields(JSON.parse(JSON.stringify(card.fields)))
  }

  const saveEdit = async (card: Card) => {
    setSaving(true)
    await supabase.from('flashcard_cards').update({ fields: editFields }).eq('id', card.id)
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, fields: editFields } : c))
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
        <button onClick={() => router.push('/flashcard')} className="text-gray-400 hover:text-white text-sm mb-4 block">← 덱 목록</button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{deck?.name}</h1>
            {deck?.description && <p className="text-gray-500 text-sm mt-1">{deck.description}</p>}
            <p className="text-gray-600 text-xs mt-1">{cards.length}장</p>
          </div>
          <div className="flex gap-2">
            {cards.length > 0 && (
              <button onClick={() => router.push(`/flashcard/${deckId}/quiz`)}
                className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition">▶ 퀴즈</button>
            )}
            <button onClick={() => setShowAddCard(p => !p)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">+ 카드 추가</button>
          </div>
        </div>

        {showAddCard && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <h3 className="font-semibold mb-4">새 카드</h3>
            <div className="flex gap-2 mb-5">
              {(['basic', 'multi', 'cloze'] as CardType[]).map(t => (
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
          : (
            <div className="space-y-3">
              {cards.map((card, ci) => {
                const isEditing = editingCard === card.id
                return (
                  <div key={card.id} className="bg-gray-900 rounded-2xl p-4 group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs">#{ci + 1}</span>
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
                        : (
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
          )
        }
      </div>
    </main>
  )
}
