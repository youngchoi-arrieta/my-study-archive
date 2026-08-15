'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { speak, hasVoice, RuleSheet, VoicePicker, RuleModal } from '../_components/TrainerShell'

// ═══════════════════════════════════════════════════════════════
//  親族呼称練習
//  대가족 관계 호칭 — うち(자기 가족·겸양) / そと(남의 가족·존경) 축
//
//  설계 원칙: 조수사가 "숫자 × 음변화"였다면, 호칭은
//  "관계 × 내외(内/外)"다. 같은 아버지가 対外에서는 父,
//  남의 아버지는 お父さん. 이 변환 자체를 문제로 만든다.
// ═══════════════════════════════════════════════════════════════

type Gen = 'senior' | 'parent' | 'sibling' | 'spouse' | 'child' | 'extended' | 'inlaw' | 'group'

const GEN_LABELS: Record<Gen, string> = {
  senior: '조부모·증조부모',
  parent: '부모',
  sibling: '형제',
  spouse: '배우자',
  child: '자녀·손자',
  extended: '방계 (백숙부모·사촌·조카)',
  inlaw: '인척 (시가·처가)',
  group: '집합 (両親·兄弟·家族)',
}
const ALL_GENS = Object.keys(GEN_LABELS) as Gen[]

interface Kin {
  id: string
  ko: string          // 한국어 관계
  inK: string         // 자기 가족 표기 (謙譲·対外)
  inR: string         // 그 읽기
  outK: string        // 남의 가족 표기 (尊敬)
  outR: string        // 그 읽기
  call?: string       // 직접 부를 때
  gen: Gen
  note?: string
}

