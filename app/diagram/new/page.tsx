'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RichEditor from '../../components/RichEditor'

type SubQuestion = {
  id: number
  question: string
  answer: string
}

export default function NewDiagramCard() {
  const router = useRouter()
  const [cardType, setCardType] = useState<'도면해석' | 'Table spec' | '시퀀스회로도'>('도면해석')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [source, setSource] = useState('')
  const [diagramUrls, setDiagramUrls] = useState<string[]>([])
  const [tableContent, setTableContent] = useState('')
  const [subquestions, setSubquestions] = useState<SubQuestion[]>([
    { id: 1, question: '', answer: '' }
  ])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

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

  const removeImage = (idx: number) => {
    setDiagramUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const addSubQuestion = () => {
    setSubquestions([...subquestions, { id: subquestions.length + 1, question: '', answer: '' }])
  }

  const removeSubQuestion = (id: number) => {
    setSubquestions(subquestions.filter(q => q.id !== id))
  }

  const updateSubQuestion = (id: number, field: 'question' | 'answer', value: string) => {
    setSubquestions(subquestions.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  const handleSave = async () => {
    if (!title) return alert('제목을 입력해주세요')
    setSaving(true)
    const { error } = await supabase.from('diagram_cards').insert({
      title,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      source,
      card_type: cardType,
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
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/diagram" className="text-gray-400 hover:text-white text-sm">← 목록</Link>
          <h1 className="text-2xl font-bold">🗺️ 새 카드 추가</h1>
        </div>

        <div className="space-y-4">
          {/* 카드 타입 */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">카드 타입</label>
            <div className="flex gap-3 flex-wrap">
              {(['도면해석', 'Table spec', '시퀀스회로도'] as const).map(t => (
                <button key={t} onClick={() => setCardType(t)}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    cardType === t ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                  }`}>
                  {t === '도면해석' ? '🗺️ 도면해석' : t === 'Table spec' ? '📊 Table spec' : '⚡ 시퀀스회로도'}
                </button>
              ))}
            </div>
          </div>

          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="카테고리 (예: 전력공학)" value={category} onChange={e => setCategory(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="태그 (쉼표 구분)" value={tags} onChange={e => setTags(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="출처 (예: 2023년 1회 기사 실기 29번)" value={source} onChange={e => setSource(e.target.value)} />

          {/* 이미지 업로드 - 다중 지원 */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              🖼️ 이미지 ({diagramUrls.length}장) — 여러 장 추가 가능
            </label>

            {/* 업로드된 이미지 목록 */}
            {diagramUrls.length > 0 && (
              <div className="space-y-3 mb-3">
                {diagramUrls.map((url, idx) => (
                  <div key={idx} className="relative bg-gray-800 rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">페이지 {idx + 1}</span>
                      <button onClick={() => removeImage(idx)}
                        className="text-xs text-red-400 hover:text-red-300">✕ 삭제</button>
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

            {/* 붙여넣기 / 파일 선택 */}
            <div
              onPaste={handleDiagramPaste}
              className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6 text-center focus:outline-none focus:border-blue-500"
              tabIndex={0}
            >
              {uploading ? (
                <p className="text-gray-400">업로드 중...</p>
              ) : (
                <div className="text-gray-500">
                  <p className="text-3xl mb-2">📋</p>
                  <p>클릭 후 Ctrl+V로 이미지 붙여넣기</p>
                  <p className="text-sm text-gray-600 mt-1">또는</p>
                  <label className="mt-2 inline-block bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg cursor-pointer text-sm">
                    파일 선택 (여러 장 가능)
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleDiagramFile} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* 표 텍스트 (Table spec) */}
          {cardType === 'Table spec' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">📝 표 내용 직접 입력 (선택)</label>
              <RichEditor content={tableContent} onChange={val => setTableContent(val)}
                placeholder="표 내용 직접 입력 (LaTeX: $$ ... $$)" />
            </div>
          )}

          {/* 소문제 */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-gray-400">📝 소문제</label>
              <button onClick={addSubQuestion}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm">
                + 소문제 추가
              </button>
            </div>
            <div className="space-y-6">
              {subquestions.map((q, i) => (
                <div key={q.id} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-blue-400 font-semibold">({i + 1})</span>
                    {subquestions.length > 1 && (
                      <button onClick={() => removeSubQuestion(q.id)}
                        className="text-red-400 hover:text-red-300 text-sm">✕ 삭제</button>
                    )}
                  </div>
                  <label className="text-xs text-gray-500 mb-1 block">문항 (LaTeX: $$ ... $$, 빈칸: 중괄호 두 개)</label>
                  <RichEditor content={q.question}
                    onChange={val => updateSubQuestion(q.id, 'question', val)}
                    placeholder="소문제 내용" />
                  <label className="text-xs text-gray-500 mt-3 mb-1 block">정답</label>
                  <RichEditor content={q.answer}
                    onChange={val => updateSubQuestion(q.id, 'answer', val)}
                    placeholder="정답" />
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
