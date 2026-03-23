'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Field = { name: string; value: string; type: 'text' | 'image' }
type Card = { id: string; fields: Field[] }
type QuizCard = Card & { givenIdx: number }

export default function QuizPage() {
  const router = useRouter()
  const { deckId } = useParams() as { deckId: string }
  const [deckName, setDeckName] = useState('')
  const [queue, setQueue] = useState<QuizCard[]>([])
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
    if (!cards || cards.length === 0) { setLoading(false); setDone(true); return }

    // 카드 × 필드 수만큼 문제 생성 후 셔플
    const allCards: QuizCard[] = cards.flatMap(c =>
      c.fields.map((_: Field, i: number) => ({ ...c, givenIdx: i }))
    )
    const shuffled = allCards.sort(() => Math.random() - 0.5)
    setQueue(shuffled)
    setTotal(shuffled.length)
    setLoading(false)
  }

  const current = queue[0]

  const mastered = () => {
    setMasteredCount(p => p + 1)
    setRevealed(false)
    const next = queue.slice(1)
    if (next.length === 0) setDone(true)
    else setQueue(next)
  }

  const notYet = () => {
    setRevealed(false)
    // 맨 뒤로
    setQueue(prev => [...prev.slice(1), prev[0]])
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>

  if (done) return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-3xl font-bold mb-2">완료!</h1>
      <p className="text-gray-400 mb-8">{masteredCount} / {total} 숙지</p>
      <div className="flex gap-3">
        <button onClick={loadDeck} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition">
          다시 풀기
        </button>
        <button onClick={() => router.push(`/flashcard/${deckId}`)}
          className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold transition">
          덱으로
        </button>
      </div>
    </main>
  )

  if (!current) return null

  const givenField = current.fields[current.givenIdx]
  const hiddenFields = current.fields.filter((_, i) => i !== current.givenIdx)
  const remaining = queue.length

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 md:p-8">
      {/* 상단 */}
      <div className="flex items-center justify-between mb-6 max-w-xl mx-auto w-full">
        <button onClick={() => router.push(`/flashcard/${deckId}`)} className="text-gray-400 hover:text-white text-sm">← 나가기</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-300">{deckName}</p>
          <p className="text-xs text-gray-600">남은 카드 {remaining}장 · 숙지 {masteredCount}/{total}</p>
        </div>
        <div className="w-16" />
      </div>

      {/* 진행 바 */}
      <div className="max-w-xl mx-auto w-full mb-8">
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(masteredCount / total) * 100}%` }} />
        </div>
      </div>

      {/* 카드 */}
      <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
        {/* Given */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">Given · {givenField.name}</p>
          {givenField.type === 'image' && givenField.value
            ? <img src={givenField.value} className="max-h-48 object-contain rounded-xl mx-auto" alt={givenField.name} />
            : <p className="text-2xl font-bold leading-snug whitespace-pre-wrap">{givenField.value || '—'}</p>
          }
        </div>

        {/* 정답 영역 */}
        {!revealed
          ? (
            <button onClick={() => setRevealed(true)}
              className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
              탭하여 정답 보기
            </button>
          )
          : (
            <div className="space-y-3 mb-6">
              {hiddenFields.map((f, i) => (
                <div key={i} className="bg-gray-900 rounded-2xl p-5 border border-gray-700">
                  <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">{f.name}</p>
                  {f.type === 'image' && f.value
                    ? <img src={f.value} className="max-h-40 object-contain rounded-xl" alt={f.name} />
                    : <p className="text-xl font-semibold whitespace-pre-wrap">{f.value || '—'}</p>
                  }
                </div>
              ))}
            </div>
          )
        }

        {/* 버튼 */}
        {revealed && (
          <div className="flex gap-3 mt-auto">
            <button onClick={notYet}
              className="flex-1 bg-red-900 hover:bg-red-800 rounded-2xl py-4 font-bold text-lg transition">
              😅 미숙지
            </button>
            <button onClick={mastered}
              className="flex-1 bg-green-700 hover:bg-green-600 rounded-2xl py-4 font-bold text-lg transition">
              ✅ 숙지
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
