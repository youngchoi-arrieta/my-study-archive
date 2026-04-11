'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RichEditor from '../../components/RichEditor'
import { NATURE_COLORS } from '../../../lib/constants'
import { useDiagramConfig } from '../../../lib/useDiagramConfig'

type SubQuestion = {
  id: number
  question: string
  answer: string
}

function TopicSelector({
  selectedTags,
  onChange,
  topicTree,
}: {
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

export default function NewDiagramCard() {
  const router = useRouter()
  const { config } = useDiagramConfig()
  const { topicTree, natureTags } = config

  const [title, setTitle] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedNatures, setSelectedNatures] = useState<string[]>([])
  const [source, setSource] = useState('')
  const [diagramUrls, setDiagramUrls] = useState<string[]>([])
  const [tableContent, setTableContent] = useState('')
  const [subquestions, setSubquestions] = useState<SubQuestion[]>([{ id: 1, question: '', answer: '' }])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const toggleNature = (n: string) => {
    setSelectedNatures(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
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
    if (url) setDiagramUrls(prev => [...prev, url])
    setUploading(false)
  }

  const handleDiagramFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const url = await uploadImage(file)
      if (url) setDiagramUrls(prev => [...prev, url])
    }
    setUploading(false)
  }

  const removeImage = (idx: number) => setDiagramUrls(prev => prev.filter((_, i) => i !== idx))
  const addSubQuestion = () => setSubquestions([...subquestions, { id: subquestions.length + 1, question: '', answer: '' }])
  const removeSubQuestion = (id: number) => setSubquestions(subquestions.filter(q => q.id !== id))
  const updateSubQuestion = (id: number, field: 'question' | 'answer', value: string) => {
    setSubquestions(subquestions.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  const handleSave = async () => {
    if (!title) return alert('제목을 입력해주세요')
    setSaving(true)
    const allTags = [...selectedTags, ...selectedNatures]
    const { error } = await supabase.from('diagram_cards').insert({
      title,
      category: selectedTags[0] || '',
      tags: allTags,
      source,
      card_type: selectedNatures[0] || '도면해석',
      diagram_url: diagramUrls[0] || '',
      diagram_urls: diagramUrls,
      table_content: tableContent,
      subquestions,
      status: '새 카드',
    })
    if (!error) router.push('/diagram')
    else { alert('저장 실패: ' + error.message); setSaving(false) }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/diagram" className="text-gray-400 hover:text-white text-sm">← 목록</Link>
          <h1 className="text-2xl font-bold">⚡ 새 카드 추가</h1>
        </div>

        <div className="space-y-5">
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} />

          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              📚 주제 분류 <span className="text-gray-600">(복수 선택 가능 — 대분류 클릭 또는 ▼ 눌러 소분류 선택)</span>
            </label>
            <TopicSelector selectedTags={selectedTags} onChange={setSelectedTags} topicTree={topicTree} />
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map(tag => {
                const parent = topicTree.find(t => t.label === tag || t.subs.includes(tag))
                return (
                  <span key={tag} className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${parent?.color || 'bg-gray-600'}`}>
                    {tag}
                    <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} className="opacity-70 hover:opacity-100">✕</button>
                  </span>
                )
              })}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-400 mb-2 block">🏷️ 문제 성격 <span className="text-gray-600">(복수 선택)</span></label>
            <div className="flex flex-wrap gap-2">
              {natureTags.map(n => (
                <button key={n} onClick={() => toggleNature(n)}
                  className={`px-3 py-1.5 rounded-full text-sm transition ${selectedNatures.includes(n) ? (NATURE_COLORS[n] || 'bg-gray-500') : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {selectedNatures.includes(n) ? '✓ ' : ''}{n}
                </button>
              ))}
            </div>
          </div>

          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="출처 (예: 2023년 1회 기사 실기 29번)" value={source} onChange={e => setSource(e.target.value)} />

          <div>
            <label className="text-sm text-gray-400 mb-2 block">🖼️ 이미지 ({diagramUrls.length}장) — 여러 장 추가 가능</label>
            {diagramUrls.length > 0 && (
              <div className="space-y-3 mb-3">
                {diagramUrls.map((url, idx) => (
                  <div key={idx} className="relative bg-gray-800 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">페이지 {idx + 1}</span>
                      <button onClick={() => removeImage(idx)} className="text-xs text-red-400 hover:text-red-300">✕ 삭제</button>
                      {idx > 0 && (
                        <button onClick={() => {
                          const newUrls = [...diagramUrls]
                          ;[newUrls[idx - 1], newUrls[idx]] = [newUrls[idx], newUrls[idx - 1]]
                          setDiagramUrls(newUrls)
                        }} className="text-xs text-gray-400 hover:text-white">↑ 위로</button>
                      )}
                    </div>
                    <img src={url} alt={`페이지 ${idx + 1}`} className="max-w-full rounded-lg max-h-48 object-contain" />
                  </div>
                ))}
              </div>
            )}
            <div onPaste={handleDiagramPaste}
              className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6 text-center focus:outline-none focus:border-blue-500"
              tabIndex={0}>
              {uploading ? (
                <p className="text-gray-400">업로드 중...</p>
              ) : (
                <div className="text-gray-500">
                  <p className="text-3xl mb-2">📋</p>
                  <p>클릭 후 Ctrl+V로 이미지 붙여넣기</p>
                  <label className="mt-2 inline-block bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg cursor-pointer text-sm">
                    파일 선택 (여러 장 가능)
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiagramFile} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {selectedNatures.includes('Table spec') && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">📝 표 내용 직접 입력 (선택)</label>
              <RichEditor content={tableContent} onChange={val => setTableContent(val)}
                placeholder="표 내용 직접 입력 (LaTeX: $$ ... $$)" />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-gray-400">📝 소문제</label>
              <button onClick={addSubQuestion} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm">+ 소문제 추가</button>
            </div>
            <div className="space-y-6">
              {subquestions.map((q, i) => (
                <div key={q.id} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-blue-400 font-semibold">({i + 1})</span>
                    {subquestions.length > 1 && (
                      <button onClick={() => removeSubQuestion(q.id)} className="text-red-400 hover:text-red-300 text-sm">✕ 삭제</button>
                    )}
                  </div>
                  <label className="text-xs text-gray-500 mb-1 block">문항 (LaTeX: $$ ... $$, 빈칸: 중괄호 두 개)</label>
                  <RichEditor content={q.question} onChange={val => updateSubQuestion(q.id, 'question', val)} placeholder="소문제 내용" />
                  <label className="text-xs text-gray-500 mt-3 mb-1 block">정답</label>
                  <RichEditor content={q.answer} onChange={val => updateSubQuestion(q.id, 'answer', val)} placeholder="정답" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-lg p-3 font-semibold transition disabled:opacity-50">
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      </div>
    </main>
  )
}
