'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RichEditor from '../../components/RichEditor'

export default function NewCard() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [source, setSource] = useState('')
  const [fullSolution, setFullSolution] = useState('')
  const [clozeText, setClozeText] = useState('')
  const [keywords, setKeywords] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title) return alert('제목을 입력해주세요')
    setSaving(true)
    const { error } = await supabase.from('cards').insert({
      title,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      source,
      full_solution: fullSolution,
      cloze_text: clozeText,
      keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      status: '새 카드',
    })
    if (!error) router.push('/cards')
    else { alert('저장 실패: ' + error.message); setSaving(false) }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/cards" className="text-gray-400 hover:text-white text-sm">← 목록</Link>
          <h1 className="text-2xl font-bold">📚 새 카드 추가</h1>
        </div>

        <div className="space-y-4">
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="카테고리 (예: 전기자기학)" value={category} onChange={e => setCategory(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="태그 (쉼표 구분)" value={tags} onChange={e => setTags(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
            placeholder="출처" value={source} onChange={e => setSource(e.target.value)} />

          <div>
            <label className="text-sm text-gray-400 mb-1 block">📝 전체 풀이 / 증명</label>
            <RichEditor content={fullSolution} onChange={setFullSolution}
              placeholder="전체 풀이 또는 증명 입력 (LaTeX: $$ ... $$)" />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">🔲 Cloze (빈칸: 중괄호 두 개로 답 감싸기)</label>
            <RichEditor content={clozeText} onChange={setClozeText}
              placeholder="예: 테브난 등가회로의 개방전압을 Vth, 등가저항을 Rth라 한다." />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">🔑 키워드 (쉼표 구분)</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="예: 개방전압, 독립전원 제거, 등가저항"
              value={keywords} onChange={e => setKeywords(e.target.value)} />
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
