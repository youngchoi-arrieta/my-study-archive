'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
//  役職・呼称練習
//  회사 직급 호칭 — 序列(서열) + 社内／社外(내외) 축
//
//  親族의 うち／そと가 회사에서는 自社／他社로 그대로 반복된다.
//  「田中部長」(사내) ↔ 「部長の田中」(사외)가 「父」↔「お父さん」과
//  같은 구조라는 것이 이 트레이너의 뼈대.
// ═══════════════════════════════════════════════════════════════

type Cat = 'exec' | 'middle' | 'staff' | 'other' | 'relation'

const CAT_LABELS: Record<Cat, string> = {
  exec: '경영진 (会長〜常務)',
  middle: '관리직 (本部長〜係長)',
  staff: '실무·고용형태',
  other: '기타 직책 (支店長·顧問 등)',
  relation: '관계 호칭 (上司·先輩 등)',
}
const ALL_CATS = Object.keys(CAT_LABELS) as Cat[]

interface Post {
  id: string
  kanji: string
  kana: string
  ko: string
  cat: Cat
  rank?: number   // 낮을수록 상위. 서열 문제에만 사용
  note?: string
}

const POSTS: Post[] = [
  // 경영진
  { id: 'kaicho', kanji: '会長', kana: 'かいちょう', ko: '회장', cat: 'exec', rank: 1 },
  { id: 'shacho', kanji: '社長', kana: 'しゃちょう', ko: '사장', cat: 'exec', rank: 2, note: '代表取締役社長이 정식 명칭인 경우가 많음' },
  { id: 'fukushacho', kanji: '副社長', kana: 'ふくしゃちょう', ko: '부사장', cat: 'exec', rank: 3 },
  { id: 'senmu', kanji: '専務', kana: 'せんむ', ko: '전무', cat: 'exec', rank: 4, note: '정식은 専務取締役(せんむとりしまりやく)' },
  { id: 'jomu', kanji: '常務', kana: 'じょうむ', ko: '상무', cat: 'exec', rank: 5, note: '専務가 常務보다 위' },
  { id: 'torishimariyaku', kanji: '取締役', kana: 'とりしまりやく', ko: '이사', cat: 'exec', note: '직급이 아니라 법적 지위 — 部長과 겸임 가능' },
  { id: 'shikkoyakuin', kanji: '執行役員', kana: 'しっこうやくいん', ko: '집행임원', cat: 'exec' },
  { id: 'kansayaku', kanji: '監査役', kana: 'かんさやく', ko: '감사', cat: 'exec' },
  // 관리직
  { id: 'honbucho', kanji: '本部長', kana: 'ほんぶちょう', ko: '본부장', cat: 'middle', rank: 6 },
  { id: 'bucho', kanji: '部長', kana: 'ぶちょう', ko: '부장', cat: 'middle', rank: 7 },
  { id: 'jicho', kanji: '次長', kana: 'じちょう', ko: '차장', cat: 'middle', rank: 8 },
  { id: 'kacho', kanji: '課長', kana: 'かちょう', ko: '과장', cat: 'middle', rank: 9 },
  { id: 'kachodairi', kanji: '課長代理', kana: 'かちょうだいり', ko: '과장대리', cat: 'middle', note: '代理·補佐(ほさ)는 해당 직급 바로 아래' },
  { id: 'kakaricho', kanji: '係長', kana: 'かかりちょう', ko: '계장', cat: 'middle', rank: 10 },
  { id: 'shunin', kanji: '主任', kana: 'しゅにん', ko: '주임', cat: 'middle', rank: 11 },
  // 실무·고용형태
  { id: 'hirashain', kanji: '平社員', kana: 'ひらしゃいん', ko: '평사원', cat: 'staff', rank: 12 },
  { id: 'seishain', kanji: '正社員', kana: 'せいしゃいん', ko: '정규직', cat: 'staff' },
  { id: 'keiyaku', kanji: '契約社員', kana: 'けいやくしゃいん', ko: '계약직', cat: 'staff' },
  { id: 'haken', kanji: '派遣社員', kana: 'はけんしゃいん', ko: '파견직', cat: 'staff' },
  { id: 'shinnyu', kanji: '新入社員', kana: 'しんにゅうしゃいん', ko: '신입사원', cat: 'staff' },
  // 기타 직책
  { id: 'shitencho', kanji: '支店長', kana: 'してんちょう', ko: '지점장', cat: 'other' },
  { id: 'tencho', kanji: '店長', kana: 'てんちょう', ko: '점장', cat: 'other' },
  { id: 'kojocho', kanji: '工場長', kana: 'こうじょうちょう', ko: '공장장', cat: 'other' },
  { id: 'komon', kanji: '顧問', kana: 'こもん', ko: '고문', cat: 'other' },
  { id: 'sodanyaku', kanji: '相談役', kana: 'そうだんやく', ko: '상담역', cat: 'other' },
  { id: 'hisho', kanji: '秘書', kana: 'ひしょ', ko: '비서', cat: 'other' },
  { id: 'tantosha', kanji: '担当者', kana: 'たんとうしゃ', ko: '담당자', cat: 'other' },
  // 관계 호칭
  { id: 'joshi', kanji: '上司', kana: 'じょうし', ko: '상사', cat: 'relation' },
  { id: 'buka', kanji: '部下', kana: 'ぶか', ko: '부하', cat: 'relation' },
  { id: 'doryo', kanji: '同僚', kana: 'どうりょう', ko: '동료', cat: 'relation' },
  { id: 'senpai', kanji: '先輩', kana: 'せんぱい', ko: '선배', cat: 'relation' },
  { id: 'kohai', kanji: '後輩', kana: 'こうはい', ko: '후배', cat: 'relation' },
  { id: 'torihikisaki', kanji: '取引先', kana: 'とりひきさき', ko: '거래처', cat: 'relation' },
]

