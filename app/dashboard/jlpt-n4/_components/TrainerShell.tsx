'use client'

import { useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
//  테마 트레이너 공용 셸
//  카드 타입 · TTS · 퀴즈 화면 · 설정 위젯을 한 곳에 모아
//  새 트레이너는 "데이터 + 카드 생성 함수"만 쓰면 되도록 한다.
// ═══════════════════════════════════════════════════════════════

export interface TrainerCard {
  key: string
  tag: string
  prompt: string
  sub?: string
  answer: string
  speakText: string
  note?: string
  /** 규칙에서 벗어나는 항목 — '불규칙만' 필터에 쓰임 */
  irregular?: boolean
}

export function speak(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate
  window.speechSynthesis.speak(u)
}

export const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5)

export function toggleIn<T>(set: Set<T>, v: T, fn: (s: Set<T>) => void) {
  const n = new Set(set)
  if (n.has(v)) n.delete(v)
  else n.add(v)
  fn(n)
}

// ── 설정 위젯 ────────────────────────────────────────────────────
export function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-3">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      {children}
    </div>
  )
}

export function ChipRow<T extends string>({ items, labels, active, onToggle, color = 'violet' }: {
  items: readonly T[]
  labels: Record<T, string>
  active: Set<T>
  onToggle: (v: T) => void
  color?: 'violet' | 'amber' | 'blue'
}) {
  const on = { violet: 'bg-violet-600', amber: 'bg-amber-600', blue: 'bg-blue-600' }[color]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(i => (
        <button key={i} onClick={() => onToggle(i)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${active.has(i) ? `${on} text-white` : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          {labels[i]}
        </button>
      ))}
    </div>
  )
}

export function ModeGrid<T extends string>({ items, labels, descs, active, onToggle }: {
  items: readonly T[]
  labels: Record<T, string>
  descs: Record<T, string>
  active: Set<T>
  onToggle: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(m => (
        <button key={m} onClick={() => onToggle(m)}
          className={`px-3 py-2 rounded-lg text-left transition ${active.has(m) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          <span className="text-xs font-bold block">{labels[m]}</span>
          <span className={`text-[10px] ${active.has(m) ? 'text-blue-200' : 'text-gray-600'}`}>{descs[m]}</span>
        </button>
      ))}
    </div>
  )
}

export function CountRow({ count, setCount }: { count: number; setCount: (n: number) => void }) {
  return (
    <div className="flex gap-2">
      {[10, 20, 30, 50].map(n => (
        <button key={n} onClick={() => setCount(n)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${count === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          {n}문제
        </button>
      ))}
      <button onClick={() => setCount(0)}
        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${count === 0 ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
        전체
      </button>
    </div>
  )
}

export function IrregularToggle({ on, setOn, onText, offText }: {
  on: boolean; setOn: (v: boolean) => void; onText: string; offText: string
}) {
  return (
    <button onClick={() => setOn(!on)}
      className={`w-full rounded-xl p-4 mb-3 text-left transition ${on ? 'bg-red-950/60 border border-red-900' : 'bg-gray-900 border border-transparent'}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-3">
          <p className="text-sm font-bold">{on ? '🔥 불규칙만' : '전체'}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{on ? onText : offText}</p>
        </div>
        <span className={`w-10 h-6 rounded-full flex items-center px-0.5 shrink-0 transition ${on ? 'bg-red-600 justify-end' : 'bg-gray-700 justify-start'}`}>
          <span className="w-5 h-5 bg-white rounded-full block" />
        </span>
      </div>
    </button>
  )
}

export function CheatBox({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-3">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <span className="text-xs text-gray-400 font-semibold">📋 {title}</span>
        <span className="text-gray-600 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function StartButton({ disabled, onClick, hint }: { disabled: boolean; onClick: () => void; hint: string }) {
  return (
    <>
      <p className="text-xs text-gray-600 text-center mb-4">{hint}</p>
      <button onClick={onClick} disabled={disabled}
        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 py-4 rounded-xl font-bold text-lg transition">
        연습 시작 →
      </button>
    </>
  )
}

// ── 퀴즈 화면 ────────────────────────────────────────────────────
export function QuizScreen({ cards, onDone, promptSize = 'text-3xl' }: {
  cards: TrainerCard[]
  onDone: () => void
  promptSize?: string
}) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setReveal] = useState(false)
  const [mastered, setMastered] = useState(0)
  const [total] = useState(cards.length)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [rate, setRate] = useState(0.85)

  const current = queue[0]

  useEffect(() => {
    if (!autoSpeak || !current) return
    speak(current.prompt.replace(/（.*?）/g, ''), rate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, autoSpeak, rate])

  if (!current) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold mb-2">완료!</h2>
      <p className="text-gray-400 mb-6">숙지 {mastered} / {total}문제</p>
      <button onClick={onDone} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold">← 설정으로</button>
    </div>
  )

  const hitMastered = () => { setMastered(p => p + 1); setReveal(false); setQueue(prev => prev.slice(1)) }
  const hitNotYet = () => { setReveal(false); setQueue(prev => [...prev.slice(1), prev[0]]) }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">남은 {queue.length}장 · 숙지 {mastered}/{total}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">速</span>
          <input type="range" min="0.5" max="1.2" step="0.05" value={rate}
            onChange={e => setRate(parseFloat(e.target.value))} className="w-14 accent-blue-500" />
          <button onClick={() => setAutoSpeak(v => !v)}
            className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-30'}`}>🔊</button>
        </div>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(mastered / total) * 100}%` }} />
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest">{current.tag}</p>
          {current.irregular && (
            <span className="text-[10px] bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-bold">불규칙</span>
          )}
        </div>
        <p className={`${promptSize} font-bold mb-2 leading-snug whitespace-pre-line`}>{current.prompt}</p>
        {current.sub && <p className="text-sm text-gray-500">{current.sub}</p>}
      </div>

      {!revealed ? (
        <button onClick={() => { setReveal(true); speak(current.speakText, rate) }}
          className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
          탭하여 정답 보기
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-6 border border-green-900 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">정답</p>
            <button onClick={() => speak(current.speakText, rate)}
              className="text-green-400 hover:text-green-300 text-lg transition">🔊</button>
          </div>
          <p className="text-2xl font-bold text-green-300 mb-1 leading-snug whitespace-pre-line">{current.answer}</p>
          {current.note && <p className="text-xs text-gray-500 mt-3 leading-relaxed">💡 {current.note}</p>}
        </div>
      )}

      {revealed && (
        <div className="flex gap-3">
          <button onClick={hitNotYet}
            className="flex-1 bg-red-900 hover:bg-red-800 rounded-2xl py-4 font-bold text-lg transition">😅 미숙지</button>
          <button onClick={hitMastered}
            className="flex-1 bg-green-700 hover:bg-green-600 rounded-2xl py-4 font-bold text-lg transition">✅ 숙지</button>
        </div>
      )}
    </div>
  )
}

// ── 페이지 레이아웃 ──────────────────────────────────────────────
export function TrainerLayout({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle: string; children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT</Link>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{icon}</span>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">{subtitle}</p>
        {children}
      </div>
    </main>
  )
}
