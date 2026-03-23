'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type CardType = 'basic' | 'multi' | 'cloze'
type ImageItem = { url: string; x: number; y: number; w: number; h: number }
type Field = { name: string; value: string; type: 'text' | 'image'; images?: ImageItem[] }
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

const CANVAS_H = 260

function ImageCanvas({ field, fieldIdx, deckId, onUpdate }: {
  field: Field
  fieldIdx: number
  deckId: string
  onUpdate: (idx: number, updated: Partial<Field>) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const images = field.images ?? []

  const uploadAndAdd = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const ext = file.name.split('.').pop() || 'png'
    const path = `${deckId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('flashcard-images').upload(path, file, { upsert: true })
    if (error) { alert('업로드 실패'); return }
    const { data } = supabase.storage.from('flashcard-images').getPublicUrl(path)
    const prev = field.images ?? []
    // 새 이미지는 캔버스 중앙에 배치
    const x = Math.max(0, 160 * (prev.length % 3))
    const y = Math.max(0, 80 * Math.floor(prev.length / 3))
    onUpdate(fieldIdx, {
      type: 'image',
      images: [...prev, { url: data.publicUrl, x, y, w: 150, h: 120 }]
    })
  }, [deckId, field.images, fieldIdx, onUpdate])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (item) { e.preventDefault(); uploadAndAdd(item.getAsFile()!) }
  }, [uploadAndAdd])

  const startDrag = (e: React.MouseEvent | React.TouchEvent, imgIdx: number, action: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    setSelected(imgIdx)
    const isTouch = 'touches' in e
    const startX = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const startY = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    const img = images[imgIdx]
    const origX = img.x, origY = img.y, origW = img.w, origH = img.h

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX
      const cy = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY
      const dx = cx - startX, dy = cy - startY
      const updated = [...images]
      if (action === 'move') {
        updated[imgIdx] = { ...img, x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) }
      } else {
        updated[imgIdx] = { ...img, w: Math.max(40, origW + dx), h: Math.max(40, origH + dy) }
      }
      onUpdate(fieldIdx, { images: updated })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
  }

  const deleteImg = (imgIdx: number) => {
    const updated = images.filter((_, i) => i !== imgIdx)
    onUpdate(fieldIdx, { images: updated, type: updated.length === 0 ? 'text' : 'image' })
    setSelected(null)
  }

  return (
    <div
      ref={canvasRef}
      className="flex-1 relative rounded-lg bg-gray-800 border-2 border-dashed border-gray-700 outline-none"
      style={{ height: CANVAS_H }}
      tabIndex={0}
      onPaste={handlePaste}
      onClick={(e) => { if (e.target === canvasRef.current) setSelected(null) }}
    >
      {images.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs pointer-events-none">
          클릭 후 Ctrl+V로 이미지 붙여넣기
        </div>
      )}
      {images.map((img, ii) => (
        <div
          key={ii}
          className={`absolute cursor-move select-none ${selected === ii ? 'ring-2 ring-blue-500' : ''}`}
          style={{ left: img.x, top: img.y, width: img.w, height: img.h }}
          onMouseDown={e => startDrag(e, ii, 'move')}
          onTouchStart={e => startDrag(e, ii, 'move')}
        >
          <img src={img.url} className="w-full h-full object-contain rounded" alt="" draggable={false} />
          {selected === ii && (
            <>
              <button
                className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center z-10"
                onMouseDown={e => { e.stopPropagation(); deleteImg(ii) }}
              >✕</button>
              {/* 리사이즈 핸들 */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
                style={{ background: 'linear-gradient(135deg, transparent 50%, #3b82f6 50%)' }}
                onMouseDown={e => startDrag(e, ii, 'resize')}
                onTouchStart={e => startDrag(e, ii, 'resize')}
              />
            </>
          )}
        </div>
      ))}
    </div>
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
    if (t === 'basic') setNewFields([{ name: '앞면', value: '', type: 'text' }, { name: '뒷면', value: '', type: 'text' }])
    else if (t === 'multi') setNewFields([{ name: '', value: '', type: 'text' }, { name: '', value: '', type: 'text' }])
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

  const renderFieldRow = (f: Field, i: number, onUpdate: (idx: number, u: Partial<Field>) => void, canDelete = false, onDelete?: () => void) => (
    <div key={i} className="mb-3 flex gap-2 items-start">
      <input className="w-24 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none flex-shrink-0"
        placeholder="필드명" value={f.name}
        onChange={e => onUpdate(i, { name: e.target.value })} />
      <div className="flex-1 flex gap-2 items-start">
        {f.type === 'image'
          ? <ImageCanvas field={f} fieldIdx={i} deckId={deckId} onUpdate={onUpdate} />
          : (
            <div className="flex-1 flex gap-2">
              <textarea className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none min-h-[40px]"
                placeholder="내용" value={f.value}
                onChange={e => onUpdate(i, { value: e.target.value, type: 'text' })} />
              <button onClick={() => onUpdate(i, { type: 'image', value: '', images: [] })}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm flex-shrink-0 text-gray-400 hover:text-white transition"
                title="이미지 캔버스로 전환">🖼</button>
            </div>
          )
        }
      </div>
      {canDelete && onDelete && (
        <button onClick={onDelete} className="text-gray-600 hover:text-red-400 py-2 flex-shrink-0">✕</button>
      )}
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
                  () => setNewFields(prev => prev.filter((_, j) => j !== i))
                ))}
                {newType === 'multi' && (
                  <button onClick={() => setNewFields(prev => [...prev, { name: '', value: '', type: 'text' }])}
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
                        : <div>{editFields.map((f, i) => renderFieldRow(f, i, updateEditField))}</div>
                    ) : (
                      card.card_type === 'cloze'
                        ? <div className="bg-gray-800 rounded-xl p-3"><ClozePreview text={card.fields[0]?.value ?? ''} /></div>
                        : (
                          <div className="grid grid-cols-2 gap-2">
                            {card.fields.map((f, i) => (
                              <div key={i} className="bg-gray-800 rounded-xl p-3">
                                <p className="text-xs text-blue-400 font-semibold mb-1">{f.name}</p>
                                {f.type === 'image' && f.images?.length
                                  ? (
                                    <div className="relative bg-gray-900 rounded" style={{ height: 120 }}>
                                      {f.images.map((img, ii) => (
                                        <img key={ii} src={img.url}
                                          style={{ position: 'absolute', left: img.x * 0.5, top: img.y * 0.5, width: img.w * 0.5, height: img.h * 0.5 }}
                                          className="object-contain rounded" alt="" />
                                      ))}
                                    </div>
                                  )
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
