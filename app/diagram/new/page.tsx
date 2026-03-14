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
  const [diagramUrl, setDiagramUrl] = useState('')
  const [diagramPreview, setDiagramPreview] = useState('')
  const [tableContent, setTableContent] = useState('')
  const [subquestions, setSubquestions] = useState<SubQuestion[]>([
    { id: 1, question: '', answer: '' }
  ])
  const [saving, setSaving] = useState(false)

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
      setDiagramUrl(data.publicUrl)
      setDiagramPreview(data.publicUrl)
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
      setDiagramUrl(data.publicUrl)
      setDiagramPreview(data.publicUrl)
    }
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
      diagram_url: diagramUrl,
      table_content: tableContent,
      subquestions,
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
          {/* 카드 타입 선택 */}
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
            placeholder="제목" value={title}
            onChange={e => setTitle(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="카테고리 (예: 전력공학)" value={category}
            onChange={e => setCategory(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="태그 (쉼표 구분)" value={tags}
            onChange={e => setTags(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="출처 (예: 2023년 1회 기사 실기 29번)" value={source}
            onChange={e => setSource(e.target.value)} />

          {/* 이미지 입력 (공통) */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              {cardType === 'Table spec' ? '📊 표 이미지' : cardType === '시퀀스회로도' ? '⚡ 회로도 이미지' : '🖼️ 도면 이미지'}
            </label>
            <div
              onPaste={handleDiagramPaste}
              className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6 text-center focus:outline-none focus:border-blue-500"
              tabIndex={0}
            >
              {diagramPreview ? (
                <div className="relative">
                  <img src={diagramPreview} alt="이미지" className="max-w-full rounded-lg mx-auto" />
                  <button onClick={() => { setDiagramUrl(''); setDiagramPreview('') }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 px-2 py-1 rounded text-xs">
                    ✕ 삭제
                  </button>
                </div>
              ) : (
                <div className="text-gray-500">
                  <p className="text-4xl mb-2">📋</p>
                  <p>여기 클릭 후 Ctrl+V로 붙여넣기</p>
                  <p className="text-sm mt-1">또는</p>
                  <label className="mt-2 inline-block bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg cursor-pointer text-sm">
                    파일 선택
                    <input type="file" accept="image/*" className="hidden" onChange={handleDiagramFile} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* 표 텍스트 입력 (Table spec만) */}
          {cardType === 'Table spec' && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">📝 표 내용 직접 입력 (선택)</label>
              <RichEditor
                content={tableContent}
                onChange={val => setTableContent(val)}
                placeholder="표 내용 직접 입력 (사양, 조건, 계통도 등)"
              />
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
                        className="text-red-400 hover:text-red-300 text-sm">
                        ✕ 삭제
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500">문항</label>
                    <RichEditor
                      content={q.question}
                      onChange={val => updateSubQuestion(q.id, 'question', val)}
                      placeholder="소문제 내용 입력 (빈칸: 중괄호 두 개로 답 감싸기)"
                    />
                    <label className="text-xs text-gray-500 mt-2 block">정답</label>
                    <RichEditor
                      content={q.answer}
                      onChange={val => updateSubQuestion(q.id, 'answer', val)}
                      placeholder="정답 입력"
                    />
                  </div>
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
