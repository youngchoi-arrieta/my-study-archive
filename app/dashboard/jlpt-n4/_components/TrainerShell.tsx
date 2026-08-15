'use client'

import { useState, useEffect, ReactNode, Fragment } from 'react'
import Link from 'next/link'
import { RuleBook, RuleSection, ruleBook } from '@/lib/constants-jlpt-rules'

// ═══════════════════════════════════════════════════════════════
//  테마 트레이너 공용 셸
//
//  음성: 플래시카드 퀴즈와 같은 localStorage 키를 쓴다.
//        (quiz_voice_ja / quiz_speak_rate)
//        거기서 고른 목소리가 트레이너에도 그대로 적용되고,
//        기본값은 "재생 끔"이다. 기계음이 불쑥 나오지 않게.
//
//  규칙: 트레이너마다 lib/constants-jlpt-rules.ts 의 해설을
//        설정 화면 맨 위에 펼쳐 두고, 문제 중에도 📘로 연다.
// ═══════════════════════════════════════════════════════════════

export interface TrainerCard {
  key: string
  tag: string
  prompt: string
  sub?: string
  answer: string
  speakText: string
  note?: string
  irregular?: boolean
}

// ── 음성 (플래시카드와 설정 공유) ────────────────────────────────
const VOICE_KEY = 'quiz_voice_ja'
const RATE_KEY = 'quiz_speak_rate'
const AUTO_KEY = 'trainer_autoSpeak'

const ls = {
  get(k: string, fallback = '') {
    try { return localStorage.getItem(k) ?? fallback } catch { return fallback }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v) } catch { /* noop */ }
  },
}

export const savedRate = () => {
  const n = parseFloat(ls.get(RATE_KEY, '0.75'))
  return Number.isFinite(n) ? n : 0.75
}

/** 저장된 일본어 음성으로 읽는다. 음성을 고르지 않았으면 재생하지 않는다. */
export function speak(text: string, rate?: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return
  const savedName = ls.get(VOICE_KEY)
  const voice = savedName
    ? window.speechSynthesis.getVoices().find(v => v.name === savedName)
    : undefined
  if (!voice) return   // 목소리를 고르기 전에는 침묵 — 기본 기계음을 쓰지 않는다
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate ?? savedRate()
  u.voice = voice
  window.speechSynthesis.speak(u)
}

export const hasVoice = () => ls.get(VOICE_KEY) !== ''

