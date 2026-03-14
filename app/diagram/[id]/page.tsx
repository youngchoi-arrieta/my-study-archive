'use client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import RichEditor from '../../components/RichEditor'

type SubQuestion = {
  id: number
  question: string
  answer: string
}

type DiagramCard = {
  id: string
  title: string
  category: string
  tags: string[]
  source: string
  card_type: string
  diagram_url: string
  table_content: string
  subquestions: SubQuestion[]
  status: string
  review_count: number
  last_reviewed: string
  my_note: string
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

// HTML 태그 제거 후 LaTeX + 일반 텍스트 파싱
function renderLatexText(html: string): React.ReactNode[] {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = plain.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim()
      try {
        return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: true, throwOnError: false }) }} />
      } catch { return <span key={i}>{part}</span> }
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim()
      try {
        return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }} />
      } catch { return <span key={i}>{part}</span> }
    }
    return <span key={i}>{part}</span>
  })
}

export default function DiagramCardDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [card, setCard] = useState<DiagramCard | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [myNote, setMyNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [formTitle, setFormTitle] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formSource, setFormSource] = useState('')
  const [formCardType, setFormCardType] = useState('도면해석')
  const [formDiagramUrl, setFormDiagramUrl] = useState('')
  const [formDiagramPreview, setFormDiagramPreview] = useState('')
  const [formTableContent, setFormTableContent] = useState('')
  const [formSubquestions, setFormSubquestions] = useState<SubQuestion[]>([])

  useEffect(() => {
    const fetchCard = async () => {
      const { data } = await supabase.from('diagram_cards').select('*').eq('id', id).single()
      setCard(data)
      setMyNote(data?.my_note || '')
      if (data) {
        setFormTitle(data.title || '')
        setFormCategory(data.category || '')
        setFormTags((data.tags || []).join(', '))
        setFormSource(data.source || '')
        setFormCardType(data.card_type || '도면해석')
        setFormDiagramUrl(data.diagram_url || '')
        setFormDiagramPreview(data.diagram_url || '')
        setFormTableContent(data.table_content || '')
        setFormSubquestions(data.subquestions || [])
      }
    }
    fetchCard()
  }, [id])

  const handleStatusChange = async (status: string) => {
    const newCount = status === '새 카드' ? 0 : (card?.review_count || 0) + 1
    const { data } = await supabase.from('diagram_cards').update({
      status,
      review_count: newCount,
      last_reviewed: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (data) setCard(data)
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    await supabase.from('diagram_cards').update({ my_note: myNote }).eq('id', id)
    setSavingNote(false)
  }

  const handleDiagramPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    const ext = file.type.split('/')[1]
    const path = `diagram-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('card-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('card-images').getPublicUrl(path)
      setFormDiagramUrl(data.publicUrl)
      setFormDiagramPreview(data.publicUrl)
    }
  }

  const handleDiagramFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `diagram-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('card-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('card-images').getPublicUrl(path)
      setFormDiagramUrl(data.publicUrl)
      setFormDiagramPreview(data.publicUrl)
    }
  }

  const handleSave = async () => {
    const { error } = await supabase.from('diagram_cards').update({
      title: formTitle,
      category: formCategory,
      tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
      source: formSource,
      card_type: formCardType,
      diagram_url: formDiagramUrl,
      table_content: formTableContent,
      subquestions: formSubquestions,
    }).eq('id', id)
    if (!error) {
      const { data } = await supabase.from('diagram_cards').select('*').eq('id', id).single()
      setCard(data)
      setEditing(false)
    } else alert('저장 실패: ' + error.message)
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제할까요?')) return
    await supabase.from('diagram_cards').delete().eq('id', id)
    router.push('/diagram')
  }

  // Cloze 렌더링 (LaTeX + 빈칸)
  const renderCloze = (html: string, qIdx: number) => {
    if (!html) return null
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    const parts = plain.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\{\{.*?\}\})/g)
    let blanks = 0
    return (
      <div className="text-sm leading-relaxed">
        {parts.map((part, i) => {
          const clozeMatch = part.match(/^\{\{(.*?)\}\}$/)
          if (clozeMatch) {
            const blankIdx = qIdx * 100 + blanks++
            const isRevealed = revealed.has(blankIdx)
            return (
              <button key={i} onClick={() => setRevealed(prev => new Set([...prev, blankIdx]))}
                className={`mx-1 px-2 py-0.5 rounded font-bold transition text-sm ${
                  isRevealed ? 'bg-green-700 text-white' : 'bg-gray-600 text-gray-600 hover:bg-gray-500 hover:text-gray-400'
                }`}>
                {isRevealed ? clozeMatch[1] : '　　'}
              </button>
            )
          }
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = part.slice(2, -2).trim()
            try {
              return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: true, throwOnError: false }) }} />
            } catch { return <span key={i}>{part}</span> }
          }
          if (part.startsWith('$') && part.endsWith('$')) {
            const math = part.slice(1, -1).trim()
            try {
              return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }} />
            } catch { return <span key={i}>{part}</span> }
          }
          return <span key={i}>{part}</span>
        })}
      </div>
    )
  }

  if (!card) return <div className="min-h-screen bg-gray-950 text-white p-8">불러오는 중...</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* 상단 바 */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/diagram" className="text-gray-400 hover:text-white text-sm shrink-0">← 목록</Link>
          <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${TYPE_COLORS[card.card_type] || 'bg-gray-700'}`}>
            {card.card_type === 'Table spec' ? '📊 Table spec' : card.card_type === '시퀀스회로도' ? '⚡ 시퀀스회로도' : '🗺️ 도면해석'}
          </span>
          <h1 className="text-lg font-bold truncate">{card.title}</h1>
          {card.category && <span className="text-blue-400 text-sm shrink-0">{card.category}</span>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setEditing(!editing)}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm transition">
            {editing ? '✕ 취소' : '✏️ 수정'}
          </button>
          <button onClick={handleDelete}
            className="bg-red-900 hover:bg-red-800 px-3 py-1 rounded-lg text-sm transition">
            🗑️
          </button>
        </div>
      </div>

      {editing ? (
        <div className="max-w-4xl mx-auto p-8 space-y-4">
          <div className="flex gap-3 flex-wrap">
            {(['도면해석', 'Table spec', '시퀀스회로도'] as const).map(t => (
              <button key={t} onClick={() => setFormCardType(t)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  formCardType === t ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {t === '도면해석' ? '🗺️ 도면해석' : t === 'Table spec' ? '📊 Table spec' : '⚡ 시퀀스회로도'}
              </button>
            ))}
          </div>
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="제목" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="카테고리" value={formCategory} onChange={e => setFormCategory(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="태그 (쉼표 구분)" value={formTags} onChange={e => setFormTags(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="출처" value={formSource} onChange={e => setFormSource(e.target.value)} />

          <div>
            <label className="text-sm text-gray-400 mb-2 block">🖼️ 메인 이미지</label>
            <div onPaste={handleDiagramPaste}
              className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 focus:outline-none focus:border-blue-500"
              tabIndex={0}>
              {formDiagramPreview ? (
                <div className="relative">
                  <img src={formDiagramPreview} alt="이미지" className="max-w-full rounded-lg" />
                  <button onClick={() => { setFormDiagramUrl(''); setFormDiagramPreview('') }}
                    className="absolute top-2 right-2 bg-red-600 px-2 py-1 rounded text-xs">✕ 삭제</button>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <p>클릭 후 Ctrl+V 붙여넣기</p>
                  <label className="mt-2 inline-block bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg cursor-pointer text-sm">
                    파일 선택
                    <input type="file" accept="image/*" className="hidden" onChange={handleDiagramFile} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {formCardType === 'Table spec' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">📝 표 내용 직접 입력 (선택)</label>
              <RichEditor content={formTableContent}
                onChange={val => setFormTableContent(val)}
                placeholder="표 내용 직접 입력 (LaTeX: $$ ... $$)" />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-gray-400">📝 소문제</label>
              <button onClick={() => setFormSubquestions([...formSubquestions, { id: Date.now(), question: '', answer: '' }])}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm">+ 소문제 추가</button>
            </div>
            <div className="space-y-4">
              {formSubquestions.map((q, i) => (
                <div key={q.id} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-400 font-semibold">({i + 1})</span>
                    <button onClick={() => setFormSubquestions(formSubquestions.filter((_, fi) => fi !== i))}
                      className="text-red-400 hover:text-red-300 text-sm">✕</button>
                  </div>
                  <label className="text-xs text-gray-500 mb-1 block">문항 (LaTeX: $$ ... $$, 빈칸: 중괄호 두 개)</label>
                  <RichEditor content={q.question}
                    onChange={val => setFormSubquestions(formSubquestions.map((fq, fi) => fi === i ? { ...fq, question: val } : fq))}
                    placeholder="소문제 내용" />
                  <label className="text-xs text-gray-500 mt-3 mb-1 block">정답 (LaTeX: $$ ... $$)</label>
                  <RichEditor content={q.answer}
                    onChange={val => setFormSubquestions(formSubquestions.map((fq, fi) => fi === i ? { ...fq, answer: val } : fq))}
                    placeholder="정답" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-lg p-3 font-semibold transition">
            💾 저장
          </button>
        </div>
      ) : (
        <>
          {/* 학습 상태 바 */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[card.status || '새 카드']}`}>
              {card.status || '새 카드'}
            </span>
            <span className="text-gray-400 text-sm">회독 {card.review_count || 0}회</span>
            {card.last_reviewed && (
              <span className="text-gray-500 text-xs">
                마지막: {new Date(card.last_reviewed).toLocaleDateString('ko-KR')}
              </span>
            )}
            <div className="flex gap-2 flex-wrap">
              {['새 카드', '오답노트', '완료'].map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1 rounded-full text-xs transition ${
                    card.status === s ? STATUS_COLORS[s] : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  {s === '새 카드' ? '🆕' : s === '오답노트' ? '❌' : '✅'} {s}
                </button>
              ))}
            </div>
          </div>

          {/* 2단 학습 뷰 */}
          <div className="flex h-[calc(100vh-130px)]">
            {/* 왼쪽: 도면/표/회로도 */}
            <div className="w-1/2 border-r border-gray-800 overflow-auto p-4">
              {card.diagram_url && (
                <img src={card.diagram_url} alt="이미지" className="w-full rounded-lg mb-4" />
              )}
              {card.card_type === 'Table spec' && card.table_content && (
                <div className="text-sm leading-relaxed">
                  {renderLatexText(card.table_content)}
                </div>
              )}
              {!card.diagram_url && !(card.card_type === 'Table spec' && card.table_content) && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>이미지가 없습니다</p>
                </div>
              )}
            </div>

            {/* 오른쪽: 소문제 */}
            <div className="w-1/2 overflow-auto p-4 space-y-4">
              {card.subquestions?.length > 0 ? (
                <>
                  <p className="text-xs text-gray-500">클릭하면 정답 공개 · 빈칸(중괄호 두 개)은 클릭으로 열기</p>
                  {card.subquestions.map((q, i) => (
                    <div key={q.id} className="bg-gray-900 rounded-xl p-4">
                      <p className="text-blue-400 font-semibold text-sm mb-2">({i + 1})</p>
                      <div className="mb-3">
                        {renderCloze(q.question, i)}
                      </div>
                      {revealed.has(i * 100 + 1000) ? (
                        <div className="bg-green-900 rounded-lg p-3 text-sm leading-relaxed">
                          {renderLatexText(q.answer)}
                        </div>
                      ) : (
                        <button onClick={() => setRevealed(prev => new Set([...prev, i * 100 + 1000]))}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">
                          정답 보기
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setRevealed(new Set())}
                    className="text-xs text-gray-400 hover:text-white underline">
                    전체 다시 숨기기
                  </button>

                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-2">📌 나의 메모</p>
                    <textarea
                      className="w-full bg-gray-800 rounded-lg p-3 text-white h-20 text-sm"
                      placeholder="틀린 포인트, 주의사항 등..."
                      value={myNote}
                      onChange={e => setMyNote(e.target.value)}
                    />
                    <button onClick={handleSaveNote} disabled={savingNote}
                      className="mt-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                      {savingNote ? '저장 중...' : '💾 메모 저장'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>소문제가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
