'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type DiagramCard = {
  id: string
  title: string
  category: string
  tags: string[]
  source: string
  card_type: string
  status: string
  review_count: number
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  '새 카드': 'bg-gray-600',
  '오답노트': 'bg-red-600',
  '완료': 'bg-blue-600',
}

const TYPE_COLORS: Record<string, string> = {
  '도면해석': 'bg-blue-800',
  'Table spec': 'bg-purple-700',
  '시퀀스회로도': 'bg-teal-700',
}

function DiagramListInner() {
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') || ''
  const [cards, setCards] = useState<DiagramCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(statusFilter)
  const [selectedType, setSelectedType] = useState('')

  useEffect(() => {
    const fetchCards = async () => {
      const { data } = await supabase
        .from('diagram_cards')
        .select('id, title, category, tags, source, card_type, status, review_count, created_at')
        .order('created_at', { ascending: false })
      setCards(data || [])
      setLoading(false)
    }
    fetchCards()
  }, [])

  const allStatuses = ['새 카드', '오답노트', '완료']
  const allTypes = ['도면해석', 'Table spec', '시퀀스회로도']

  const filtered = cards.filter(card => {
    const matchSearch = search === '' ||
      card.title?.toLowerCase().includes(search.toLowerCase()) ||
      card.category?.toLowerCase().includes(search.toLowerCase()) ||
      card.source?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = selectedStatus === '' || card.status === selectedStatus
    const matchType = selectedType === '' || card.card_type === selectedType
    return matchSearch && matchStatus && matchType
  })

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
            <h1 className="text-3xl font-bold">🗺️ 자료해석형 문제</h1>
          </div>
          <Link href="/diagram/new" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition">
            + 새 카드
          </Link>
        </div>

        <input
          className="w-full bg-gray-800 rounded-lg p-3 mb-4 text-white placeholder-gray-500"
          placeholder="🔍 제목, 카테고리, 출처 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* 상태 필터 */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button onClick={() => setSelectedStatus('')}
            className={`px-3 py-1 rounded-full text-sm transition ${
              selectedStatus === '' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}>
            전체
          </button>
          {allStatuses.map(s => (
            <button key={s} onClick={() => setSelectedStatus(selectedStatus === s ? '' : s)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                selectedStatus === s ? STATUS_COLORS[s] : 'bg-gray-700 hover:bg-gray-600'
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* 타입 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setSelectedType('')}
            className={`px-3 py-1 rounded-full text-sm transition ${
              selectedType === '' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}>
            전체 타입
          </button>
          {allTypes.map(t => (
            <button key={t} onClick={() => setSelectedType(selectedType === t ? '' : t)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                selectedType === t ? TYPE_COLORS[t] : 'bg-gray-700 hover:bg-gray-600'
              }`}>
              {t === '도면해석' ? '🗺️' : t === 'Table spec' ? '📊' : '⚡'} {t}
            </button>
          ))}
        </div>

        <p className="text-gray-500 text-sm mb-4">{filtered.length}개 카드</p>
        {loading && <p className="text-gray-400">불러오는 중...</p>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">🗺️</p>
            <p>{search || selectedStatus || selectedType ? '검색 결과가 없어요' : '아직 저장된 카드가 없어요'}</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(card => (
            <Link key={card.id} href={`/diagram/${card.id}`}
              className="block bg-gray-800 hover:bg-gray-700 rounded-xl p-5 transition">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold">{card.title}</h2>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[card.card_type] || 'bg-gray-700'}`}>
                    {card.card_type}
                  </span>
                  {card.status && (
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[card.status] || 'bg-gray-600'}`}>
                      {card.status}
                    </span>
                  )}
                  {card.review_count > 0 && (
                    <span className="text-xs text-gray-500">{card.review_count}회독</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(card.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
              {card.category && <p className="text-blue-400 text-sm mt-1">{card.category}</p>}
              {card.source && <p className="text-gray-500 text-xs mt-1">{card.source}</p>}
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}

export default function DiagramList() {
  return (
    <Suspense>
      <DiagramListInner />
    </Suspense>
  )
}
