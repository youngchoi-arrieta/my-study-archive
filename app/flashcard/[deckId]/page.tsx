'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Field = { name: string; value: string; type: 'text' | 'image' }
type Card = { id: string; deck_id: string; fields: Field[]; created_at: string }
type Deck = { id: string; name: string; description: string | null }

export default function DeckEditPage() {
  const router = useRouter()
  const { deckId } = useParams() as { deckId: string }
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [fieldDefs, setFieldDefs] = useState<string[]>(['', ''])
  const [newFields, setNewFields] = useState<Field[]>([
    { name: '', value: '', type: 'text' },
    { name: '', value: '', type: 'text' },
  ])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadingFieldIdx = useRef<number>(0)

  useEffect(() => { loadData() }, [deckId])

  const loadData = async () => {
    const { data: d } = await supabase.from('flashcard_decks').select('*').eq('id', deckId).single()
    if (d) setDeck(d)
    const { data: c } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deckId).order('created_at')
    if (c) setCards(c)
    setLoading(false)
  }

  const uploadImage = async (file: File, fieldIdx: number, cardFields: Field[], setFields: (f: Field[]) => void) => {
    setUploading(fieldIdx)
    const ext = file.name.split('.').pop()
    const path = `${deckId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('flashcard-images').upload(path, file, { upsert: true })
    if (error) { alert('업로드 실패'); setUploading(null); return }
    const { data: urlData } = supabase.storage.from('flashcard-images').getPublicUrl(path)
    const updated = cardFields.map((f, i) => i === fieldIdx ? { ...f, value: urlData.publicUrl, type: 'image' as const } : f)
    setFields(updated)
    setUploading(null)
  }

  const addCard = async () => {
    if (newFields.some(f => !f.name.trim())) { alert('모든 필드 이름을 입력해주세요'); return }
    setSaving(true)
    await supabase.from('flashcard_cards').insert({ deck_id: deckId, fields: newFields })
    setNewFields([{ name: '', value: '', type: 'text' }, { name: '', value: '', type: 'text' }])
    setShowAddCard(false)
    await loadData()
    setSaving(false)
  }

  const saveCard = async (card: Card, fields: Field[]) => {
    setSaving(true)
    await supabase.from('flashcard_cards').update({ fields }).eq('id', card.id)
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, fields } : c))
    setEditingCard(null)
    setSaving(false)
  }

  const deleteCard = async (id: string) => {
    if (!confirm('카드를 삭제할까요?')) return
    await supabase.from('flashcard_cards').delete().eq('id', id)
    setCards(prev => prev.filter(c => c.id !== id))
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0]
          if (!file) return
          if (editingCard) {
            const card = cards.find(c => c.id === editingCard)!
            const fields = [...card.fields]
            await uploadImage(file, uploadingFieldIdx.current, fields, updated => {
              setCards(prev => prev.map(c => c.id === editingCard ? { ...c, fields: updated } : c))
            })
          } else {
            await uploadImage(file, uploadingFieldIdx.current, newFields, setNewFields)
          }
          e.target.value = ''
        }} />

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/flashcard')} className="text-gray-400 hover:text-white text-sm">← 덱 목록</button>
        </div>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{deck?.name}</h1>
            {deck?.description && <p className="text-gray-500 text-sm mt-1">{deck.description}</p>}
            <p className="text-gray-600 text-xs mt-1">{cards.length}장</p>
          </div>
          <div className="flex gap-2">
            {cards.length > 0 && (
              <button onClick={() => router.push(`/flashcard/${deckId}/quiz`)}
                className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
                ▶ 퀴즈 시작
              </button>
            )}
            <button onClick={() => setShowAddCard(p => !p)}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
              + 카드 추가
            </button>
          </div>
        </div>

        {/* 카드 추가 폼 */}
        {showAddCard && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">새 카드</h3>
              <button onClick={() => setNewFields(prev => [...prev, { name: '', value: '', type: 'text' }])}
                className="text-blue-400 text-sm hover:text-blue-300">+ 필드 추가</button>
            </div>
            {newFields.map((f, i) => (
              <div key={i} className="mb-3 flex gap-2 items-start">
                <input className="w-28 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none flex-shrink-0"
                  placeholder="필드명" value={f.name}
                  onChange={e => setNewFields(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <div className="flex-1 flex gap-2">
                  {f.type === 'image' && f.value
                    ? <img src={f.value} className="h-20 rounded-lg object-contain bg-gray-800" alt="업로드된 이미지" />
                    : <input className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none"
                        placeholder="내용" value={f.value}
                        onChange={e => setNewFields(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value, type: 'text' } : x))} />
                  }
                  <button onClick={() => { uploadingFieldIdx.current = i; fileInputRef.current?.click() }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex-shrink-0">
                    {uploading === i ? '⏳' : '🖼'}
                  </button>
                </div>
                {newFields.length > 2 && (
                  <button onClick={() => setNewFields(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-600 hover:text-red-400 py-2">✕</button>
                )}
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button onClick={addCard} disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowAddCard(false)}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">취소</button>
            </div>
          </div>
        )}

        {/* 카드 목록 */}
        {cards.length === 0
          ? <div className="text-gray-500 text-center py-16">카드가 없어요. 위에서 추가해보세요!</div>
          : (
            <div className="space-y-3">
              {cards.map((card, ci) => {
                const isEditing = editingCard === card.id
                const [editFields, setEditFields] = useState<Field[]>([...card.fields])
                return (
                  <div key={card.id} className="bg-gray-900 rounded-2xl p-4 group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-600 text-xs">카드 {ci + 1}</span>
                      <div className="flex gap-2">
                        {isEditing
                          ? <>
                              <button onClick={() => saveCard(card, editFields)} disabled={saving}
                                className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-xs transition disabled:opacity-50">
                                {saving ? '...' : '저장'}
                              </button>
                              <button onClick={() => setEditingCard(null)}
                                className="bg-gray-700 px-3 py-1 rounded text-xs">취소</button>
                            </>
                          : <>
                              <button onClick={() => { setEditingCard(card.id) }}
                                className="text-gray-600 hover:text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition">편집</button>
                              <button onClick={() => deleteCard(card.id)}
                                className="text-gray-600 hover:text-red-400 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition">🗑</button>
                            </>
                        }
                      </div>
                    </div>
                    {isEditing
                      ? (
                        <div className="space-y-2">
                          {editFields.map((f, i) => (
                            <div key={i} className="flex gap-2 items-start">
                              <input className="w-28 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none flex-shrink-0"
                                value={f.name} onChange={e => setEditFields(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                              <div className="flex-1 flex gap-2">
                                {f.type === 'image' && f.value
                                  ? <img src={f.value} className="h-20 rounded-lg object-contain bg-gray-800" alt="" />
                                  : <input className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none"
                                      value={f.value} onChange={e => setEditFields(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value, type: 'text' } : x))} />
                                }
                                <button onClick={() => { uploadingFieldIdx.current = i; fileInputRef.current?.click() }}
                                  className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex-shrink-0">
                                  {uploading === i ? '⏳' : '🖼'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                      : (
                        <div className="grid grid-cols-2 gap-2">
                          {card.fields.map((f, i) => (
                            <div key={i} className="bg-gray-800 rounded-xl p-3">
                              <p className="text-xs text-blue-400 font-semibold mb-1">{f.name}</p>
                              {f.type === 'image' && f.value
                                ? <img src={f.value} className="max-h-24 object-contain rounded" alt={f.name} />
                                : <p className="text-sm text-gray-200 whitespace-pre-wrap">{f.value || '—'}</p>
                              }
                            </div>
                          ))}
                        </div>
                      )
                    }
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
