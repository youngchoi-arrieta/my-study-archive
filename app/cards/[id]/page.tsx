'use client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type FlowStep = {
  step: number
  prompt: string
  answer: string
}

type Card = {
  id: string
  title: string
  category: string
  tags: string[]
  source: string
  full_solution: string
  cloze_text: string
  keywords: string[]
  flow_steps: FlowStep[]
  created_at: string
}

type Mode = 'full' | 'cloze' | 'keyword' | 'flow'

export default function CardDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [card, setCard] = useState<Card | null>(null)
  const [mode, setMode] = useState<Mode>('full')
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    title: '', category: '', tags: '', source: '',
    full_solution: '', cloze_text: '', keywords: '', flow_steps: '[]'
  })
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([])
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('cards').select('*').eq('id', id).single()
      setCard(data)
      if (data) {
        setForm({
          title: data.title || '',
          category: data.category || '',
          tags: (data.tags || []).join(', '),
          source: data.source || '',
          full_solution: data.full_solution || '',
          cloze_text: data.cloze_text || '',
          keywords: (data.keywords || []).join(', '),
          flow_steps: JSON.stringify(data.flow_steps || [], null, 2)
        })
        setFlowSteps(data.flow_steps || [])
      }
    }
    fetch()
  }, [id])

  const handleSave = async () => {
    let parsedFlow = []
    try { parsedFlow = JSON.parse(form.flow_steps) } catch { parsedFlow = [] }
    const { error } = await supabase.from('cards').update({
      title: form.title,
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      source: form.source,
      full_solution: form.full_solution,
      cloze_text: form.cloze_text,
      keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean),
      flow_steps: parsedFlow,
    }).eq('id', id)
    if (!error) {
      const { data } = await supabase.from('cards').select('*').eq('id', id).single()
      setCard(data)
      setFlowSteps(data.flow_steps || [])
      setEditing(false)
    } else alert('저장 실패: ' + error.message)
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제할까요?')) return
    await supabase.from('cards').delete().eq('id', id)
    router.push('/cards')
  }

  const renderLatex = (text: string) => {
    if (!text) return ''
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g)
    return parts.map(part => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2)
        try { return katex.renderToString(math, { displayMode: true }) }
        catch { return part }
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1)
        try { return katex.renderToString(math, { displayMode: false }) }
        catch { return part }
      }
      return part
    }).join('')
  }

  const renderCloze = () => {
    if (!card?.cloze_text) return <p className="text-gray-400">Cloze 텍스트가 없습니다.</p>
    const parts = card.cloze_text.split(/(\{\{.*?\}\})/g)
    let idx = 0
    return (
      <p className="text-lg leading-relaxed">
        {parts.map((part, i) => {
          const match = part.match(/^\{\{(.*?)\}\}$/)
          if (match) {
            const answerIdx = idx++
            const isRevealed = revealed.has(answerIdx)
            return (
              <button key={i} onClick={() => setRevealed(prev => new Set([...prev, answerIdx]))}
                className={`mx-1 px-3 py-1 rounded font-bold transition ${
                  isRevealed ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-700 hover:bg-gray-600 hover:text-gray-400'
                }`}>
                {isRevealed ? match[1] : '　　　'}
              </button>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </p>
    )
  }

  // Flow 모드에서 스텝 추가/삭제 (수정 폼용)
  const addFlowStep = () => {
    try {
      const steps = JSON.parse(form.flow_steps)
      steps.push({ step: steps.length + 1, prompt: '', answer: '' })
      setForm({ ...form, flow_steps: JSON.stringify(steps, null, 2) })
    } catch {}
  }

  if (!card) return <div className="min-h-screen bg-gray-950 text-white p-8">불러오는 중...</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto">

        <div className="flex justify-between items-center mb-2">
          <Link href="/cards" className="text-gray-400 hover:text-white">← 목록</Link>
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm transition">
              {editing ? '✕ 취소' : '✏️ 수정'}
            </button>
            <button onClick={handleDelete}
              className="bg-red-900 hover:bg-red-800 px-3 py-1 rounded-lg text-sm transition">
              🗑️ 삭제
            </button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3 mt-4">
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="제목" value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} />
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="카테고리" value={form.category}
              onChange={e => setForm({...form, category: e.target.value})} />
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="태그 (쉼표 구분)" value={form.tags}
              onChange={e => setForm({...form, tags: e.target.value})} />
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="출처" value={form.source}
              onChange={e => setForm({...form, source: e.target.value})} />
            <textarea className="w-full bg-gray-800 rounded-lg p-3 text-white h-40"
              placeholder="전체 풀이 / 증명" value={form.full_solution}
              onChange={e => setForm({...form, full_solution: e.target.value})} />
            <textarea className="w-full bg-gray-800 rounded-lg p-3 text-white h-24"
              placeholder="Cloze 텍스트 (빈칸: {{답}})" value={form.cloze_text}
              onChange={e => setForm({...form, cloze_text: e.target.value})} />
            <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
              placeholder="키워드 (쉼표 구분)" value={form.keywords}
              onChange={e => setForm({...form, keywords: e.target.value})} />

            {/* Flow 스텝 편집 */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm text-gray-400">🔀 Flow 스텝</p>
                <button onClick={addFlowStep}
                  className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg">
                  + 스텝 추가
                </button>
              </div>
              {(() => {
                let steps: FlowStep[] = []
                try { steps = JSON.parse(form.flow_steps) } catch {}
                return steps.map((s, i) => (
                  <div key={i} className="mb-3 space-y-2">
                    <p className="text-xs text-gray-500">Step {i + 1}</p>
                    <input className="w-full bg-gray-800 rounded p-2 text-white text-sm"
                      placeholder="질문 / 증명할 것"
                      value={s.prompt}
                      onChange={e => {
                        try {
                          const steps = JSON.parse(form.flow_steps)
                          steps[i].prompt = e.target.value
                          setForm({ ...form, flow_steps: JSON.stringify(steps, null, 2) })
                        } catch {}
                      }} />
                    <input className="w-full bg-gray-800 rounded p-2 text-white text-sm"
                      placeholder="정답 / 풀이"
                      value={s.answer}
                      onChange={e => {
                        try {
                          const steps = JSON.parse(form.flow_steps)
                          steps[i].answer = e.target.value
                          setForm({ ...form, flow_steps: JSON.stringify(steps, null, 2) })
                        } catch {}
                      }} />
                  </div>
                ))
              })()}
            </div>

            <button onClick={handleSave}
              className="w-full bg-blue-600 hover:bg-blue-500 rounded-lg p-3 font-semibold transition">
              💾 저장
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold mb-1">{card.title}</h1>
            {card.category && <p className="text-blue-400 mb-1">{card.category}</p>}
            {card.source && <p className="text-gray-500 text-sm mb-3">{card.source}</p>}
            {card.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {card.tags.map(tag => (
                  <span key={tag} className="bg-gray-700 text-xs px-2 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-6 flex-wrap">
              {(['full', 'cloze', 'keyword', 'flow'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setRevealed(new Set()); setRevealedSteps(new Set()) }}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    mode === m ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
                  }`}>
                  {m === 'full' ? '📝 전체 풀이' : m === 'cloze' ? '🔲 Cloze' : m === 'keyword' ? '🔑 키워드' : '🔀 Flow'}
                </button>
              ))}
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              {mode === 'full' && (
                <div className="leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: card.full_solution
                    ? renderLatex(card.full_solution)
                    : '<span class="text-gray-400">전체 풀이가 없습니다.</span>'
                  }} />
              )}

              {mode === 'cloze' && (
                <div>
                  {renderCloze()}
                  <button onClick={() => setRevealed(new Set())}
                    className="mt-4 text-sm text-gray-400 hover:text-white underline">
                    다시 숨기기
                  </button>
                </div>
              )}

              {mode === 'keyword' && (
                <div>
                  <p className="text-gray-400 text-sm mb-4">키워드만 보고 전체 증명을 재구성해보세요</p>
                  <div className="flex flex-wrap gap-3">
                    {card.keywords?.length > 0
                      ? card.keywords.map(kw => (
                        <span key={kw} className="bg-blue-900 text-blue-200 px-3 py-2 rounded-lg font-semibold">
                          {kw}
                        </span>
                      ))
                      : <p className="text-gray-400">키워드가 없습니다.</p>
                    }
                  </div>
                </div>
              )}

              {mode === 'flow' && (
                <div>
                  {flowSteps.length === 0
                    ? <p className="text-gray-400">Flow 스텝이 없습니다. 수정에서 추가해주세요.</p>
                    : (
                      <div className="space-y-4">
                        <p className="text-gray-400 text-sm mb-2">각 스텝을 클릭하면 정답이 나와요</p>
                        {flowSteps.map((s, i) => (
                          <div key={i} className="border border-gray-700 rounded-lg p-4">
                            <p className="text-sm text-gray-400 mb-1">Step {s.step}</p>
                            <p className="font-semibold mb-3"
                              dangerouslySetInnerHTML={{ __html: renderLatex(s.prompt) }} />
                            {revealedSteps.has(i) ? (
                              <div className="bg-green-900 rounded-lg p-3 text-sm"
                                dangerouslySetInnerHTML={{ __html: renderLatex(s.answer) }} />
                            ) : (
                              <button onClick={() => setRevealedSteps(prev => new Set([...prev, i]))}
                                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                                정답 보기
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setRevealedSteps(new Set())}
                          className="text-sm text-gray-400 hover:text-white underline">
                          전체 다시 숨기기
                        </button>
                      </div>
                    )
                  }
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}