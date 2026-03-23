'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type CardType = 'basic' | 'multi' | 'cloze'
type Field = { name: string; value: string; type: 'text' | 'image' | 'rich'; canBeGiven?: boolean; images?: {url: string; x: number; y: number; w: number; h: number}[] }

function renderField(f: Field) {
  if (f.type === 'rich') return (
    <div className="prose prose-invert max-w-none [&_img]:max-w-full [&_img]:rounded-xl"
      dangerouslySetInnerHTML={{ __html: f.value }} />
  )
  if (f.type === 'image' && f.images?.length) {
    return (
      <div className="relative bg-gray-800 rounded-xl" style={{ height: 220 }}>
        {f.images.map((img: any, i: number) => (
          <img key={i} src={img.url}
            style={{ position: 'absolute', left: img.x, top: img.y, width: img.w, height: img.h }}
            className="object-contain rounded" alt="" />
        ))}
      </div>
    )
  }
  if (f.type === 'image' && f.value) return <img src={f.value} className="max-h-48 object-contain rounded-xl mx-auto" alt="" />
  return <p className="text-2xl font-bold whitespace-pre-wrap">{f?.value || '—'}</p>
}


type Card = { id: string; card_type: CardType; fields: Field[] }

type QuizItem =
  | { kind: 'basic'; card: Card; direction: 'front' | 'back' }
  | { kind: 'multi'; card: Card; givenIdx: number }
  | { kind: 'cloze'; card: Card; blankIdx: number; blanks: string[] }

function parseCloze(text: string): { template: string; blanks: string[] } {
  const blanks: string[] = []
  const template = text.replace(/\{\{([^}]+)\}\}/g, (_, b) => { blanks.push(b); return '___' })
  return { template, blanks }
}

function ClozeDisplay({ text, revealIdx, revealed }: { text: string; revealIdx: number; revealed: boolean }) {
  let idx = -1
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return (
    <p className="text-xl font-semibold leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.startsWith('{{') && p.endsWith('}}')) {
          idx++
          const isTarget = idx === revealIdx
          const word = p.slice(2, -2)
          if (isTarget) {
            return revealed
              ? <span key={i} className="bg-green-800 text-green-200 px-2 py-0.5 rounded mx-0.5">{word}</span>
              : <span key={i} className="bg-yellow-900 text-yellow-900 px-2 py-0.5 rounded mx-0.5 border border-yellow-700 select-none">{word}</span>
          }
          return <span key={i} className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded mx-0.5">{word}</span>
        }
        return <span key={i}>{p}</span>
      })}
    </p>
  )
}

