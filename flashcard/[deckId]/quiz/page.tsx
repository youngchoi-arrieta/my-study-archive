'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { OcclusionView, type OcclusionData } from '../../OcclusionEditor'

type CardType = 'basic' | 'multi' | 'cloze' | 'occlusion'
type Field = { name: string; value: string; type: 'text' | 'image' | 'rich'; canBeGiven?: boolean; images?: {url: string; x: number; y: number; w: number; h: number}[] }

function renderField(f: Field) {
  if (f.type === 'rich') return (
    <div className="prose prose-invert max-w-none [&_img]:max-w-full [&_img]:rounded-xl"
      dangerouslySetInnerHTML={{ __html: f.value }} />
  )
  if (f.type === 'image' && f.images?.length) {
    return (
      <div className="relative bg-gray-800 rounded-xl" style={{ height: 220 }}>
        {f.images.map((img: any, i: number) => (
          <img key={i} src={img.url}
            style={{ position: 'absolute', left: img.x, top: img.y, width: img.w, height: img.h }}
            className="object-contain rounded" alt="" />
        ))}
      </div>
    )
  }
  if (f.type === 'image' && f.value) return <img src={f.value} className="max-h-48 object-contain rounded-xl mx-auto" alt="" />
  return <p className="text-2xl font-bold whitespace-pre-wrap">{f?.value || '—'}</p>
}

type Card = { id: string; card_type: CardType; fields: Field[]; occlusion?: OcclusionData }

type QuizItem =
  | { kind: 'basic'; card: Card; direction: 'front' | 'back' }
  | { kind: 'multi'; card: Card; givenIdx: number }
  | { kind: 'cloze'; card: Card; blanks: string[] }
  | { kind: 'occlusion'; card: Card; activeColor: string }

function parseCloze(text: string): { template: string; blanks: string[] } {
  const blanks: string[] = []
  const template = text.replace(/\{\{([^}]+)\}\}/g, (_, b) => { blanks.push(b); return '___' })
  return { template, blanks }
}

function ClozeDisplay({ text, revealed }: { text: string; revealed: boolean }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return (
    <p className="text-xl font-semibold leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.startsWith('{{') && p.endsWith('}}')) {
          const word = p.slice(2, -2)
          return revealed
            ? <span key={i} className="bg-green-800 text-green-200 px-2 py-0.5 rounded mx-0.5">{word}</span>
            : <span key={i} className="bg-yellow-900 text-yellow-900 px-2 py-0.5 rounded mx-0.5 border border-yellow-700 select-none min-w-[3rem] inline-block">{word}</span>
        }
        return <span key={i}>{p}</span>
      })}
    </p>
  )
}

export default function QuizPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>}>
      <QuizPage />
    </Suspense>
  )
}