/** 음성 선택 — 플래시카드 퀴즈와 같은 설정을 읽고 쓴다 */
export function VoicePicker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [name, setName] = useState('')
  const [rate, setRate] = useState(0.75)

  useEffect(() => {
    setName(ls.get(VOICE_KEY))
    setRate(savedRate())
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const load = () => setVoices(window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('ja')))
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  const choose = (v: string) => { setName(v); ls.set(VOICE_KEY, v) }
  const changeRate = (v: number) => { setRate(v); ls.set(RATE_KEY, String(v)) }

  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">음성</p>
        <span className="text-[10px] text-gray-700">플래시카드와 같은 설정</span>
      </div>
      {voices.length === 0 ? (
        <p className="text-[11px] text-gray-600 leading-relaxed">
          이 기기에 일본어 음성이 없습니다. 음성 없이 그대로 쓰셔도 됩니다.
        </p>
      ) : (
        <>
          <select value={name} onChange={e => choose(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-xs outline-none transition mb-2">
            <option value="">사용 안 함 (무음)</option>
            {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          {name && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 shrink-0">속도 {rate.toFixed(2)}</span>
              <input type="range" min="0.5" max="1.2" step="0.05" value={rate}
                onChange={e => changeRate(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500" />
              <button onClick={() => speak('こんにちは。電気工事の試験です。', rate)}
                className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 shrink-0 transition">
                들어보기
              </button>
            </div>
          )}
          <p className="text-[10px] text-gray-700 mt-2 leading-relaxed">
            기본값은 무음입니다. 기기에 따라 기본 음성이 거칠 수 있으니 마음에 드는 것을 직접 고르세요.
          </p>
        </>
      )}
    </div>
  )
}

export const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5)

export function toggleIn<T>(set: Set<T>, v: T, fn: (s: Set<T>) => void) {
  const n = new Set(set)
  if (n.has(v)) n.delete(v)
  else n.add(v)
  fn(n)
}

// ── 규칙 해설 ────────────────────────────────────────────────────
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((para, pi) => (
        <p key={pi} className={pi > 0 ? 'mt-2.5' : ''}>
          {para.split('\n').map((line, li) => (
            <Fragment key={li}>
              {li > 0 && <br />}
              {line.split(/(\*\*[^*]+\*\*)/g).map((seg, si) =>
                seg.startsWith('**') && seg.endsWith('**')
                  ? <strong key={si} className="text-white font-bold">{seg.slice(2, -2)}</strong>
                  : <Fragment key={si}>{seg}</Fragment>,
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  )
}

function Section({ s }: { s: RuleSection }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="text-[13px] font-bold text-blue-300 mb-2">{s.h}</h3>
      {s.table && (
        <div className="overflow-x-auto mb-2.5">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                {s.table.head.map((h, i) => (
                  <th key={i} className="text-left font-bold text-gray-600 border-b border-gray-800 pb-1 pr-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, ri) => (
                <tr key={ri} className="align-top">
                  {r.map((cell, ci) => (
                    <td key={ci}
                      className={`py-1.5 pr-3 border-b border-gray-900 whitespace-pre-line ${
                        ci === s.table!.accent ? 'text-amber-300' : ci === 0 ? 'text-gray-300 font-semibold' : 'text-gray-400'
                      }`}>
                      {cell.split(/(\*\*[^*]+\*\*)/g).map((seg, si) =>
                        seg.startsWith('**') && seg.endsWith('**')
                          ? <strong key={si} className="text-white">{seg.slice(2, -2)}</strong>
                          : <Fragment key={si}>{seg}</Fragment>,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.body && (
        <div className="text-[12px] text-gray-400 leading-relaxed">
          <Rich text={s.body} />
        </div>
      )}
    </div>
  )
}

export function RuleBody({ book }: { book: RuleBook }) {
  return (
    <div>
      <p className="text-[12px] text-gray-300 leading-relaxed mb-4 pb-4 border-b border-gray-800">
        <Rich text={book.lead} />
      </p>
      {book.sections.map((s, i) => <Section key={i} s={s} />)}
    </div>
  )
}

/** 설정 화면 맨 위에 놓는 해설. 처음에는 펼쳐져 있고, 접으면 기억한다. */
export function RuleSheet({ slug }: { slug: string }) {
  const book = ruleBook(slug)
  const key = `trainer_rule_open_${slug}`
  const [open, setOpen] = useState(true)

  useEffect(() => { setOpen(ls.get(key, 'open') !== 'closed') }, [key])

  if (!book) return null
  const toggle = () => {
    const next = !open
    setOpen(next)
    ls.set(key, next ? 'open' : 'closed')
  }

  return (
    <div className="bg-gray-900 rounded-xl mb-4 border border-blue-950">
      <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-xs font-bold text-blue-300">📘 {book.title}</span>
        <span className="text-gray-600 text-xs">{open ? '접기 −' : '펼치기 +'}</span>
      </button>
      {open && <div className="px-4 pb-4"><RuleBody book={book} /></div>}
    </div>
  )
}

/** 문제 푸는 중에 여는 오버레이 */
export function RuleModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const book = ruleBook(slug)
  if (!book) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto border border-gray-800"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-gray-900 flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <span className="text-sm font-bold text-blue-300">📘 {book.title}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm px-2">닫기 ✕</button>
        </div>
        <div className="px-5 py-4"><RuleBody book={book} /></div>
      </div>
    </div>
  )
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
export function QuizScreen({ cards, onDone, promptSize = 'text-3xl', ruleSlug }: {
  cards: TrainerCard[]
  onDone: () => void
  promptSize?: string
  ruleSlug?: string
}) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setReveal] = useState(false)
  const [mastered, setMastered] = useState(0)
  const [total] = useState(cards.length)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [showRule, setShowRule] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)

  const current = queue[0]

  useEffect(() => {
    setVoiceOn(hasVoice())
    setAutoSpeak(ls.get(AUTO_KEY, 'off') === 'on' && hasVoice())
  }, [])

  useEffect(() => {
    if (!autoSpeak || !current) return
    speak(current.prompt.replace(/（.*?）/g, ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, autoSpeak])

  if (!current) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold mb-2">완료!</h2>
      <p className="text-gray-400 mb-6">숙지 {mastered} / {total}문제</p>
      <button onClick={onDone} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold">← 설정으로</button>
    </div>
  )

  const toggleAuto = () => {
    const next = !autoSpeak
    setAutoSpeak(next)
    ls.set(AUTO_KEY, next ? 'on' : 'off')
  }
  const hitMastered = () => { setMastered(p => p + 1); setReveal(false); setQueue(prev => prev.slice(1)) }
  const hitNotYet = () => { setReveal(false); setQueue(prev => [...prev.slice(1), prev[0]]) }

  return (
    <div className="max-w-xl mx-auto">
      {showRule && ruleSlug && <RuleModal slug={ruleSlug} onClose={() => setShowRule(false)} />}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">남은 {queue.length}장 · 숙지 {mastered}/{total}</p>
        <div className="flex items-center gap-2">
          {ruleSlug && (
            <button onClick={() => setShowRule(true)}
              className="text-[11px] px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 text-blue-300 font-bold transition">
              📘 규칙
            </button>
          )}
          {voiceOn && (
            <button onClick={toggleAuto} title="자동 재생"
              className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-30'}`}>🔊</button>
          )}
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
        <button onClick={() => { setReveal(true); speak(current.speakText) }}
          className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
          탭하여 정답 보기
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-6 border border-green-900 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">정답</p>
            {voiceOn && (
              <button onClick={() => speak(current.speakText)}
                className="text-green-400 hover:text-green-300 text-lg transition">🔊</button>
            )}
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
