'use client'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import RichEditor from '../../components/RichEditor'

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
  image_urls: string[]
  status: string
  review_count: number
  last_reviewed: string
  my_note: string
  created_at: string
}

type Mode = 'full' | 'cloze' | 'keyword' | 'flow'

const STATUS_COLORS: Record<string, string> = {
  '미숙지': 'bg-red-700',
  '숙지중': 'bg-yellow-600',
  '완전숙지': 'bg-green-600',
  '오답노트': 'bg-red-600',
  '완료': 'bg-blue-600',
}

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
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(new Set())
  const [myNote, setMyNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  useEffect(() => {
    const fetchCard = async () => {
      const { data } = await supabase.from('cards').select('*').eq('id', id).single()
      setCard(data)
      setMyNote(data?.my_note || '')
      if (data) setForm({
        title: data.title || '',
        category: data.category || '',
        tags: (data.tags || []).join(', '),
        source: data.source || '',
        full_solution: data.full_solution || '',
        cloze_text: data.cloze_text || '',
        keywords: (data.keywords || []).join(', '),
        flow_steps: JSON.stringify(data.flow_steps || [], null, 2),
      })
    }
    fetchCard()
  }, [id])

  const handleStatusChange = async (status: string) => {
    const newCount = status === '미숙지' ? 0 : (card?.review_count || 0) + 1
    const { data } = await supabase.from('cards').update({
      status,
      review_count: newCount,
      last_reviewed: new Date().toISOString(),
    }).eq('id', id).select().single()
    if (data) setCard(data)
  }

  const handleCategoryChange = async (status: string) => {
    const newStatus = card?.status === status ? '미숙지' : status
    const { data } = await supabase.from('cards').update({
      status: newStatus,
    }).eq('id', id).select().single()
    if (data) setCard(data)
  }

  const handleSaveNote = async () => {
    setSavingNote(true)
    await supabase.from('cards').update({ my_note: myNote }).eq('id', id)
    setSavingNote(false)
  }

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
      setEditing(false)
    } else alert('저장 실패: ' + error.message)
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제할까요?')) return
    await supabase.from('cards').delete().eq('id', id)
    router.push('/cards')
  }

  const renderContent = (html: string) => {
    if (!html) return ''
    return html.replace(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g, match => {
      const isDisplay = match.startsWith('$$')
      const math = isDisplay ? match.slice(2, -2) : match.slice(1, -1)
      try { return katex.renderToString(math, { displayMode: isDisplay }) }
      catch { return match }
    })
  }

  const renderCloze = () => {
    if (!card?.cloze_text) return <p className="text-gray-400">Cloze 텍스트가 없습니다.</p>
    const imgTags = Array.from(card.cloze_text.matchAll(/<img[^>]+>/g)).map(m => m[0])
    const stripped = card.cloze_text.replace(/<img[^>]+>/g, '').replace(/<[^>]+>/g, '')
    const parts = stripped.split(/(\{\{.*?\}\})/g)
    let idx = 0
    return (
      <div>
        {imgTags.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4"
            dangerouslySetInnerHTML={{ __html: imgTags.join('') }} />
        )}
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
      </div>
    )
  }

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

        <div className="flex justify-between items-center mb-4">
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
          <div className="space-y-4 mt-4">
            <p className="text-xs text-gray-500">💡 각 에디터에서 Ctrl+V로 이미지 붙여넣기 가능</p>
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
            <div>
              <label className="text-sm text-gray-400 mb-1 block">📝 전체 풀이 / 증명</label>
              <RichEditor content={form.full_solution}
                onChange={val => setForm({...form, full_solution: val})}
                placeholder="전체 풀이 또는 증명 입력 (LaTeX: $$ ... $$)" />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">🔲 Cloze (빈칸: 중괄호 두 개로 답 감싸기)</label>
              <RichEditor content={form.cloze_text}
                onChange={val => setForm({...form, cloze_text: val})}
                placeholder="예: 테브난 등가회로의 개방전압을 Vth, 등가저항을 Rth라 한다." />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">🔑 키워드 (쉼표 구분)</label>
              <input className="w-full bg-gray-800 rounded-lg p-3 text-white"
                placeholder="예: 개방전압, 독립전원 제거, 등가저항"
                value={form.keywords}
                onChange={e => setForm({...form, keywords: e.target.value})} />
            </div>
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
                  <div key={i} className="mb-4 space-y-2">
                    <p className="text-xs text-gray-500">Step {i + 1}</p>
                    <RichEditor content={s.prompt}
                      onChange={val => {
                        try {
                          const steps = JSON.parse(form.flow_steps)
                          steps[i].prompt = val
                          setForm({ ...form, flow_steps: JSON.stringify(steps, null, 2) })
                        } catch {}
                      }}
                      placeholder="질문 / 증명할 것" />
                    <RichEditor content={s.answer}
                      onChange={val => {
                        try {
                          const steps = JSON.parse(form.flow_steps)
                          steps[i].answer = val
                          setForm({ ...form, flow_steps: JSON.stringify(steps, null, 2) })
                        } catch {}
                      }}
                      placeholder="정답 / 풀이" />
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
              <div className="flex flex-wrap gap-2 mb-4">
                {card.tags.map(tag => (
                  <span key={tag} className="bg-gray-700 text-xs px-2 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            {/* 학습 상태 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[card.status || '미숙지'] || 'bg-gray-600'}`}>
                  {card.status || '미숙지'}
                </span>
                <span className="text-gray-400 text-sm">회독 {card.review_count || 0}회</span>
                {card.last_reviewed && (
                  <span className="text-gray-500 text-xs">
                    마지막: {new Date(card.last_reviewed).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">숙지도 (회독수 변경)</p>
                <div className="flex gap-2 flex-wrap">
                  {['미숙지', '숙지중', '완전숙지'].map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        card.status === s ? STATUS_COLORS[s] : 'bg-gray-700 hover:bg-gray-600'
                      }`}>
                      {s === '미숙지' ? '😅 미숙지' : s === '숙지중' ? '🤔 숙지중' : '✅ 완전숙지'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">카테고리 (회독수 유지)</p>
                <div className="flex gap-2 flex-wrap">
                  {['오답노트', '완료'].map(s => (
                    <button key={s} onClick={() => handleCategoryChange(s)}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        card.status === s ? STATUS_COLORS[s] : 'bg-gray-700 hover:bg-gray-600'
                      }`}>
                      {s === '오답노트' ? '❌ 오답노트' : '📦 완료'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4모드 */}
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

            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              {mode === 'full' && (
                <div className="leading-relaxed prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: card.full_solution
                    ? renderContent(card.full_solution)
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
                  {(!card.flow_steps || card.flow_steps.length === 0)
                    ? <p className="text-gray-400">Flow 스텝이 없습니다. 수정에서 추가해주세요.</p>
                    : (
                      <div className="space-y-4">
                        <p className="text-gray-400 text-sm mb-2">각 스텝을 클릭하면 정답이 나와요</p>
                        {card.flow_steps.map((s, i) => (
                          <div key={i} className="border border-gray-700 rounded-lg p-4">
                            <p className="text-sm text-gray-400 mb-1">Step {s.step}</p>
                            <div className="font-semibold mb-3 prose prose-invert max-w-none"
                              dangerouslySetInnerHTML={{ __html: renderContent(s.prompt) }} />
                            {revealedSteps.has(i) ? (
                              <div className="bg-green-900 rounded-lg p-3 prose prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderContent(s.answer) }} />
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

            {/* 나의 메모 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-2">📌 나의 메모 / 이해도 코멘트</p>
              <textarea
                className="w-full bg-gray-800 rounded-lg p-3 text-white h-24 text-sm"
                placeholder="이해가 안 된 부분, 실수한 포인트, 관련 개념 등..."
                value={myNote}
                onChange={e => setMyNote(e.target.value)}
              />
              <button onClick={handleSaveNote} disabled={savingNote}
                className="mt-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm transition">
                {savingNote ? '저장 중...' : '💾 메모 저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}