function QuizPage() {
  const router = useRouter()
  const { deckId } = useParams() as { deckId: string }
  const searchParams = useSearchParams()
  const quizDir = (() => {
    const fromUrl = searchParams.get('dir')
    if (fromUrl === 'word' || fromUrl === 'reading') return fromUrl
    // URL param 없으면 덱별 localStorage 폴백
    try {
      const saved = localStorage.getItem(`quizDir_${deckId}`)
      if (saved === 'word' || saved === 'reading') return saved
    } catch {}
    return 'default'
  })()

  const [deckName, setDeckName] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem('quiz_autoSpeak') !== 'off' } catch { return true }
  })
  // 덱별 TTS 설정 — loadDeck에서 [notts] 태그 확인 후 오버라이드
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try { return localStorage.getItem('quiz_voice_ja') ?? '' } catch { return '' }
  })
  const [speakRate, setSpeakRate] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem('quiz_speak_rate') ?? '0.75') } catch { return 0.75 }
  })

  const speak = useCallback((text: string) => {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ja-JP'
    utter.rate = speakRate
    const allVoices = window.speechSynthesis.getVoices()
    const saved = localStorage.getItem('quiz_voice_ja') ?? ''
    const voice = saved ? allVoices.find(v => v.name === saved) : null
    if (voice) utter.voice = voice
    window.speechSynthesis.speak(utter)
  }, [speakRate])

  const toggleAutoSpeak = () => {
    setAutoSpeak(prev => {
      const next = !prev
      try { localStorage.setItem('quiz_autoSpeak', next ? 'on' : 'off') } catch {}
      return next
    })
  }
  const [queue, setQueue] = useState<QuizItem[]>([])
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hintVisible, setHintVisible] = useState(false)
  const [resumeIds, setResumeIds] = useState<string[] | null>(null)  // null=확인전, []=없음
  const [total, setTotal] = useState(0)
  const [masteredCount, setMasteredCount] = useState(0)

  const RESUME_KEY = `quiz_resume_${deckId}_${quizDir}`

  const saveResume = useCallback((q: QuizItem[], mastered: number) => {
    try {
      if (q.length === 0) { localStorage.removeItem(RESUME_KEY); return }
      const ids = q.map(item => item.card.id)
      localStorage.setItem(RESUME_KEY, JSON.stringify({ ids, mastered }))
    } catch {}
  }, [RESUME_KEY])

  const clearResume = useCallback(() => {
    try { localStorage.removeItem(RESUME_KEY) } catch {}
  }, [RESUME_KEY])

  const loadDeck = useCallback(async () => {
    setLoading(true)
    setDone(false)
    setRevealed(false)
    setMasteredCount(0)

    const { data: deck } = await supabase.from('flashcard_decks').select('name, description').eq('id', deckId).single()
    if (deck) {
      setDeckName(deck.name)
      // [notts] 태그가 있으면 자동 재생 끄기
      if (deck.description?.includes('[notts]')) {
        setAutoSpeak(false)
      }
    }
    const { data: cards } = await supabase.from('flashcard_cards').select('*').eq('deck_id', deckId)
    if (!cards || cards.length === 0) { setDone(true); setLoading(false); return }

    const items: QuizItem[] = []
    for (const card of cards) {
      const type = card.card_type ?? 'basic'
      if (type === 'basic') {
        items.push({ kind: 'basic', card, direction: 'front' })
      } else if (type === 'multi') {
        let givenIndices: number[]
        if (quizDir === 'word') {
          givenIndices = [0]
        } else if (quizDir === 'reading') {
          givenIndices = [1]
        } else {
          givenIndices = card.fields
            .map((_: Field, i: number) => i)
            .filter((i: number) => card.fields[i].canBeGiven !== false)
        }
        givenIndices.forEach((i: number) => items.push({ kind: 'multi', card, givenIdx: i }))
      } else if (type === 'cloze') {
        const { blanks } = parseCloze(card.fields[0]?.value ?? '')
        items.push({ kind: 'cloze', card, blanks })
      } else if (type === 'occlusion') {
        if (card.occlusion?.imageUrl && card.occlusion.blocks.length > 0) {
          const colors = [...new Set(card.occlusion.blocks.map((b: any) => b.color))] as string[]
          colors.forEach(color => items.push({ kind: 'occlusion', card, activeColor: color }))
        }
      }
    }
    const shuffled = items.sort(() => Math.random() - 0.5)

    // resume 확인
    try {
      const saved = localStorage.getItem(RESUME_KEY)
      if (saved) {
        const { ids, mastered } = JSON.parse(saved)
        if (ids && ids.length > 0) {
          // 저장된 id 순서대로 queue 재구성
          const idSet = new Map(shuffled.map(item => [item.card.id + item.kind + ('givenIdx' in item ? item.givenIdx : ''), item]))
          const resumed = ids
            .map((id: string) => shuffled.find(item => item.card.id === id))
            .filter(Boolean) as QuizItem[]
          if (resumed.length > 0) {
            setResumeIds(ids)
            setQueue(shuffled)  // 전체도 보관
            setTotal(shuffled.length)
            setMasteredCount(mastered ?? 0)
            setLoading(false)
            return
          }
        }
      }
    } catch {}
    setResumeIds([])
    setQueue(shuffled)
    setTotal(shuffled.length)
    setLoading(false)
  }, [deckId, quizDir, RESUME_KEY])

  useEffect(() => { loadDeck() }, [loadDeck])

  // 일본어 음성 목록 로드
  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis.getVoices()
      const jaVoices = all.filter(v => v.lang.startsWith('ja'))
      setVoices(jaVoices)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // 카드 바뀔 때 일본어 필드 자동 재생
  useEffect(() => {
    if (!autoSpeak || queue.length === 0) return
    const current = queue[0]
    if (current.kind === 'multi') {
      const text = current.card.fields[current.givenIdx]?.value
      if (text) speak(text)
    } else if (current.kind === 'basic') {
      const text = current.card.fields[0]?.value
      if (text) speak(text)
    } else if (current.kind === 'cloze') {
      // {{단어}} → 단어로 치환해서 전체 예문 읽기
      const raw = current.card.fields[0]?.value ?? ''
      const text = raw.replace(/\{\{([^}]+)\}\}/g, '$1')
      if (text) speak(text)
    }
  }, [queue, autoSpeak, speak])

  const mastered = () => {
    const next = queue.slice(1)
    setMasteredCount(p => {
      saveResume(next, p + 1)
      return p + 1
    })
    setRevealed(false)
    setHintVisible(false)
    if (next.length === 0) { clearResume(); setDone(true) }
    else setQueue(next)
  }

  const notYet = () => {
    setRevealed(false)
    setHintVisible(false)
    setQueue(prev => {
      const next = [...prev.slice(1), prev[0]]
      saveResume(next, masteredCount)
      return next
    })
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-4xl">🃏</div>

  // 이어하기 선택 화면
  if (resumeIds && resumeIds.length > 0) {
    const remaining = resumeIds.length
    const masteredSoFar = masteredCount
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="text-5xl mb-6">💾</div>
        <h1 className="text-2xl font-bold mb-2">이전 세션이 있어요</h1>
        <p className="text-gray-400 mb-1">미숙지 <span className="text-white font-bold">{remaining}장</span> 남음</p>
        <p className="text-gray-600 text-sm mb-8">숙지 {masteredSoFar} / {total}장</p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              // 저장된 id 순으로 queue 재구성
              const resumed = resumeIds
                .map((id: string) => queue.find(item => item.card.id === id))
                .filter(Boolean) as QuizItem[]
              setQueue(resumed)
              setResumeIds([])
            }}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition"
          >
            이어하기
          </button>
          <button
            onClick={() => {
              clearResume()
              setMasteredCount(0)
              setResumeIds([])
            }}
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold transition"
          >
            처음부터
          </button>
        </div>
      </main>
    )
  }

  if (done) return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-6">🎉</div>
      <h1 className="text-3xl font-bold mb-2">완료!</h1>
      <p className="text-gray-400 mb-2">{masteredCount} / {total} 숙지</p>
      <p className="text-xs text-gray-600 mb-8">
        방향: {quizDir === 'word' ? '단어 → 뜻' : quizDir === 'reading' ? '요미가나 → 뜻' : '카드별 설정'}
      </p>
      <div className="flex gap-3">
        <button onClick={loadDeck} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold transition">다시 풀기</button>
        <button onClick={() => router.push(`/flashcard/${deckId}`)} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold transition">덱으로</button>
      </div>
    </main>
  )

  const current = queue[0]
  if (!current) return null

  const renderGiven = () => {
    if (current.kind === 'basic') {
      const f = current.card.fields[0]
      return (
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest">문제</p>
            <button onClick={() => speak(f.value)} className="text-blue-400 hover:text-blue-300 text-lg transition" title="다시 듣기">🔊</button>
          </div>
          {renderField(f as Field)}
        </div>
      )
    }
    if (current.kind === 'multi') {
      const f = current.card.fields[current.givenIdx]
      return (
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest">Given · {f.name}</p>
            <button onClick={() => speak(f.value)} className="text-blue-400 hover:text-blue-300 text-lg transition" title="다시 듣기">🔊</button>
          </div>
          {renderField(f as Field)}
        </div>
      )
    }
    if (current.kind === 'cloze') {
      const hint = current.card.fields[1]?.value
      const rawText = current.card.fields[0]?.value ?? ''
      // TTS용: {{단어}} → 단어 (빈칸 채운 전체 문장 읽기)
      const speakText = rawText.replace(/\{\{([^}]+)\}\}/g, '$1')
      return (
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-yellow-900">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-yellow-500 font-semibold uppercase tracking-widest">빈칸 채우기</p>
            <div className="flex items-center gap-2">
              <button onClick={() => speak(speakText)} className="text-yellow-500 hover:text-yellow-300 text-lg transition" title="예문 듣기">🔊</button>
              {hint && (
                <button
                  onClick={() => setHintVisible(v => !v)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition font-semibold ${
                    hintVisible ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-yellow-500 hover:bg-gray-700'
                  }`}
                >
                  힌트 {hintVisible ? '숨기기' : '보기'}
                </button>
              )}
            </div>
          </div>
          {hintVisible && hint && (
            <p className="text-sm text-yellow-300 bg-yellow-900/20 rounded-xl px-3 py-2 mb-3 leading-relaxed">{hint}</p>
          )}
          <ClozeDisplay text={rawText} revealed={revealed} />
        </div>
      )
    }
    if (current.kind === 'occlusion') {
      return (
        <div className="bg-gray-900 rounded-2xl p-4 mb-4 border border-red-900">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-widest mb-3">
            Image Occlusion
            <span className="ml-2 inline-block w-3 h-3 rounded-full align-middle" style={{ background: current.activeColor }} />
          </p>
          {current.card.occlusion && (
            <OcclusionView data={current.card.occlusion} revealed={revealed} activeColor={current.activeColor} />
          )}
        </div>
      )
    }
  }

  const renderAnswer = () => {
    if (!revealed) return (
      <button onClick={() => setRevealed(true)}
        className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
        탭하여 정답 보기
      </button>
    )

    if (current.kind === 'basic') {
      const f = current.card.fields[1]
      return (
        <div className="bg-gray-900 rounded-2xl p-5 border border-green-900 mb-6">
          <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">정답</p>
          {renderField(f as Field)}
        </div>
      )
    }

    if (current.kind === 'multi') {
      return (
        <div className="space-y-3 mb-6">
          {current.card.fields.filter((_, i) => i !== current.givenIdx).map((f, i) => (
            <div key={i} className="bg-gray-900 rounded-2xl p-5 border border-green-900">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">{f.name}</p>
              {renderField(f as Field)}
            </div>
          ))}
        </div>
      )
    }

    if (current.kind === 'cloze') {
      return (
        <div className="bg-gray-900 rounded-2xl p-5 border border-green-900 mb-6">
          <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-2">정답</p>
          <div className="flex flex-wrap gap-2">
            {current.blanks.map((b, i) => (
              <span key={i} className="bg-green-900 text-green-200 px-3 py-1 rounded-lg text-lg font-bold">{b}</span>
            ))}
          </div>
        </div>
      )
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col p-6 md:p-8">
      <div className="flex items-center justify-between mb-6 max-w-xl mx-auto w-full">
        <button onClick={() => router.push(`/flashcard/${deckId}`)} className="text-gray-400 hover:text-white text-sm">← 나가기</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-300">{deckName}</p>
          <p className="text-xs text-gray-600">남은 {queue.length}장 · 숙지 {masteredCount}/{total}</p>
          <p className="text-[10px] text-blue-500 mt-0.5">
            {quizDir === 'word' ? '단어 → 뜻' : quizDir === 'reading' ? '요미가나 → 뜻' : '카드별 설정'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-600">速</span>
            <input
              type="range" min="0.5" max="1.2" step="0.05"
              value={speakRate}
              onChange={e => {
                const v = parseFloat(e.target.value)
                setSpeakRate(v)
                try { localStorage.setItem('quiz_speak_rate', String(v)) } catch {}
              }}
              className="w-16 accent-blue-500"
            />
            <span className="text-[10px] text-gray-500 w-6">{speakRate.toFixed(2)}</span>
          </div>
          {voices.length > 0 && (
            <select
              value={selectedVoice}
              onChange={e => {
                setSelectedVoice(e.target.value)
                try { localStorage.setItem('quiz_voice_ja', e.target.value) } catch {}
              }}
              className="bg-gray-800 text-gray-300 text-[11px] rounded-lg px-2 py-1 outline-none max-w-[120px] truncate"
            >
              <option value="">기본 음성</option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name.replace(/Microsoft |Google /, '')}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={toggleAutoSpeak}
            title={autoSpeak ? '자동 재생 끄기' : '자동 재생 켜기'}
            className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-30'}`}
          >🔊</button>
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full mb-6">
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(masteredCount / total) * 100}%` }} />
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full flex-1 flex flex-col">
        {renderGiven()}
        {renderAnswer()}
        {revealed && (
          <div className="flex gap-3 mt-auto">
            <button onClick={notYet} className="flex-1 bg-red-900 hover:bg-red-800 rounded-2xl py-4 font-bold text-lg transition">😅 미숙지</button>
            <button onClick={mastered} className="flex-1 bg-green-700 hover:bg-green-600 rounded-2xl py-4 font-bold text-lg transition">✅ 숙지</button>
          </div>
        )}
      </div>
    </main>
  )
}