const KIN: Kin[] = [
  // 조부모 이상
  { id: 'sofu', ko: '할아버지', inK: '祖父', inR: 'そふ', outK: 'おじいさん', outR: 'おじいさん', call: 'おじいちゃん', gen: 'senior' },
  { id: 'sobo', ko: '할머니', inK: '祖母', inR: 'そぼ', outK: 'おばあさん', outR: 'おばあさん', call: 'おばあちゃん', gen: 'senior' },
  { id: 'sousofu', ko: '증조할아버지', inK: '曽祖父', inR: 'そうそふ', outK: 'ひいおじいさん', outR: 'ひいおじいさん', gen: 'senior', note: 'ひい〜 = 曽(증) 세대' },
  { id: 'sousobo', ko: '증조할머니', inK: '曽祖母', inR: 'そうそぼ', outK: 'ひいおばあさん', outR: 'ひいおばあさん', gen: 'senior' },
  // 부모
  { id: 'chichi', ko: '아버지', inK: '父', inR: 'ちち', outK: 'お父さん', outR: 'おとうさん', call: 'お父さん', gen: 'parent', note: '남에게 내 아버지를 말할 땐 父 · 직접 부를 땐 お父さん' },
  { id: 'haha', ko: '어머니', inK: '母', inR: 'はは', outK: 'お母さん', outR: 'おかあさん', call: 'お母さん', gen: 'parent', note: '남에게 내 어머니를 말할 땐 母' },
  // 형제
  { id: 'ani', ko: '형·오빠', inK: '兄', inR: 'あに', outK: 'お兄さん', outR: 'おにいさん', call: '兄さん / お兄ちゃん', gen: 'sibling' },
  { id: 'ane', ko: '누나·언니', inK: '姉', inR: 'あね', outK: 'お姉さん', outR: 'おねえさん', call: '姉さん / お姉ちゃん', gen: 'sibling' },
  { id: 'otouto', ko: '남동생', inK: '弟', inR: 'おとうと', outK: '弟さん', outR: 'おとうとさん', call: '이름으로 부름', gen: 'sibling', note: '손아래는 お를 붙이지 않음 · 직접 부를 땐 이름' },
  { id: 'imouto', ko: '여동생', inK: '妹', inR: 'いもうと', outK: '妹さん', outR: 'いもうとさん', call: '이름으로 부름', gen: 'sibling' },
  // 배우자
  { id: 'otto', ko: '남편', inK: '夫 / 主人', inR: 'おっと / しゅじん', outK: 'ご主人 / 旦那さん', outR: 'ごしゅじん / だんなさん', gen: 'spouse', note: '내 남편은 夫·主人 / 남의 남편은 ご主人' },
  { id: 'tsuma', ko: '아내', inK: '妻 / 家内', inR: 'つま / かない', outK: '奥さん', outR: 'おくさん', gen: 'spouse', note: '내 아내를 奥さん이라 하면 안 됨' },
  // 자녀
  { id: 'musuko', ko: '아들', inK: '息子', inR: 'むすこ', outK: '息子さん', outR: 'むすこさん', gen: 'child' },
  { id: 'musume', ko: '딸', inK: '娘', inR: 'むすめ', outK: '娘さん / お嬢さん', outR: 'むすめさん / おじょうさん', gen: 'child' },
  { id: 'mago', ko: '손자·손녀', inK: '孫', inR: 'まご', outK: 'お孫さん', outR: 'おまごさん', gen: 'child' },
  // 방계
  { id: 'oji', ko: '큰아버지·작은아버지', inK: '伯父 / 叔父', inR: 'おじ', outK: 'おじさん', outR: 'おじさん', gen: 'extended', note: '伯父 = 부모의 형 / 叔父 = 부모의 남동생 (읽기는 둘 다 おじ)' },
  { id: 'oba', ko: '큰어머니·이모·고모', inK: '伯母 / 叔母', inR: 'おば', outK: 'おばさん', outR: 'おばさん', gen: 'extended', note: '伯母 = 부모의 누나 / 叔母 = 부모의 여동생' },
  { id: 'itoko', ko: '사촌', inK: '従兄弟 / いとこ', inR: 'いとこ', outK: 'いとこの方', outR: 'いとこのかた', gen: 'extended', note: '従兄弟(남)·従姉妹(여) 모두 いとこ' },
  { id: 'oi', ko: '조카(남)', inK: '甥', inR: 'おい', outK: '甥御さん', outR: 'おいごさん', gen: 'extended' },
  { id: 'mei', ko: '조카(여)', inK: '姪', inR: 'めい', outK: '姪御さん', outR: 'めいごさん', gen: 'extended' },
  { id: 'shinseki', ko: '친척', inK: '親戚', inR: 'しんせき', outK: 'ご親戚', outR: 'ごしんせき', gen: 'extended' },
  // 인척
  { id: 'gifu', ko: '시아버지·장인', inK: '義父', inR: 'ぎふ', outK: 'お義父さん', outR: 'おとうさん', call: 'お義父さん', gen: 'inlaw', note: '義 자가 들어가도 읽기는 おとうさん' },
  { id: 'gibo', ko: '시어머니·장모', inK: '義母', inR: 'ぎぼ', outK: 'お義母さん', outR: 'おかあさん', call: 'お義母さん', gen: 'inlaw' },
  { id: 'giri-ani', ko: '시아주버니·처형(손위)', inK: '義兄', inR: 'ぎけい / あに', outK: 'お義兄さん', outR: 'おにいさん', gen: 'inlaw' },
  { id: 'yome', ko: '며느리', inK: '嫁 / 息子の妻', inR: 'よめ', outK: 'お嫁さん', outR: 'およめさん', gen: 'inlaw' },
  { id: 'muko', ko: '사위', inK: '婿 / 娘の夫', inR: 'むこ', outK: 'お婿さん', outR: 'おむこさん', gen: 'inlaw' },
  // 집합
  { id: 'ryoushin', ko: '부모님', inK: '両親', inR: 'りょうしん', outK: 'ご両親', outR: 'ごりょうしん', gen: 'group' },
  { id: 'kyoudai', ko: '형제자매', inK: '兄弟', inR: 'きょうだい', outK: 'ご兄弟', outR: 'ごきょうだい', gen: 'group' },
  { id: 'kazoku', ko: '가족', inK: '家族', inR: 'かぞく', outK: 'ご家族', outR: 'ごかぞく', gen: 'group' },
  { id: 'shujin-gr', ko: '부부', inK: '夫婦', inR: 'ふうふ', outK: 'ご夫婦', outR: 'ごふうふ', gen: 'group' },
]

