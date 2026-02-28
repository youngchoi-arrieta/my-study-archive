'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

type Card = {
  id: string
  title: string
  category: string
  tags: string[]
  source: string
  created_at: string
}

export default function CardList() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')

  useEffect(() => {
    const fetchCards = async () => {
      const { data } = await supabase
        .from('cards')
        .select('id, title, category, tags, source, created_at')
        .order('created_at', { ascending: false })
      setCards(data || [])
      setLoading(false)
    }
    fetchCards()
  }, [])

  const allTags = Array.from(new Set(cards.flatMap(c => c.tags || [])))

  const filtered = cards.filter(card => {
    const matchSearch = search === '' ||
      card.title?.toLowerCase().includes(search.toLowerCase()) ||
      card.category?.toLowerCase().includes(search.toLowerCase()) ||
      card.source?.toLowerCase().includes(search.toLowerCase()) ||
      card.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchTag = selectedTag === '' || card.tags?.includes(selectedTag)
    return matchSearch && matchTag
  })

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">📚 카드 목록</h1>
          <Link href="/cards/new" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition">
            + 새 카드
          </Link>
        </div>

        <input
          className="w-full bg-gray-800 rounded-lg p-3 mb-4 text-white placeholder-gray-500"
          placeholder="🔍 제목, 카테고리, 태그, 출처 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setSelectedTag('')}
              className={`px-3 py-1 rounded-full text-sm transition ${
                selectedTag === '' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}>
              전체
            </button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  selectedTag === tag ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <p className="text-gray-500 text-sm mb-4">{filtered.length}개 카드</p>

        {loading && <p className="text-gray-400">불러오는 중...</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">📭</p>
            <p>{search || selectedTag ? '검색 결과가 없어요' : '아직 저장된 카드가 없어요'}</p>
            {!search && !selectedTag && (
              <Link href="/cards/new" className="text-blue-400 hover:underline mt-2 inline-block">
                첫 카드 추가하기 →
              </Link>
            )}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(card => (
            <Link key={card.id} href={`/cards/${card.id}`}
              className="block bg-gray-800 hover:bg-gray-700 rounded-xl p-5 transition">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">{card.title}</h2>
                <span className="text-xs text-gray-500 ml-4 shrink-0">
                  {new Date(card.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              {card.category && <p className="text-blue-400 text-sm mt-1">{card.category}</p>}
              {card.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {card.tags.map(tag => (
                    <span key={tag} className={`text-xs px-2 py-1 rounded-full ${
                      selectedTag === tag ? 'bg-blue-600' : 'bg-gray-700'
                    }`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {card.source && <p className="text-gray-500 text-xs mt-2">{card.source}</p>}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}