// ── 社内／社外 경어 고정 덱 ──────────────────────────────────────
interface KeigoItem { q: string; sub: string; a: string; speak: string; note?: string }

const KEIGO: KeigoItem[] = [
  {
    q: '자기 회사 (말할 때)', sub: '거래처 앞에서 우리 회사를 부르면?',
    a: '弊社（へいしゃ）', speak: 'へいしゃ',
    note: '문서에서는 当社(とうしゃ)도 씀. 私ども(わたくしども)는 더 부드러운 표현',
  },
  {
    q: '상대 회사 (말할 때)', sub: '대화에서 상대 회사를 부르면?',
    a: '御社（おんしゃ）', speak: 'おんしゃ',
    note: '말할 때 御社 / 문서에 쓸 때 貴社(きしゃ) — 이 구분이 자주 틀림',
  },
  {
    q: '상대 회사 (쓸 때)', sub: '메일·문서에서 상대 회사를 부르면?',
    a: '貴社（きしゃ）', speak: 'きしゃ',
  },
  {
    q: '사내에서 상사를 부를 때', sub: '田中라는 部長를 사내에서 부르면?',
    a: '田中部長（たなかぶちょう）', speak: 'たなかぶちょう',
    note: '役職 자체가 敬称이므로 「田中部長さん」은 틀림',
  },
  {
    q: '사외 사람에게 자기 상사를 말할 때', sub: '거래처에 우리 部長 田中를 말하면?',
    a: '部長の田中 / 田中（경칭 없음）', speak: 'ぶちょうのたなか',
    note: '親族의 「父」와 같은 구조 — 우리 편은 낮춘다. 「田中部長」이라 하면 실례',
  },
  {
    q: '자기 상사가 자리에 없을 때', sub: '외부 전화에 대응하면?',
    a: '席を外しております（せきをはずしております）', speak: 'せきをはずしております',
    note: '「いらっしゃいません」은 자기 편에 존경어를 쓴 오류',
  },
  {
    q: '사외 사람을 부를 때', sub: '거래처 담당자를 부르면?',
    a: '○○様（さま） / ご担当者様', speak: 'さま',
  },
  {
    q: '윗사람에게 「수고하셨습니다」', sub: '상사에게 쓰는 인사는?',
    a: 'お疲れ様です（おつかれさまです）', speak: 'おつかれさまです',
    note: '「ご苦労様」는 윗사람이 아랫사람에게 쓰는 말 — 상사에게 쓰면 실례',
  },
  {
    q: '윗사람에게 「알겠습니다」', sub: '지시를 받았을 때는?',
    a: '承知しました / かしこまりました', speak: 'しょうちしました',
    note: '「了解しました」는 동료·아랫사람용',
  },
  {
    q: '자기 회사 사람의 행동 (사외 대상)', sub: '「우리 사장이 말했다」를 사외에 말하면?',
    a: '社長の○○が申しております', speak: 'もうしております',
    note: '言う → 申す(겸양). 자기 회사 사장에게도 존경어를 쓰지 않음',
  },
  {
    q: '상대 회사 사람의 행동', sub: '「귀사의 部長님이 말씀하셨다」는?',
    a: '御社の部長様がおっしゃいました', speak: 'おっしゃいました',
    note: '言う → おっしゃる(존경)',
  },
  {
    q: '명함을 건넬 때', sub: '자기소개 정형구는?',
    a: '○○社の△△と申します', speak: 'ともうします',
  },
]