// ── 문제 유형 ────────────────────────────────────────────────────
type QMode = 'read' | 'inout' | 'outin' | 'ko'

const QMODE_LABELS: Record<QMode, string> = {
  read: '표기 → 읽기',
  inout: 'うち → そと',
  outin: 'そと → うち',
  ko: '한국어 → 일본어',
}
const QMODE_DESC: Record<QMode, string> = {
  read: '한자 표기의 읽기',
  inout: '내 가족 표현을 남의 가족 표현으로',
  outin: '남의 가족 표현을 내 가족 표현으로',
  ko: '관계를 보고 うち 표현 만들기',
}
const ALL_QMODES = Object.keys(QMODE_LABELS) as QMode[]

interface Card {
  key: string
  tag: string
  prompt: string
  sub?: string
  answer: string
  speakText: string
  note?: string
}

function buildCards(kins: Kin[], modes: Set<QMode>): Card[] {
  const out: Card[] = []
  for (const k of kins) {
    if (modes.has('read')) {
      out.push({
        key: `r-in-${k.id}`, tag: 'うち · 読み',
        prompt: k.inK, sub: `${k.ko} (자기 가족)`,
        answer: k.inR, speakText: k.inR.split(' / ')[0], note: k.note,
      })
      if (k.outK !== k.outR) {
        out.push({
          key: `r-out-${k.id}`, tag: 'そと · 読み',
          prompt: k.outK, sub: `${k.ko} (남의 가족)`,
          answer: k.outR, speakText: k.outR.split(' / ')[0], note: k.note,
        })
      }
    }
    if (modes.has('inout')) {
      out.push({
        key: `io-${k.id}`, tag: 'うち → そと',
        prompt: `${k.inK}（${k.inR}）`, sub: `${k.ko} · 남의 가족이라면?`,
        answer: `${k.outK}（${k.outR}）`, speakText: k.outR.split(' / ')[0], note: k.note,
      })
    }
    if (modes.has('outin')) {
      out.push({
        key: `oi-${k.id}`, tag: 'そと → うち',
        prompt: `${k.outK}（${k.outR}）`, sub: `${k.ko} · 남에게 내 가족을 말한다면?`,
        answer: `${k.inK}（${k.inR}）`, speakText: k.inR.split(' / ')[0], note: k.note,
      })
    }
    if (modes.has('ko')) {
      out.push({
        key: `ko-${k.id}`, tag: '한국어 → うち',
        prompt: k.ko, sub: '남에게 내 가족을 말할 때',
        answer: `${k.inK}（${k.inR}）`, speakText: k.inR.split(' / ')[0], note: k.note,
      })
    }
  }
  return out
}


