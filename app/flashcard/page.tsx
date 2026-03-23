'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Deck = {
  id: string
  name: string
  description: string | null
  created_at: string
  card_count?: number
}

export default function FlashcardPage() {
  const router = useRouter()
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const USER_ID = 'flashcard_user'

  useEffect(() => { loadDecks() }, [])

  const loadDecks = async () => {
    const { data } = await supabase
      .from('flashcard_decks').select('*')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }

    // 카드 수 가져오기
    const decksWithCount = await Promise.all(data.map(async d => {
      const { count } = await supabase
        .from('flashcard_cards').select('*', { count: 'exact', head: true })
        .eq('deck_id', d.id)
      return { ...d, card_count: count ?? 0 }
    }))
    setDecks(decksWithCount)
    setLoading(false)
  }

  const addDeck = async () => {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('flashcard_decks').insert({
      user_id: USER_ID, name: newName.trim(),
      description: newDesc.trim() || null,
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

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-sm">← 홈</button>
        </div>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">🃏 플래시카드</h1>
            <p className="text-gray-500 text-sm">멀티필드 인출 훈련 · 덱 관리</p>
          </div>
          <button onClick={() => setShowAdd(p => !p)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
            + 새 덱
          </button>
        </div>

        {/* 새 덱 추가 폼 */}
        {showAdd && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-gray-700">
            <h3 className="font-semibold mb-4">새 덱 만들기</h3>
            <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="덱 이름 (예: 수변전 기기 심볼)" value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDeck()} />
            <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white mb-4 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="설명 (선택)" value={newDesc}
              onChange={e => setNewDesc(e.target.value)} />
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

        {/* 덱 목록 */}
        {decks.length === 0
          ? <div className="text-gray-500 text-center py-16">아직 덱이 없어요. + 새 덱을 만들어보세요!</div>
          : (
            <div className="space-y-3">
              {decks.map(deck => (
                <div key={deck.id} className="bg-gray-900 rounded-2xl p-5 flex items-center gap-4 hover:bg-gray-800 transition group">
                  <div className="flex-1 cursor-pointer" onClick={() => router.push(`/flashcard/${deck.id}`)}>
                    <h2 className="font-bold text-lg">{deck.name}</h2>
                    {deck.description && <p className="text-gray-400 text-sm mt-0.5">{deck.description}</p>}
                    <p className="text-gray-600 text-xs mt-1">{deck.card_count}장</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => router.push(`/flashcard/${deck.id}/quiz`)}
                      className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
                      ▶ 퀴즈
                    </button>
                    <button onClick={() => router.push(`/flashcard/${deck.id}`)}
                      className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm transition">
                      편집
                    </button>
                    <button onClick={() => deleteDeck(deck.id)}
                      className="text-gray-600 hover:text-red-400 px-2 py-2 rounded-lg text-sm transition opacity-0 group-hover:opacity-100">
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </main>
  )
}