export default function QuizPage() {
  const router = useRouter()
  const { deckId } = useParams() as { deckId: string }
  const [deckName, setDeckName] = useState('')
  const [queue, setQueue] = useState<QuizItem[]>([])
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [masteredCount, setMasteredCount] = useState(0)

  useEffect(() => { loadDeck() }, [deckId])

  const loadDeck = async () => {
    const { data: deck } = await supabase.from('flashcard_decks').select('name').eq('id', deckId).single()
    if (deck) setDeckName(deck.name)
    const { data: cards } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deckId)
    if (!cards || cards.length === 0) { setDone(true); setLoading(false); return }

    const items: QuizItem[] = []
    for (const card of cards) {
      const type = card.card_type ?? 'basic'
      if (type === 'basic') {
        items.push({ kind: 'basic', card, direction: 'front' })
        items.push({ kind: 'basic', card, direction: 'back' })
      } else if (type === 'multi') {
        const givenIndices = card.fields
          .map((_: Field, i: number) => i)
          .filter((i: number) => card.fields[i].canBeGiven !== false)
        givenIndices.forEach((i: number) => items.push({ kind: 'multi', card, givenIdx: i }))
      } else if (type === 'cloze') {
        const { blanks } = parseCloze(card.fields[0]?.value ?? '')
        blanks.forEach((_, i) => items.push({ kind: 'cloze', card, blankIdx: i, blanks }))
      }
    }
    const shuffled = items.sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    setTotal(shuffled.length)
    setMasteredCount(0)
    setLoading(false)
  }

  const mastered = () => {
    setMasteredCount(p => p + 1)
    setRevealed(false)
    const next = queue.slice(1)
    if (next.length === 0) setDone(true)
    else setQueue(next)
  }

  const notYet = () => {
    setRevealed(false)
    setQueue(prev => [...prev.slice(1), prev[0]])
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>

  if (done) return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-3xl font-bold mb-2">완료!</h1>
      <p className="text-gray-400 mb-8">{masteredCount} / {total} 숙지</p>
      <div className="flex gap-3">
        <button onClick={loadDeck} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition">다시 풀기</button>
        <button onClick={() => router.push(`/flashcard/${deckId}`)} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold transition">덱으로</button>
      </div>
    </main>
  )

  const current = queue[0]
  if (!current) return null

  const renderGiven = () => {
    if (current.kind === 'basic') {
      const f = current.direction === 'front' ? current.card.fields[0] : current.card.fields[1]
      const label = current.direction === 'front' ? '앞면' : '뒷면'
      return (
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">Given · {label}</p>
          {renderField(f as Field)}
        </div>
      )
    }
    if (current.kind === 'multi') {
      const f = current.card.fields[current.givenIdx]
      return (
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">Given · {f.name}</p>
          {renderField(f as Field)}
        </div>
      )
    }
    if (current.kind === 'cloze') {
      return (
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-yellow-900">
          <p className="text-xs text-yellow-500 font-semibold uppercase tracking-widest mb-3">빈칸 채우기</p>
          <ClozeDisplay text={current.card.fields[0]?.value ?? ''} revealIdx={current.blankIdx} revealed={revealed} />
        </div>
      )
    }
  }

  const renderAnswer = () => {
    if (!revealed) return (
      <button onClick={() => setRevealed(true)}
        className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
        탭하여 정답 보기
      </button>
    )

    if (current.kind === 'basic') {
      const f = current.direction === 'front' ? current.card.fields[1] : current.card.fields[0]
      const label = current.direction === 'front' ? '뒷면' : '앞면'
      return (
        <div className="bg-gray-900 rounded-2xl p-5 border border-green-900 mb-6">
          <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">{label}</p>
          {renderField(f as Field)}
        </div>
      )
    }

    if (current.kind === 'multi') {
      return (
        <div className="space-y-3 mb-6">
          {current.card.fields.filter((_, i) => i !== current.givenIdx).map((f, i) => (
            <div key={i} className="bg-gray-900 rounded-2xl p-5 border border-green-900">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">{f.name}</p>
              {renderField(f as Field)}
            </div>
          ))}
        </div>
      )
    }

    if (current.kind === 'cloze') {
      return (
        <div className="bg-gray-900 rounded-2xl p-5 border border-green-900 mb-6">
          <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">정답</p>
          <p className="text-2xl font-bold text-green-300">{current.blanks[current.blankIdx]}</p>
        </div>
      )
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 md:p-8">
      <div className="flex items-center justify-between mb-6 max-w-xl mx-auto w-full">
        <button onClick={() => router.push(`/flashcard/${deckId}`)} className="text-gray-400 hover:text-white text-sm">← 나가기</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-300">{deckName}</p>
          <p className="text-xs text-gray-600">남은 {queue.length}장 · 숙지 {masteredCount}/{total}</p>
        </div>
        <div className="w-16" />
      </div>

      <div className="max-w-xl mx-auto w-full mb-6">
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(masteredCount / total) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
        {renderGiven()}
        {renderAnswer()}
        {revealed && (
          <div className="flex gap-3 mt-auto">
            <button onClick={notYet} className="flex-1 bg-red-900 hover:bg-red-800 rounded-2xl py-4 font-bold text-lg transition">😅 미숙지</button>
            <button onClick={mastered} className="flex-1 bg-green-700 hover:bg-green-600 rounded-2xl py-4 font-bold text-lg transition">✅ 숙지</button>
          </div>
        )}
      </div>
    </main>
  )
}