// ── 치트시트 ─────────────────────────────────────────────────────
function CheatSheet() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-3">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <span className="text-xs text-gray-400 font-semibold">📋 うち／そと 대조표</span>
        <span className="text-gray-600 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 font-bold border-b border-gray-800 pb-1 mb-1">
            <span>관계</span><span>うち (내 가족)</span><span>そと (남의 가족)</span>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {KIN.map(k => (
              <div key={k.id} className="grid grid-cols-3 gap-2 text-[11px]">
                <span className="text-gray-500 truncate">{k.ko}</span>
                <span className="text-blue-300">{k.inK}</span>
                <span className="text-amber-300">{k.outK}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 pt-2 mt-2 border-t border-gray-800">
            핵심 규칙: <span className="text-amber-400">남의 가족에는 お·ご가 붙고, 내 가족에는 붙지 않는다.</span>
            단 <span className="text-white">직접 부를 때</span>는 내 가족에게도 お父さん·お母さん을 씁니다.
            손아래(弟·妹·息子·娘)는 애초에 お가 붙지 않고 남의 가족일 때만 さん이 붙습니다.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 설정 화면 ────────────────────────────────────────────────────
function SettingsScreen({ onStart }: { onStart: (c: Card[]) => void }) {
  const [gens, setGens] = useState<Set<Gen>>(new Set(ALL_GENS))
  const [modes, setModes] = useState<Set<QMode>>(new Set(['read', 'inout']))
  const [count, setCount] = useState(20)

  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const n = new Set(set)
    n.has(v) ? n.delete(v) : n.add(v)
    fn(n)
  }

  const pool = useMemo(
    () => buildCards(KIN.filter(k => gens.has(k.gen)), modes),
    [gens, modes],
  )

  const handleStart = () => {
    if (!pool.length) return
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    onStart(count === 0 ? shuffled : shuffled.slice(0, count))
  }

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

      <RuleSheet slug="family-terms" />

      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">문제 유형</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_QMODES.map(m => (
            <button key={m} onClick={() => toggle(modes, m, setModes)}
              className={`px-3 py-2 rounded-lg text-left transition ${modes.has(m) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <span className="text-xs font-bold block">{QMODE_LABELS[m]}</span>
              <span className={`text-[10px] ${modes.has(m) ? 'text-blue-200' : 'text-gray-600'}`}>{QMODE_DESC[m]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">세대·관계 범위</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_GENS.map(g => (
            <button key={g} onClick={() => toggle(gens, g, setGens)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${gens.has(g) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {GEN_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <CheatSheet />

      <VoicePicker />

      <div className="bg-gray-900 rounded-xl p-4 mb-5">
        <p className="text-xs text-gray-500 mb-2">문제 수</p>
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
      </div>

      <p className="text-xs text-gray-600 text-center mb-4">
        전체 {pool.length}장 중 {count === 0 ? pool.length : Math.min(count, pool.length)}문제
      </p>

      <button onClick={handleStart} disabled={!pool.length}
        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 py-4 rounded-xl font-bold text-lg transition">
        연습 시작 →
      </button>
    </div>
  )
}

// ── 퀴즈 화면 ────────────────────────────────────────────────────
function QuizScreen({ cards, onDone }: { cards: Card[]; onDone: () => void }) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setReveal] = useState(false)
  const [mastered, setMastered] = useState(0)
  const [total] = useState(cards.length)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [showRule, setShowRule] = useState(false)
  const [speakRate, setSpeakRate] = useState(0.85)

  const current = queue[0]

  useEffect(() => {
    if (!autoSpeak || !current) return
    speak(current.prompt.replace(/（.*?）/g, ''), speakRate)
  }, [queue, autoSpeak, speakRate])

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
      {showRule && <RuleModal slug="family-terms" onClose={() => setShowRule(false)} />}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">남은 {queue.length}장 · 숙지 {mastered}/{total}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">速</span>
          <input type="range" min="0.5" max="1.2" step="0.05" value={speakRate}
            onChange={e => setSpeakRate(parseFloat(e.target.value))} className="w-14 accent-blue-500" />
          <button onClick={() => setShowRule(true)}
            className="text-[11px] px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 text-blue-300 font-bold transition">
            📘 규칙
          </button>
          {hasVoice() && (
            <button onClick={() => setAutoSpeak(v => !v)}
              className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-30'}`}>🔊</button>
          )}
        </div>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(mastered / total) * 100}%` }} />
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
        <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">{current.tag}</p>
        <p className="text-4xl font-bold mb-2 leading-snug">{current.prompt}</p>
        {current.sub && <p className="text-sm text-gray-500">{current.sub}</p>}
      </div>

      {!revealed ? (
        <button onClick={() => { setReveal(true); speak(current.speakText, speakRate) }}
          className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 hover:border-gray-500 mb-6">
          탭하여 정답 보기
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-6 border border-green-900 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">정답</p>
            <button onClick={() => speak(current.speakText, speakRate)}
              className="text-green-400 hover:text-green-300 text-lg transition">🔊</button>
          </div>
          <p className="text-3xl font-bold text-green-300 mb-1 leading-snug">{current.answer}</p>
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

// ── 메인 ────────────────────────────────────────────────────────
export default function FamilyTermsPage() {
  const [cards, setCards] = useState<Card[] | null>(null)
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT</Link>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">👨‍👩‍👧‍👦</span>
          <h1 className="text-2xl font-bold">親族呼称練習</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          대가족 관계 호칭 · うち／そと 변환 · {KIN.length}개 관계
        </p>
        {cards === null
          ? <SettingsScreen onStart={setCards} />
          : <QuizScreen cards={cards} onDone={() => setCards(null)} />
        }
      </div>
    </main>
  )
}