// ── 문제 유형 ────────────────────────────────────────────────────
type QMode = 'read' | 'ko' | 'rank' | 'compare' | 'keigo'

const QMODE_LABELS: Record<QMode, string> = {
  read: '표기 → 읽기',
  ko: '한국어 → 일본어',
  rank: '서열 (위·아래)',
  compare: '둘 중 상위는?',
  keigo: '社内／社外 경어',
}
const QMODE_DESC: Record<QMode, string> = {
  read: '직급 한자의 읽기',
  ko: '한국 직급명에 대응하는 일본어',
  rank: '이 직급의 바로 위·아래',
  compare: '무작위 두 직급의 상하 판정',
  keigo: '弊社／御社 · 호칭 규칙',
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

const RANKED = POSTS.filter(p => p.rank !== undefined).sort((a, b) => a.rank! - b.rank!)
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

function buildCards(posts: Post[], modes: Set<QMode>, genCount: number): Card[] {
  const out: Card[] = []

  for (const p of posts) {
    if (modes.has('read')) {
      out.push({
        key: `r-${p.id}`, tag: '読み方',
        prompt: p.kanji, sub: p.ko,
        answer: p.kana, speakText: p.kana, note: p.note,
      })
    }
    if (modes.has('ko')) {
      out.push({
        key: `k-${p.id}`, tag: '한국어 → 일본어',
        prompt: p.ko, sub: '일본 회사에서는?',
        answer: `${p.kanji}（${p.kana}）`, speakText: p.kana, note: p.note,
      })
    }
    if (modes.has('rank') && p.rank !== undefined) {
      const i = RANKED.findIndex(r => r.id === p.id)
      const up = i > 0 ? RANKED[i - 1] : null
      const down = i < RANKED.length - 1 ? RANKED[i + 1] : null
      out.push({
        key: `rk-${p.id}`, tag: '序列',
        prompt: `${p.kanji}（${p.kana}）`, sub: '바로 위 / 바로 아래는?',
        answer: `↑ ${up ? `${up.kanji}（${up.kana}）` : '최상위'}\n↓ ${down ? `${down.kanji}（${down.kana}）` : '최하위'}`,
        speakText: p.kana,
        note: `전체 ${RANKED.length}단계 중 ${i + 1}번째`,
      })
    }
  }

  if (modes.has('keigo')) {
    KEIGO.forEach((k, i) => out.push({
      key: `kg-${i}`, tag: '社内／社外',
      prompt: k.q, sub: k.sub, answer: k.a, speakText: k.speak, note: k.note,
    }))
  }

  if (modes.has('compare')) {
    const seen = new Set<string>()
    for (let n = 0; n < genCount * 2 && seen.size < genCount; n++) {
      const a = RANKED[rand(0, RANKED.length - 1)]
      const b = RANKED[rand(0, RANKED.length - 1)]
      if (a.id === b.id) continue
      const key = [a.id, b.id].sort().join('-')
      if (seen.has(key)) continue
      seen.add(key)
      const hi = a.rank! < b.rank! ? a : b
      const lo = a.rank! < b.rank! ? b : a
      out.push({
        key: `cmp-${key}`, tag: '上下判定',
        prompt: `${a.kanji} ・ ${b.kanji}`, sub: '어느 쪽이 위?',
        answer: `${hi.kanji}（${hi.kana}）が上`, speakText: hi.kana,
        note: `${hi.ko} > ${lo.ko}`,
      })
    }
  }

  return out
}

// ── TTS ──────────────────────────────────────────────────────────
function speak(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = rate
  window.speechSynthesis.speak(u)
}

// ── 치트시트 ─────────────────────────────────────────────────────
function CheatSheet() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-3">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <span className="text-xs text-gray-400 font-semibold">📋 役職 序列表</span>
        <span className="text-gray-600 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <div className="space-y-1">
            {RANKED.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-5 text-gray-700 text-right">{i + 1}</span>
                <span className="w-20 font-bold text-white">{p.kanji}</span>
                <span className="w-24 text-blue-300">{p.kana}</span>
                <span className="text-gray-500">{p.ko}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 pt-2 mt-2 border-t border-gray-800 leading-relaxed">
            회사마다 편차가 있고, <span className="text-white">取締役·執行役員</span>은 서열이 아니라 법적·제도적 지위라 部長 등과 겸임합니다.
            <br />
            핵심 규칙: <span className="text-amber-400">役職名 자체가 敬称</span>이라 「田中部長さん」은 틀립니다.
            그리고 사외에서는 자기 상사를 낮춰 <span className="text-amber-400">「部長の田中」</span> — 親族의 「父」와 같은 구조입니다.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 설정 화면 ────────────────────────────────────────────────────
function SettingsScreen({ onStart }: { onStart: (c: Card[]) => void }) {
  const [cats, setCats] = useState<Set<Cat>>(new Set(ALL_CATS))
  const [modes, setModes] = useState<Set<QMode>>(new Set(['read', 'rank']))
  const [count, setCount] = useState(20)

  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const n = new Set(set)
    n.has(v) ? n.delete(v) : n.add(v)
    fn(n)
  }

  const needsCats = modes.has('read') || modes.has('ko') || modes.has('rank')

  const pool = useMemo(
    () => buildCards(POSTS.filter(p => cats.has(p.cat)), modes, count === 0 ? 30 : count),
    [cats, modes, count],
  )

  const handleStart = () => {
    if (!pool.length) return
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    onStart(count === 0 ? shuffled : shuffled.slice(0, count))
  }

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

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

      {needsCats && (
        <div className="bg-gray-900 rounded-xl p-4 mb-3">
          <p className="text-xs text-gray-500 mb-2">직급 범위</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATS.map(c => (
              <button key={c} onClick={() => toggle(cats, c, setCats)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${cats.has(c) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {CAT_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      )}

      <CheatSheet />

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
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">남은 {queue.length}장 · 숙지 {mastered}/{total}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">速</span>
          <input type="range" min="0.5" max="1.2" step="0.05" value={speakRate}
            onChange={e => setSpeakRate(parseFloat(e.target.value))} className="w-14 accent-blue-500" />
          <button onClick={() => setAutoSpeak(v => !v)}
            className={`text-lg transition ${autoSpeak ? 'opacity-100' : 'opacity-30'}`}>🔊</button>
        </div>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(mastered / total) * 100}%` }} />
      </div>

      <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-900">
        <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest mb-3">{current.tag}</p>
        <p className="text-3xl font-bold mb-2 leading-snug">{current.prompt}</p>
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

// ── 메인 ────────────────────────────────────────────────────────
export default function BusinessTitlesPage() {
  const [cards, setCards] = useState<Card[] | null>(null)
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT</Link>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🏢</span>
          <h1 className="text-2xl font-bold">役職・呼称練習</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          회사 직급 서열 · 社内／社外 경어 · 직책 {POSTS.length}종
        </p>
        {cards === null
          ? <SettingsScreen onStart={setCards} />
          : <QuizScreen cards={cards} onDone={() => setCards(null)} />
        }
      </div>
    </main>
  )
}
