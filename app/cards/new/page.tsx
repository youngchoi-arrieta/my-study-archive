'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewCard() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    category: '',
    tags: '',
    full_solution: '',
    cloze_text: '',
    keywords: '',
    source: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('cards').insert({
      title: form.title,
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      full_solution: form.full_solution,
      cloze_text: form.cloze_text,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      source: form.source,
    })
    setSaving(false)
    if (!error) router.push('/cards')
    else alert('저장 실패: ' + error.message)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">✏️ 새 카드 추가</h1>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400">제목 *</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 테브난 정리 증명"
              value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>

          <div>
            <label className="text-sm text-gray-400">카테고리</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 덴켄3종/電力  또는  선형대수"
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
              placeholder="전체 풀이 또는 증명을 입력 (LaTeX 수식: $$ ... $$ )"
              value={form.full_solution} onChange={e => setForm({...form, full_solution: e.target.value})} />
          </div>

          <div>
            <label className="text-sm text-gray-400">🔲 Cloze 텍스트 (빈칸: {'{{답}}'} 형식)</label>
            <textarea className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white h-32"
              placeholder="예: 테브난 등가회로의 개방전압을 {{Vth}}, 등가저항을 {{Rth}}라 한다."
              value={form.cloze_text} onChange={e => setForm({...form, cloze_text: e.target.value})} />
          </div>

          <div>
            <label className="text-sm text-gray-400">🔑 키워드 (쉼표로 구분)</label>
            <input className="w-full bg-gray-800 rounded-lg p-3 mt-1 text-white"
              placeholder="예: 개방전압, 독립전원 제거, 등가저항"
              value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})} />
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