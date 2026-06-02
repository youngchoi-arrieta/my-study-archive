'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  VERB_LIST, CONJ_LABELS, CONJ_MEANINGS, ALL_CONJ_TYPES,
  GROUP_LABELS, conjugate,
  type Verb, type ConjType, type VerbGroup,
} from '@/lib/verb-conjugation'

const COUNT_OPTIONS = [10, 20, 30, 50] as const
const ALL_GROUPS: VerbGroup[] = ['1', '2', '3', 'suru']

type QuizCard = {
  verb: Verb
  type: ConjType
  answer: string
}

// ── TTS ─────────────────────────────────────────────────────────
function speak(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate
  window.speechSynthesis.speak(u)
}

// ── 설정 화면 ────────────────────────────────────────────────────
function SettingsScreen({ onStart }: { onStart: (cards: QuizCard[]) => void }) {
  const [groups, setGroups] = useState<Set<VerbGroup>>(new Set(['1', '2']))
  const [types, setTypes] = useState<Set<ConjType>>(new Set(['masu', 'nai', 'te', 'ta']))
  const [count, setCount] = useState<number>(20)

  const toggleGroup = (g: VerbGroup) => setGroups(prev => {
    const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n
  })
  const toggleType = (t: ConjType) => setTypes(prev => {
    const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n
  })

  const handleStart = () => {
    const filtered = VERB_LIST.filter(v => groups.has(v.group))
    const typeArr = [...types]
    if (filtered.length === 0 || typeArr.length === 0) return

    const pool: QuizCard[] = []
    for (const verb of filtered) {
      for (const type of typeArr) {
        const answer = conjugate(verb, type)
        pool.push({ verb, type, answer })
      }
    }
    const shuffled = pool.sort(() => Math.random() - 0.5)
    onStart(shuffled.slice(0, count === 0 ? shuffled.length : count))
  }

  const totalPool = VERB_LIST.filter(v => groups.has(v.group)).length * types.size

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

      {/* 그룹 */}
      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">동사 그룹</p>
        <div className="flex flex-wrap gap-2">
          {ALL_GROUPS.map(g => (
            <button key={g} onClick={() => toggleGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                groups.has(g) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 변형 종류 */}
      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">활용형</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CONJ_TYPES.map(t => (
            <button key={t} onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                types.has(t) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {CONJ_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 문제 수 */}
      <div className="bg-gray-900 rounded-xl p-4 mb-5">
        <p className="text-xs text-gray-500 mb-2">문제 수</p>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                count === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {n}문제
            </button>
          ))}
          <button onClick={() => setCount(0)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
              count === 0 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            전체
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600 text-center mb-4">
        예상 문제 수: {totalPool}개 중 {count === 0 ? totalPool : Math.min(count, totalPool)}문제
      </p>

      <button
        onClick={handleStart}
        disabled={groups.size === 0 || types.size === 0}
        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 py-4 rounded-xl font-bold text-lg transition"
      >
        연습 시작 →
      </button>
    </div>
  )
}

// ── 퀴즈 화면 ────────────────────────────────────────────────────
function QuizScreen({ cards, onDone }: { cards: QuizCard[]; onDone: () => void }) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setReveal] = useState(false)
  const [mastered, setMastered] = useState(0)
  const [total] = useState(cards.length)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [speakRate, setSpeakRate] = useState(0.8)

  const current = queue[0]

  // 카드 바뀔 때 앞면 TTS
  useEffect(() => {
    if (!autoSpeak || !current) return
    speak(current.verb.kana, speakRate)
  }, [queue, autoSpeak, speakRate])

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2">완료!</h2>
        <p className="text-gray-400 mb-1">숙지 {mastered} / {total}문제</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onDone} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold">← 설정으로</button>
        </div>
      </div>
    )
  }

  const hitMastered = () => {
    setMastered(p => p + 1)
    setReveal(false)
    setQueue(prev => prev.slice(1))
  }
  const hitNotYet = () => {
    setReveal(false)
    setQueue(prev => [...prev.slice(1), prev[0]])
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">남은 {queue.length}장 · 숙지 {mastered}/{total}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">速</span>
          <input type="range" min="0.5" max="1.2" step="0.05" value={speakRate}
            onChange={e => setSpeakRate(parseFloat(e.target.value))}
            className="w-14 accent-blue-500" />
          <button onClick={() => setAutoSpeak(v => !v)}
            className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-30'}`}>🔊</button>
        </div>
      </div>

      {/* 진도 바 */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
        <div className="bg-green-500 h-1.5 rounded-full transition-all"
          style={{ width: `${(mastered / total) * 100}%` }} />
      </div>

      {/* 앞면 */}
      <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
        <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">문제</p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-3xl font-bold mb-1">{current.verb.kanji}</p>
            <p className="text-base text-gray-400">{current.verb.kana} · {current.verb.meaning}</p>
            <p className="text-xs text-gray-600 mt-1">{GROUP_LABELS[current.verb.group]}</p>
          </div>
          <button onClick={() => speak(current.verb.kana, speakRate)}
            className="text-blue-400 hover:text-blue-300 text-2xl transition">🔊</button>
        </div>
        <div className="border-t border-gray-800 pt-3 mt-3">
          <p className="text-lg font-semibold text-yellow-400">
            {CONJ_LABELS[current.type]}は？
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{CONJ_MEANINGS[current.type]}</p>
        </div>
      </div>

      {/* 뒷면 */}
      {!revealed ? (
        <button onClick={() => { setReveal(true); speak(current.answer, speakRate) }}
          className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
          탭하여 정답 보기
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-6 border border-green-900 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">정답</p>
            <button onClick={() => speak(current.answer, speakRate)}
              className="text-green-400 hover:text-green-300 text-lg transition">🔊</button>
          </div>
          <p className="text-3xl font-bold text-green-300 mb-1">{current.answer}</p>
          <p className="text-sm text-gray-500">{CONJ_MEANINGS[current.type]}</p>
        </div>
      )}

      {/* 버튼 */}
      {revealed && (
        <div className="flex gap-3">
          <button onClick={hitNotYet}
            className="flex-1 bg-red-900 hover:bg-red-800 rounded-2xl py-4 font-bold text-lg transition">
            😅 미숙지
          </button>
          <button onClick={hitMastered}
            className="flex-1 bg-green-700 hover:bg-green-600 rounded-2xl py-4 font-bold text-lg transition">
            ✅ 숙지
          </button>
        </div>
      )}
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────
export default function VerbPracticePage() {
  const [cards, setCards] = useState<QuizCard[] | null>(null)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT N4</Link>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚡</span>
          <h1 className="text-2xl font-bold">動詞活用練習</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          동사 활용 반사신경 트레이닝 · {VERB_LIST.length}개 동사 · 11가지 활용형
        </p>

        {cards === null ? (
          <SettingsScreen onStart={setCards} />
        ) : (
          <QuizScreen cards={cards} onDone={() => setCards(null)} />
        )}
      </div>
    </main>
  )
}
