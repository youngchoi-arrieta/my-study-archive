'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { STATUS_COLORS, TOPIC_TREE, NATURE_COLORS } from '@/lib/constants'
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

function DiagramListInner() {
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') || ''
  const [cards, setCards] = useState<DiagramCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(statusFilter)
  const [selectedTopic, setSelectedTopic] = useState('')   // 대분류
  const [selectedSub, setSelectedSub] = useState('')       // 소분류
  const [selectedNature, setSelectedNature] = useState('') // 성격

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
  const activeTopic = TOPIC_TREE.find(t => t.label === selectedTopic)

  const filtered = cards.filter(card => {
    const matchSearch = search === '' ||
      card.title?.toLowerCase().includes(search.toLowerCase()) ||
      card.category?.toLowerCase().includes(search.toLowerCase()) ||
      card.source?.toLowerCase().includes(search.toLowerCase()) ||
      card.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchStatus = selectedStatus === '' || card.status === selectedStatus
    const matchTopic = selectedTopic === '' || (() => { const topic = TOPIC_TREE.find(t => t.label === selectedTopic); return topic ? (card.tags?.includes(selectedTopic) || topic.subs.some(sub => card.tags?.includes(sub))) : false })()
    const matchSub = selectedSub === '' || card.tags?.includes(selectedSub)
    const matchNature = selectedNature === '' || card.tags?.includes(selectedNature)
    return matchSearch && matchStatus && matchTopic && matchSub && matchNature
  })

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
            <h1 className="text-2xl font-bold">⚡ 전기기사 실기 오답노트</h1>
          </div>
          <Link href="/diagram/new" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition text-sm">
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
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setSelectedStatus('')}
            className={`px-3 py-1 rounded-full text-sm transition ${selectedStatus === '' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
            전체
          </button>
          {allStatuses.map(s => (
            <button key={s} onClick={() => setSelectedStatus(selectedStatus === s ? '' : s)}
              className={`px-3 py-1 rounded-full text-sm transition ${selectedStatus === s ? STATUS_COLORS[s] : 'bg-gray-700 hover:bg-gray-600'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* 대분류 필터 */}
        <div className="flex flex-wrap gap-2 mb-2">
          <button onClick={() => { setSelectedTopic(''); setSelectedSub('') }}
            className={`px-3 py-1 rounded-full text-sm transition ${selectedTopic === '' ? 'bg-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
            전체 주제
          </button>
          {TOPIC_TREE.map(t => (
            <button key={t.label}
              onClick={() => { setSelectedTopic(selectedTopic === t.label ? '' : t.label); setSelectedSub('') }}
              className={`px-3 py-1 rounded-full text-sm transition ${selectedTopic === t.label ? t.color : 'bg-gray-700 hover:bg-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 소분류 필터 (대분류 선택 시 표시) */}
        {activeTopic && (
          <div className="flex flex-wrap gap-2 mb-2 pl-2 border-l-2 border-gray-700">
            {activeTopic.subs.map(s => (
              <button key={s}
                onClick={() => setSelectedSub(selectedSub === s ? '' : s)}
                className={`px-3 py-1 rounded-full text-xs transition ${selectedSub === s ? activeTopic.color : 'bg-gray-800 hover:bg-gray-700'}`}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 성격 필터 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {['계산', '결선', '단답/용어', '도면해석', '시퀀스', 'Table spec'].map(n => (
            <button key={n}
              onClick={() => setSelectedNature(selectedNature === n ? '' : n)}
              className={`px-3 py-1 rounded-full text-xs transition ${selectedNature === n ? (NATURE_COLORS[n] || 'bg-gray-500') : 'bg-gray-800 hover:bg-gray-700'}`}>
              {n}
            </button>
          ))}
        </div>

        <p className="text-gray-500 text-sm mb-4">{filtered.length}개 카드</p>
        {loading && <p className="text-gray-400">불러오는 중...</p>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">📭</p>
            <p>{search || selectedStatus || selectedTopic ? '검색 결과가 없어요' : '아직 저장된 카드가 없어요'}</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(card => {
            const topicTags = card.tags?.filter(t => TOPIC_TREE.some(tr => tr.label === t || tr.subs.includes(t))) || []
            const natureTags = card.tags?.filter(t => ['계산', '결선', '단답/용어', '도면해석', '시퀀스', 'Table spec'].includes(t)) || []
            return (
              <Link key={card.id} href={`/diagram/${card.id}`}
                className="block bg-gray-800 hover:bg-gray-700 rounded-xl p-5 transition">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-semibold">{card.title}</h2>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {card.status && (
                      <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[card.status] || 'bg-gray-600'}`}>
                        {card.status}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {new Date(card.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
                {card.source && <p className="text-gray-500 text-xs mt-1">{card.source}</p>}
                {(topicTags.length > 0 || natureTags.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {topicTags.map(tag => {
                      const parent = TOPIC_TREE.find(tr => tr.label === tag || tr.subs.includes(tag))
                      return (
                        <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${parent?.color || 'bg-gray-700'}`}>
                          {tag}
                        </span>
                      )
                    })}
                    {natureTags.map(tag => (
                      <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${NATURE_COLORS[tag] || 'bg-gray-700'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
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
