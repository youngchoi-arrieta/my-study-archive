'use client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import RichEditor from '../../components/RichEditor'
import { NATURE_COLORS } from '../../../lib/constants'
import { useDiagramConfig } from '../../../lib/useDiagramConfig'

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
  diagram_urls: string[]
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

function TopicSelector({ selectedTags, onChange, topicTree }: {
  selectedTags: string[]
  onChange: (tags: string[]) => void
  topicTree: { label: string; color: string; subs: string[] }[]
}) {
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const toggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag))
    } else {
      const parent = topicTree.find(t => t.subs.includes(tag))
      const toAdd = [tag]
      if (parent && !selectedTags.includes(parent.label)) toAdd.push(parent.label)
      onChange([...selectedTags, ...toAdd])
    }
  }
  return (
    <div className="space-y-2">
      {topicTree.map(topic => {
        const isExpanded = expandedTopic === topic.label
        const parentSelected = selectedTags.includes(topic.label)
        return (
          <div key={topic.label} className="rounded-xl overflow-hidden border border-gray-700">
            <div className="flex items-center gap-2 p-2 bg-gray-800">
              <button onClick={() => toggle(topic.label)}
                className={`flex-1 text-left px-3 py-1.5 rounded-lg text-sm font-semibold transition ${parentSelected ? topic.color : 'bg-gray-700 hover:bg-gray-600'}`}>
                {parentSelected ? '✓ ' : ''}{topic.label}
              </button>
              <button onClick={() => setExpandedTopic(isExpanded ? null : topic.label)}
                className="text-gray-400 hover:text-white px-2 text-sm">
                {isExpanded ? '▲' : '▼'}
              </button>
            </div>
            {isExpanded && (
              <div className="flex flex-wrap gap-2 p-3 bg-gray-900">
                {topic.subs.map(sub => (
                  <button key={sub} onClick={() => toggle(sub)}
                    className={`px-3 py-1 rounded-full text-xs transition ${selectedTags.includes(sub) ? topic.color : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {selectedTags.includes(sub) ? '✓ ' : ''}{sub}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function renderLatexText(html: string): React.ReactNode[] {
  if (!html) return []
  const imgPlaceholders: string[] = []
  const withPlaceholders = html.replace(/<img[^>]+>/g, (match) => {
    imgPlaceholders.push(match)
    return `%%IMG${imgPlaceholders.length - 1}%%`
  })
  const plain = withPlaceholders
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const normalized = plain
    .replace(/\\\\\$/g, '$')
    .replace(/\\\s*\$/g, '$')
  const parts = normalized.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|%%IMG\d+%%)/g)
  return parts.map((part, i) => {
    const imgMatch = part.match(/^%%IMG(\d+)%%$/)
    if (imgMatch) {
      const imgHtml = imgPlaceholders[parseInt(imgMatch[1])]
      return <span key={i} dangerouslySetInnerHTML={{ __html: imgHtml }} className="inline-block my-2" />
    }
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim()
      try { return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: true, throwOnError: false }) }} /> }
      catch { return <span key={i}>{part}</span> }
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim()
      try { return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }} /> }
      catch { return <span key={i}>{part}</span> }
    }
    return <span key={i}>{part}</span>
  })
}

export default function DiagramCardDetail() {
  const { id } = useParams()
  const router = useRouter()
  const { config } = useDiagramConfig()
  const { topicTree, natureTags } = config

  const [card, setCard] = useState<DiagramCard | null>(null)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [myNote, setMyNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  const [formTitle, setFormTitle] = useState('')
  const [formSelectedTags, setFormSelectedTags] = useState<string[]>([])
  const [formSelectedNatures, setFormSelectedNatures] = useState<string[]>([])
  const [formSource, setFormSource] = useState('')
  const [formCardType, setFormCardType] = useState('도면해석')
  const [formDiagramUrls, setFormDiagramUrls] = useState<string[]>([])
  const [formTableContent, setFormTableContent] = useState('')
  const [formSubquestions, setFormSubquestions] = useState<SubQuestion[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const fetchCard = async () => {
      const { data } = await supabase.from('diagram_cards').select('*').eq('id', id).single()
      setCard(data)
      setMyNote(data?.my_note || '')
      if (data) {
        setFormTitle(data.title || '')
        const existingTags: string[] = data.tags || []
        const allTopicLabels = topicTree.flatMap(t => [t.label, ...t.subs])
        setFormSelectedTags(existingTags.filter(t => allTopicLabels.includes(t)))
        setFormSelectedNatures(existingTags.filter(t => natureTags.includes(t)))
        setFormSource(data.source || '')
        setFormCardType(data.card_type || '도면해석')
        const urls = data.diagram_urls?.length ? data.diagram_urls : (data.diagram_url ? [data.diagram_url] : [])
        setFormDiagramUrls(urls)
        setFormTableContent(data.table_content || '')
        setFormSubquestions(data.subquestions || [])
      }
    }
    fetchCard()
  }, [id, topicTree, natureTags])

  const imageUrls = card?.diagram_urls?.length
    ? card.diagram_urls
    : (card?.diagram_url ? [card.diagram_url] : [])

  const handleStatusChange = async (status: string) => {
    const newCount = status === '새 카드' ? 0 : (card?.review_count || 0) + 1
    const { data } = await supabase.from('diagram_cards').update({
      status, review_count: newCount, last_reviewed: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (data) setCard(data)
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    await supabase.from('diagram_cards').update({ my_note: myNote }).eq('id', id)
    setSavingNote(false)
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.type.split('/')[1]
    const path = `diagram-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('card-images').upload(path, file)
    if (error) return null
    const { data } = supabase.storage.from('card-images').getPublicUrl(path)
    return data.publicUrl
  }

  const handleDiagramPaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image'))
    if (!imageItem) return
    const file = imageItem.getAsFile()
    if (!file) return
    setUploading(true)
    const url = await uploadImage(file)
    if (url) setFormDiagramUrls(prev => [...prev, url])
    setUploading(false)
  }

  const handleDiagramFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const url = await uploadImage(file)
      if (url) setFormDiagramUrls(prev => [...prev, url])
    }
    setUploading(false)
  }

  const handleSave = async () => {
    const allTags = [...formSelectedTags, ...formSelectedNatures]
    const { error } = await supabase.from('diagram_cards').update({
      title: formTitle,
      category: formSelectedTags[0] || '',
      tags: allTags,
      source: formSource,
      card_type: formSelectedNatures[0] || formCardType,
      diagram_url: formDiagramUrls[0] || '',
      diagram_urls: formDiagramUrls,
      table_content: formTableContent,
      subquestions: formSubquestions,
    }).eq('id', id)
    if (!error) {
      const { data } = await supabase.from('diagram_cards').select('*').eq('id', id).single()
      setCard(data)
      setEditing(false)
      setCurrentPage(0)
    } else alert('저장 실패: ' + error.message)
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제할까요?')) return
    await supabase.from('diagram_cards').delete().eq('id', id)
    router.push('/diagram')
  }

  const renderCloze = (html: string, qIdx: number) => {
    if (!html) return null
    const renderHtmlWithLatex = (rawHtml: string) => {
      const imgs: string[] = []
      const withPlaceholders = rawHtml.replace(/<img[^>]+>/g, m => { imgs.push(m); return `%%IMG${imgs.length - 1}%%` })
      const plain = withPlaceholders
        .replace(/<\/?(p|br|li|div|ol|ul)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
        .replace(/\\\\/g, '\\').replace(/\\\$/g, '$')
        .replace(/[ \t]+/g, ' ').trim()
      const parts = plain.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|%%IMG\d+%%)/g)
      return parts.map((part, i) => {
        const imgMatch = part.match(/^%%IMG(\d+)%%$/)
        if (imgMatch) return <span key={i} className="inline-block my-2" dangerouslySetInnerHTML={{ __html: imgs[parseInt(imgMatch[1])] }} />
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim()
          try { return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: true, throwOnError: false }) }} /> }
          catch { return <span key={i}>{part}</span> }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim()
          try { return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }} /> }
          catch { return <span key={i}>{part}</span> }
        }
        return <span key={i}>{part}</span>
      })
    }
    if (!html.includes('{{')) {
      return <div className="text-sm leading-relaxed whitespace-pre-wrap">{renderHtmlWithLatex(html)}</div>
    }
    const plain = html
      .replace(/<\/?(p|br|li|div|ol|ul)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
      .replace(/\\\\/g, '\\').replace(/\\\$/g, '$')
      .replace(/[ \t]+/g, ' ').trim()
    const parts = plain.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\{\{.*?\}\})/g)
    let blanks = 0
    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          const clozeMatch = part.match(/^\{\{(.*?)\}\}$/)
          if (clozeMatch) {
            const blankIdx = qIdx * 100 + blanks++
            const isRevealed = revealed.has(blankIdx)
            return (
              <button key={i} onClick={() => setRevealed(prev => new Set([...prev, blankIdx]))}
                className={`mx-1 px-2 py-0.5 rounded font-bold transition text-sm ${isRevealed ? 'bg-green-700 text-white' : 'bg-gray-600 text-gray-600 hover:bg-gray-500 hover:text-gray-400'}`}>
                {isRevealed ? clozeMatch[1] : '　　'}
              </button>
            )
          }
          if (part.startsWith('$$') && part.endsWith('$$')) {
            try { return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(2,-2).trim(), { displayMode: true, throwOnError: false }) }} /> }
            catch { return <span key={i}>{part}</span> }
          }
          if (part.startsWith('$') && part.endsWith('$')) {
            try { return <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1,-1).trim(), { displayMode: false, throwOnError: false }) }} /> }
            catch { return <span key={i}>{part}</span> }
          }
          return <span key={i}>{part}</span>
        })}
      </div>
    )
  }

  if (!card) return <div className="min-h-screen bg-gray-950 text-white p-8">불러오는 중...</div>

  return (
    <main className="bg-gray-950 text-white flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* 상단 바 */}
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href="/diagram" className="text-gray-400 hover:text-white text-sm shrink-0">← 목록</Link>
          <h1 className="text-lg font-bold truncate">{card.title}</h1>
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
        <div className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-8 space-y-4">
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="제목" value={formTitle} onChange={e => setFormTitle(e.target.value)} />

            <div>
              <label className="text-sm text-gray-400 mb-2 block">📚 주제 분류 <span className="text-gray-600">(▼ 눌러 소분류 선택)</span></label>
              <TopicSelector selectedTags={formSelectedTags} onChange={setFormSelectedTags} topicTree={topicTree} />
            </div>
            {formSelectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formSelectedTags.map(tag => {
                  const parent = topicTree.find(t => t.label === tag || t.subs.includes(tag))
                  return (
                    <span key={tag} className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${parent?.color || 'bg-gray-600'}`}>
                      {tag}
                      <button onClick={() => setFormSelectedTags(prev => prev.filter(t => t !== tag))} className="opacity-70 hover:opacity-100">✕</button>
                    </span>
                  )
                })}
              </div>
            )}

            <div>
              <label className="text-sm text-gray-400 mb-2 block">🏷️ 문제 성격</label>
              <div className="flex flex-wrap gap-2">
                {natureTags.map(n => (
                  <button key={n}
                    onClick={() => setFormSelectedNatures(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${formSelectedNatures.includes(n) ? (NATURE_COLORS[n] || 'bg-gray-500') : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {formSelectedNatures.includes(n) ? '✓ ' : ''}{n}
                  </button>
                ))}
              </div>
            </div>

            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="출처" value={formSource} onChange={e => setFormSource(e.target.value)} />

            <div>
              <label className="text-sm text-gray-400 mb-2 block">🖼️ 이미지 ({formDiagramUrls.length}장)</label>
              {formDiagramUrls.length > 0 && (
                <div className="space-y-2 mb-3">
                  {formDiagramUrls.map((url, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-lg p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">페이지 {idx + 1}</span>
                        <button onClick={() => setFormDiagramUrls(prev => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-red-400 hover:text-red-300">✕ 삭제</button>
                        {idx > 0 && (
                          <button onClick={() => {
                            const newUrls = [...formDiagramUrls]
                            ;[newUrls[idx - 1], newUrls[idx]] = [newUrls[idx], newUrls[idx - 1]]
                            setFormDiagramUrls(newUrls)
                          }} className="text-xs text-gray-400 hover:text-white">↑ 위로</button>
                        )}
                      </div>
                      <img src={url} alt={`페이지 ${idx + 1}`} className="max-w-full rounded max-h-32 object-contain" />
                    </div>
                  ))}
                </div>
              )}
              <div onPaste={handleDiagramPaste}
                className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-4 focus:outline-none focus:border-blue-500 text-center"
                tabIndex={0}>
                {uploading ? (
                  <p className="text-gray-400 py-2">업로드 중...</p>
                ) : (
                  <div className="text-gray-500 py-2">
                    <p>클릭 후 Ctrl+V 붙여넣기 (페이지 추가)</p>
                    <label className="mt-2 inline-block bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg cursor-pointer text-sm">
                      파일 선택 (여러 장 가능)
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiagramFile} />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {(formSelectedNatures.includes('Table spec') || formCardType === 'Table spec') && (
              <div>
                <label className="text-sm text-gray-400 mb-2 block">📝 표 내용 직접 입력 (선택)</label>
                <RichEditor key={`table-${card.id}`} content={formTableContent} onChange={val => setFormTableContent(val)}
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
                    <RichEditor key={`q-${card.id}-${q.id}`} content={q.question}
                      onChange={val => setFormSubquestions(formSubquestions.map((fq, fi) => fi === i ? { ...fq, question: val } : fq))}
                      placeholder="소문제 내용" />
                    <label className="text-xs text-gray-500 mt-3 mb-1 block">정답</label>
                    <RichEditor key={`a-${card.id}-${q.id}`} content={q.answer}
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
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 flex-wrap shrink-0">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[card.status || '새 카드']}`}>
              {card.status || '새 카드'}
            </span>
            <span className="text-gray-400 text-sm">회독 {card.review_count || 0}회</span>
            {card.last_reviewed && (
              <span className="text-gray-500 text-xs">마지막: {new Date(card.last_reviewed).toLocaleDateString('ko-KR')}</span>
            )}
            <div className="flex gap-2 flex-wrap">
              {['새 카드', '오답노트', '완료'].map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1 rounded-full text-xs transition ${card.status === s ? STATUS_COLORS[s] : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {s === '새 카드' ? '🆕' : s === '오답노트' ? '❌' : '✅'} {s}
                </button>
              ))}
            </div>
          </div>

          {card.tags?.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-800 flex flex-wrap gap-1.5 shrink-0">
              {(() => {
                const parentLabels = topicTree.map(tr => tr.label)
                const subTags = card.tags.filter(t => topicTree.some(tr => tr.subs.includes(t)))
                const parentTags = card.tags.filter(t => parentLabels.includes(t))
                const cardNatureTags = card.tags.filter(t => natureTags.includes(t))
                return (
                  <>
                    {subTags.map(tag => {
                      const parent = topicTree.find(tr => tr.subs.includes(tag))
                      return (
                        <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${parent?.color || 'bg-gray-700'}`}>
                          <span className="opacity-60">{parent?.label} / </span>{tag}
                        </span>
                      )
                    })}
                    {parentTags
                      .filter(p => !subTags.some(s => topicTree.find(tr => tr.label === p)?.subs.includes(s)))
                      .map(tag => {
                        const parent = topicTree.find(tr => tr.label === tag)
                        return (
                          <span key={tag} className={`text-xs px-2 py-0.5 rounded-full opacity-60 ${parent?.color || 'bg-gray-700'}`}>
                            {tag}
                          </span>
                        )
                      })}
                    {cardNatureTags.map(tag => (
                      <span key={tag} className={`text-xs px-2 py-0.5 rounded-full ${NATURE_COLORS[tag] || 'bg-gray-600'}`}>
                        {tag}
                      </span>
                    ))}
                  </>
                )
              })()}
            </div>
          )}

          <div className="flex flex-1 overflow-hidden min-h-0">
            <div className="w-1/2 border-r border-gray-800 overflow-auto flex flex-col min-h-0">
              {imageUrls.length > 0 ? (
                <>
                  {imageUrls.length > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
                      <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm disabled:opacity-30 transition">← 이전</button>
                      <span className="text-sm text-gray-400">{currentPage + 1} / {imageUrls.length}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(imageUrls.length - 1, p + 1))} disabled={currentPage === imageUrls.length - 1}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm disabled:opacity-30 transition">다음 →</button>
                    </div>
                  )}
                  <div className="overflow-auto p-4 flex-1">
                    <img src={imageUrls[currentPage]} alt={`페이지 ${currentPage + 1}`} className="w-full rounded-lg" />
                  </div>
                </>
              ) : card.card_type === 'Table spec' && card.table_content ? (
                <div className="p-4 text-sm leading-relaxed overflow-auto">{renderLatexText(card.table_content)}</div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500"><p>이미지가 없습니다</p></div>
              )}
            </div>

            <div className="w-1/2 overflow-auto p-4 space-y-4 min-h-0">
              {card.subquestions?.length > 0 ? (
                <>
                  <p className="text-xs text-gray-500">클릭하면 정답 공개 · 빈칸(중괄호 두 개)은 클릭으로 열기</p>
                  {card.subquestions.map((q, i) => (
                    <div key={q.id} className="bg-gray-900 rounded-xl p-4">
                      <p className="text-blue-400 font-semibold text-sm mb-2">({i + 1})</p>
                      <div className="mb-3">{renderCloze(q.question, i)}</div>
                      {revealed.has(i * 100 + 1000) ? (
                        <div>
                          <div className="bg-green-900 rounded-lg p-3 text-sm leading-relaxed mb-2">
                            {renderCloze(q.answer, i + 1000)}
                          </div>
                          <button onClick={() => setRevealed(prev => { const next = new Set(prev); next.delete(i * 100 + 1000); return next })}
                            className="text-xs text-gray-400 hover:text-white underline">숨기기</button>
                        </div>
                      ) : (
                        <button onClick={() => setRevealed(prev => new Set([...prev, i * 100 + 1000]))}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">정답 보기</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setRevealed(new Set())} className="text-xs text-gray-400 hover:text-white underline">전체 다시 숨기기</button>
                  <div className="bg-gray-900 rounded-xl p-4">
                    <p className="text-sm text-gray-400 mb-2">📌 나의 메모</p>
                    <textarea className="w-full bg-gray-800 rounded-lg p-3 text-white h-20 text-sm"
                      placeholder="틀린 포인트, 주의사항 등..." value={myNote} onChange={e => setMyNote(e.target.value)} />
                    <button onClick={handleSaveNote} disabled={savingNote}
                      className="mt-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                      {savingNote ? '저장 중...' : '💾 메모 저장'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500"><p>소문제가 없습니다</p></div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  )
}
