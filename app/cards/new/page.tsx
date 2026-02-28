'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewCard() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '', category: '', tags: '', full_solution: '',
    cloze_text: '', keywords: '', source: '',
  })
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setImages(prev => [...prev, ...files])
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter(item => item.type.startsWith('image'))
      .map(item => item.getAsFile())
      .filter(Boolean) as File[]
    if (files.length > 0) {
      setImages(prev => [...prev, ...files])
      setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const imageUrls: string[] = []
    for (const file of images) {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('card-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('card-images').getPublicUrl(path)
        imageUrls.push(data.publicUrl)
      }
    }
    const { error } = await supabase.from('cards').insert({
      title: form.title,
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      full_solution: form.full_solution,
      cloze_text: form.cloze_text,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      source: form.source,
      image_urls: imageUrls,
    })
    setSaving(false)
    if (!error) router.push('/cards')
    else alert('저장 실패: ' + error.message)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">✏️ 새 카드 추가</h1>
        <div className="space-y-4" onPaste={handlePaste}>
          <div>
            <label className="text-sm text-gray-400">제목 *</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 테브난 정리 증명"
              value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-400">카테고리</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 덴켄3종/電力 또는 선형대수"
              value={form.category} onChange={e => setForm({...form, category: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-400">태그 (쉼표로 구분)</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 테브난, 등가회로, 임피던스"
              value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-400">출처</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 덴켄3종 2023년 전력 문제3"
              value={form.source} onChange={e => setForm({...form, source: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-400">📝 전체 풀이 / 증명</label>
            <textarea className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white h-40"
              placeholder="전체 풀이 또는 증명을 입력 (LaTeX 수식: $$ ... $$)"
              value={form.full_solution} onChange={e => setForm({...form, full_solution: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-400">🔲 Cloze 텍스트 (빈칸 형식: 중괄호 두 개로 답 감싸기)</label>
            <textarea className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white h-32"
              placeholder="예: 테브난 등가회로의 개방전압을 Vth, 등가저항을 Rth라 한다."
              value={form.cloze_text} onChange={e => setForm({...form, cloze_text: e.target.value})} />
          </div>
          <div>
            <label className="text-sm text-gray-400">🔑 키워드 (쉼표로 구분)</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 개방전압, 독립전원 제거, 등가저항"
              value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})} />
          </div>

          {/* 이미지 업로드 */}
          <div>
            <label className="text-sm text-gray-400">🖼️ 손 노트 사진</label>
            <div className="w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6 mt-1 text-center">
              <p className="text-gray-300 text-sm font-semibold">페이지 어디서나 Ctrl+V 로 붙여넣기 가능</p>
              <p className="text-gray-500 text-xs mt-1 mb-3">또는 파일 직접 선택</p>
              <input type="file" accept="image/*" multiple
                className="text-sm text-gray-400"
                onChange={handleImageChange} />
            </div>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="h-40 rounded-lg object-cover border border-gray-600" />
                    <button onClick={() => {
                      setImages(prev => prev.filter((_, idx) => idx !== i))
                      setPreviews(prev => prev.filter((_, idx) => idx !== i))
                    }} className="absolute top-1 right-1 bg-red-700 hover:bg-red-600 rounded-full w-6 h-6 text-xs flex items-center justify-center">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || !form.title}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded-lg p-4 font-semibold text-lg transition">
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      </div>
    </main>
  )
}