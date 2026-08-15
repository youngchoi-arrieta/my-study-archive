'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════
//  数詞・助数詞練習
//  숫자 / 조수사 / 날짜 / 시간 / 금액 반사신경 트레이닝
//
//  설계 원칙: 조수사는 단어가 아니라 "음변화 규칙 세트"다.
//  조합을 통째로 암기하는 대신 규칙으로 생성하고,
//  규칙에서 벗어나는 것(=불규칙)만 골라 훈련할 수 있게 한다.
// ═══════════════════════════════════════════════════════════════

// ── 기본 수사 ────────────────────────────────────────────────────
const D1 = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']
const HYAKU = ['', 'ひゃく', 'にひゃく', 'さんびゃく', 'よんひゃく', 'ごひゃく', 'ろっぴゃく', 'ななひゃく', 'はっぴゃく', 'きゅうひゃく']
const SEN = ['', 'せん', 'にせん', 'さんぜん', 'よんせん', 'ごせん', 'ろくせん', 'ななせん', 'はっせん', 'きゅうせん']

/** 0~9999 읽기. fourOnes: 일의 자리 4를 'よん'이 아닌 'よ'로 읽어야 하는 조수사(円·人·時)용 */
function read4(n: number, fourOnes = 'よん'): string {
  const s = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100)
  const t = Math.floor((n % 100) / 10), o = n % 10
  const tens = t === 0 ? '' : t === 1 ? 'じゅう' : D1[t] + 'じゅう'
  const ones = o === 4 ? fourOnes : D1[o]
  return SEN[s] + HYAKU[h] + tens + ones
}

function readNumber(n: number, fourOnes = 'よん'): string {
  if (n === 0) return 'ゼロ'
  const oku = Math.floor(n / 100000000)
  const man = Math.floor((n % 100000000) / 10000)
  const rest = n % 10000
  let s = ''
  if (oku) s += read4(oku) + 'おく'
  if (man) s += read4(man) + 'まん'
  if (rest) s += read4(rest, fourOnes)
  return s
}

/** 백/천 자리에서 음변화가 일어나는가 (300·600·800·3000·8000) */
function hasBigIrregular(n: number): boolean {
  let x = n
  while (x > 0) {
    const chunk = x % 10000
    const h = Math.floor((chunk % 1000) / 100)
    const s = Math.floor(chunk / 1000)
    if (h === 3 || h === 6 || h === 8) return true
    if (s === 3 || s === 8) return true
    x = Math.floor(x / 10000)
  }
  return false
}

// ── 조수사 엔진 ──────────────────────────────────────────────────
type Row = 'h' | 'k' | 's' | 't' | 'plain'

interface Counter {
  id: string
  kanji: string
  reading: string
  row: Row
  meaning: string
  /** 규칙으로 안 나오는 형태를 통째로 지정 */
  overrides?: Record<number, string>
  /** 1~10 외에 추가로 낼 숫자 */
  extra?: number[]
}

const ROW_LABELS: Record<Row, string> = {
  h: 'は행', k: 'か행', s: 'さ행', t: 'た행', plain: '무변화',
}
const ROW_RULES: Record<Row, string> = {
  h: '1·6·8·10 → っ+ぱ행 / 3·何 → ん+ば행',
  k: '1·6·8·10 → っ (촉음화)',
  s: '1·8·10 → っ (6은 변하지 않음)',
  t: '1·8·10 → っ (촉음화)',
  plain: '음변화 없음 — 개별 예외만 주의',
}
const ALL_ROWS: Row[] = ['h', 'k', 's', 't', 'plain']

const P_SHIFT: Record<string, string> = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' }
const B_SHIFT: Record<string, string> = { は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' }
const GEM_STEM: Record<number, string> = { 1: 'いっ', 6: 'ろっ', 8: 'はっ', 10: 'じゅっ' }

const COUNTERS: Counter[] = [
  // は행
  { id: 'hon', kanji: '本', reading: 'ほん', row: 'h', meaning: '가늘고 긴 것 (병·연필·나무)' },
  { id: 'hai', kanji: '杯', reading: 'はい', row: 'h', meaning: '잔·그릇' },
  { id: 'hiki', kanji: '匹', reading: 'ひき', row: 'h', meaning: '작은 동물' },
  { id: 'fun', kanji: '分', reading: 'ふん', row: 'h', meaning: '분(시간)', overrides: { 3: 'さんぷん', 4: 'よんぷん' } },
  { id: 'haku', kanji: '泊', reading: 'はく', row: 'h', meaning: '숙박 일수' },
  // か행
  { id: 'ko', kanji: '個', reading: 'こ', row: 'k', meaning: '개 (물건 일반)' },
  { id: 'kai', kanji: '回', reading: 'かい', row: 'k', meaning: '회·번' },
  { id: 'kaiF', kanji: '階', reading: 'かい', row: 'k', meaning: '층', overrides: { 3: 'さんがい' } },
  { id: 'ken', kanji: '軒', reading: 'けん', row: 'k', meaning: '집·가게 채' },
  { id: 'kagetsu', kanji: 'ヶ月', reading: 'かげつ', row: 'k', meaning: '개월' },
  // さ행
  { id: 'sai', kanji: '歳', reading: 'さい', row: 's', meaning: '살 (나이)', overrides: { 20: 'はたち' }, extra: [20] },
  { id: 'satsu', kanji: '冊', reading: 'さつ', row: 's', meaning: '권 (책)' },
  { id: 'soku', kanji: '足', reading: 'そく', row: 's', meaning: '켤레' },
  { id: 'shuukan', kanji: '週間', reading: 'しゅうかん', row: 's', meaning: '주간' },
  // た행
  { id: 'tsuu', kanji: '通', reading: 'つう', row: 't', meaning: '통 (편지·서류)' },
  { id: 'chaku', kanji: '着', reading: 'ちゃく', row: 't', meaning: '벌 (옷)' },
  { id: 'choume', kanji: '丁目', reading: 'ちょうめ', row: 't', meaning: '정목 (주소)' },
  // 무변화
  { id: 'mai', kanji: '枚', reading: 'まい', row: 'plain', meaning: '장 (얇은 것)' },
  { id: 'dai', kanji: '台', reading: 'だい', row: 'plain', meaning: '대 (기계·차)' },
  { id: 'ban', kanji: '番', reading: 'ばん', row: 'plain', meaning: '번 (순서)' },
  {
    id: 'nin', kanji: '人', reading: 'にん', row: 'plain', meaning: '명 (사람)',
    overrides: { 1: 'ひとり', 2: 'ふたり', 4: 'よにん', 7: 'しちにん' },
  },
  { id: 'en', kanji: '円', reading: 'えん', row: 'plain', meaning: '엔 (금액)', overrides: { 4: 'よえん' } },
  { id: 'nen', kanji: '年', reading: 'ねん', row: 'plain', meaning: '년', overrides: { 4: 'よねん' } },
  { id: 'do', kanji: '度', reading: 'ど', row: 'plain', meaning: '도 (온도·횟수)' },
]

/** 규칙만 적용했을 때의 형태 (= 예외 판정 기준) */
function plainForm(n: number, c: Counter): string {
  return readNumber(n) + c.reading
}

function readCounter(n: number, c: Counter): string {
  const ov = c.overrides?.[n]
  if (ov) return ov

  const head = c.reading[0]
  const tail = c.reading.slice(1)

  if (c.row === 'h') {
    if (GEM_STEM[n]) return GEM_STEM[n] + (P_SHIFT[head] ?? head) + tail
    if (n === 3) return 'さん' + (B_SHIFT[head] ?? head) + tail
  }
  if (c.row === 'k' && GEM_STEM[n]) return GEM_STEM[n] + c.reading
  if ((c.row === 's' || c.row === 't') && GEM_STEM[n] && n !== 6) return GEM_STEM[n] + c.reading

  return readNumber(n) + c.reading
}

// ── 和語数詞 ─────────────────────────────────────────────────────
const WAGO = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお']

// ── 날짜 ─────────────────────────────────────────────────────────
const MONTHS = ['', 'いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ',
  'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ']
const DAYS = ['', 'ついたち', 'ふつか', 'みっか', 'よっか', 'いつか', 'むいか', 'なのか', 'ようか', 'ここのか', 'とおか',
  'じゅういちにち', 'じゅうににち', 'じゅうさんにち', 'じゅうよっか', 'じゅうごにち', 'じゅうろくにち',
  'じゅうしちにち', 'じゅうはちにち', 'じゅうくにち', 'はつか',
  'にじゅういちにち', 'にじゅうににち', 'にじゅうさんにち', 'にじゅうよっか', 'にじゅうごにち',
  'にじゅうろくにち', 'にじゅうしちにち', 'にじゅうはちにち', 'にじゅうくにち', 'さんじゅうにち', 'さんじゅういちにち']
const IRREGULAR_DAYS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 20, 24])
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// ── 시각 ─────────────────────────────────────────────────────────
const HOURS = ['', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ',
  'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ']
const MIN_UNIT = ['', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん']

function readMinute(m: number): string {
  const t = Math.floor(m / 10), o = m % 10
  if (o === 0) return (t === 1 ? '' : D1[t]) + 'じゅっぷん'
  const tens = t === 0 ? '' : t === 1 ? 'じゅう' : D1[t] + 'じゅう'
  return tens + MIN_UNIT[o]
}

// ── 카드 ─────────────────────────────────────────────────────────
type CatKey = 'counter' | 'wago' | 'number' | 'money' | 'date' | 'time' | 'wareki'

const CAT_LABELS: Record<CatKey, string> = {
  counter: '助数詞', wago: '和語数詞', number: '数字', money: '金額', date: '日付', time: '時刻', wareki: '和暦',
}
const CAT_DESC: Record<CatKey, string> = {
  counter: '조수사 × 숫자 음변화',
  wago: 'ひとつ〜とお',
  number: '자릿수 읽기 (万 단위)',
  money: '〜円 가격 읽기',
  date: '〜月〜日',
  time: '〜時〜分',
  wareki: '西暦 ↔ 令和·平成·昭和',
}
const ALL_CATS = Object.keys(CAT_LABELS) as CatKey[]

interface Card {
  key: string
  cat: CatKey
  prompt: string      // 화면에 보여줄 표기 (8本 / 12,345 / 4月14日)
  sub?: string        // 힌트·의미
  answer: string      // 읽기
  irregular: boolean
  note?: string       // 정답 화면 보조 설명
}

const DIGIT_OPTIONS = [
  { key: 'h', label: '百 (2~3자리)', min: 10, max: 999 },
  { key: 'm', label: '千 (4자리)', min: 1000, max: 9999 },
  { key: 'w', label: '万 (5~6자리)', min: 10000, max: 999999 },
  { key: 'b', label: '百万↑ (7~8자리)', min: 1000000, max: 99999999 },
] as const
type DigitKey = typeof DIGIT_OPTIONS[number]['key']

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const comma = (n: number) => n.toLocaleString('en-US')

function buildCounterCards(rows: Set<Row>): Card[] {
  const out: Card[] = []
  for (const c of COUNTERS) {
    if (!rows.has(c.row)) continue
    const nums = [...Array.from({ length: 10 }, (_, i) => i + 1), ...(c.extra ?? [])]
    for (const n of nums) {
      const answer = readCounter(n, c)
      out.push({
        key: `c-${c.id}-${n}`,
        cat: 'counter',
        prompt: `${n}${c.kanji}`,
        sub: `${c.meaning} · ${ROW_LABELS[c.row]}`,
        answer,
        irregular: answer !== plainForm(n, c),
        note: answer !== plainForm(n, c) ? `규칙형이라면 ${plainForm(n, c)} — 여기서 깨집니다` : ROW_RULES[c.row],
      })
    }
  }
  return out
}

function buildWagoCards(): Card[] {
  return Array.from({ length: 10 }, (_, i) => {
    const n = i + 1
    return {
      key: `w-${n}`,
      cat: 'wago' as CatKey,
      prompt: n === 10 ? '十' : `${n}つ`,
      sub: '和語数詞',
      answer: WAGO[n],
      irregular: true,
      note: '음독이 아니라 고유수사 — 10은 とお (つ 없음)',
    }
  })
}

function makeNumberCard(digits: DigitKey[], irregularOnly: boolean): Card {
  for (let i = 0; i < 60; i++) {
    const d = DIGIT_OPTIONS.find(o => o.key === digits[rand(0, digits.length - 1)])!
    const n = rand(d.min, d.max)
    const irr = hasBigIrregular(n)
    if (irregularOnly && !irr) continue
    return {
      key: `n-${n}-${Math.random()}`,
      cat: 'number',
      prompt: comma(n),
      sub: '숫자 읽기',
      answer: readNumber(n),
      irregular: irr,
      note: '4자리마다 끊어 万·億을 먼저 잡기',
    }
  }
  const n = 386
  return { key: `n-fb-${Math.random()}`, cat: 'number', prompt: comma(n), sub: '숫자 읽기', answer: readNumber(n), irregular: true }
}

function makeMoneyCard(digits: DigitKey[], irregularOnly: boolean): Card {
  for (let i = 0; i < 60; i++) {
    const d = DIGIT_OPTIONS.find(o => o.key === digits[rand(0, digits.length - 1)])!
    const n = rand(d.min, d.max)
    const irr = hasBigIrregular(n) || n % 10 === 4
    if (irregularOnly && !irr) continue
    return {
      key: `m-${n}-${Math.random()}`,
      cat: 'money',
      prompt: `${comma(n)}円`,
      sub: '금액',
      answer: readNumber(n, 'よ') + 'えん',
      irregular: irr,
      note: '円은 음변화 없음 · 다만 일의 자리 4는 よえん',
    }
  }
  const n = 1480
  return { key: `m-fb-${Math.random()}`, cat: 'money', prompt: `${comma(n)}円`, sub: '금액', answer: readNumber(n, 'よ') + 'えん', irregular: true }
}

function makeDateCard(irregularOnly: boolean): Card {
  for (let i = 0; i < 60; i++) {
    const mo = rand(1, 12)
    const dy = rand(1, DAYS_IN_MONTH[mo])
    const irr = IRREGULAR_DAYS.has(dy) || mo === 4 || mo === 7 || mo === 9
    if (irregularOnly && !irr) continue
    return {
      key: `d-${mo}-${dy}-${Math.random()}`,
      cat: 'date',
      prompt: `${mo}月${dy}日`,
      sub: '날짜',
      answer: `${MONTHS[mo]}${DAYS[dy]}`,
      irregular: irr,
      note: '月은 4·7·9만 예외 · 日은 1〜10 전부 和語 + 14·20·24',
    }
  }
  return { key: `d-fb-${Math.random()}`, cat: 'date', prompt: '4月20日', sub: '날짜', answer: 'しがつはつか', irregular: true }
}

function makeTimeCard(irregularOnly: boolean): Card {
  for (let i = 0; i < 60; i++) {
    const h = rand(1, 12)
    const m = rand(1, 59)
    const o = m % 10
    const irr = h === 4 || h === 7 || h === 9 || [0, 1, 3, 4, 6, 8].includes(o)
    if (irregularOnly && !irr) continue
    return {
      key: `t-${h}-${m}-${Math.random()}`,
      cat: 'time',
      prompt: `${h}時${m}分`,
      sub: '시각',
      answer: `${HOURS[h]}${readMinute(m)}`,
      irregular: irr,
      note: m === 30 ? '30분은 〜半(はん)으로도' : '分은 は행 규칙 · 단 3分만 さんぷん',
    }
  }
  return { key: `t-fb-${Math.random()}`, cat: 'time', prompt: '4時8分', sub: '시각', answer: 'よじはっぷん', irregular: true }
}

// ── 和暦 ─────────────────────────────────────────────────────────
const ERAS = [
  { name: '令和', kana: 'れいわ', from: 2019, base: 2018 },
  { name: '平成', kana: 'へいせい', from: 1989, base: 1988 },
  { name: '昭和', kana: 'しょうわ', from: 1926, base: 1925 },
  { name: '大正', kana: 'たいしょう', from: 1912, base: 1911 },
  { name: '明治', kana: 'めいじ', from: 1868, base: 1867 },
]
const BOUNDARY = new Set(ERAS.map(e => e.from))

function toWareki(y: number) {
  const e = ERAS.find(x => y >= x.from) ?? ERAS[ERAS.length - 1]
  const n = y - e.base
  const label = n === 1 ? `${e.name}元年` : `${e.name}${n}年`
  const reading = n === 1 ? `${e.kana}がんねん` : `${e.kana}${readNumber(n)}ねん`
  return { e, n, label, reading }
}

function makeWarekiCard(irregularOnly: boolean): Card {
  for (let i = 0; i < 60; i++) {
    const y = rand(1926, 2026)
    const w = toWareki(y)
    const irr = w.n === 1 || BOUNDARY.has(y)
    if (irregularOnly && !irr) continue
    const reverse = Math.random() < 0.5
    const note = BOUNDARY.has(y)
      ? `${y}년은 연호가 바뀐 해 — 앞부분은 이전 연호로도 셈 (${w.e.name}는 ${w.e.from}년부터)`
      : `${w.e.name} = 西暦 − ${w.e.base}`
    return reverse
      ? {
        key: `wa-r-${y}-${Math.random()}`, cat: 'wareki',
        prompt: w.label, sub: '西暦으로는?',
        answer: `${y}年（${readNumber(y)}ねん）`, irregular: irr, note,
      }
      : {
        key: `wa-${y}-${Math.random()}`, cat: 'wareki',
        prompt: `西暦 ${y}年`, sub: '和暦으로는?',
        answer: `${w.label}（${w.reading}）`, irregular: irr, note,
      }
  }
  const w = toWareki(2019)
  return {
    key: `wa-fb-${Math.random()}`, cat: 'wareki', prompt: '西暦 2019年', sub: '和暦으로는?',
    answer: `${w.label}（${w.reading}）`, irregular: true,
    note: '2019년은 平成31년이자 令和元年',
  }
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

type Direction = 'read' | 'listen'

// ── 치트시트 ─────────────────────────────────────────────────────
function CheatSheet() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-3">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between text-left">
        <span className="text-xs text-gray-400 font-semibold">📋 音変化 치트시트</span>
        <span className="text-gray-600 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs">
          {ALL_ROWS.map(r => (
            <div key={r} className="flex gap-3 items-start">
              <span className="shrink-0 w-14 font-bold text-blue-400">{ROW_LABELS[r]}</span>
              <div className="min-w-0">
                <p className="text-gray-300">{ROW_RULES[r]}</p>
                <p className="text-gray-600 mt-0.5">
                  {COUNTERS.filter(c => c.row === r).map(c => c.kanji).join(' · ')}
                </p>
              </div>
            </div>
          ))}
          <p className="text-gray-500 pt-2 border-t border-gray-800">
            음변화를 일으키는 숫자는 <span className="text-amber-400 font-bold">1 · 6 · 8 · 10</span>
            (+3 · 何)뿐. 2 · 5 · 7 · 9는 어떤 조수사에서도 변하지 않습니다.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 설정 화면 ────────────────────────────────────────────────────
function SettingsScreen({ onStart }: { onStart: (c: Card[], d: Direction) => void }) {
  const [cats, setCats] = useState<Set<CatKey>>(new Set(['counter']))
  const [rows, setRows] = useState<Set<Row>>(new Set(['h', 'k', 's', 't', 'plain']))
  const [digits, setDigits] = useState<Set<DigitKey>>(new Set(['m', 'w']))
  const [irregularOnly, setIrregularOnly] = useState(true)
  const [direction, setDirection] = useState<Direction>('read')
  const [count, setCount] = useState(20)

  const toggle = <T,>(set: Set<T>, v: T, fn: (s: Set<T>) => void) => {
    const n = new Set(set)
    n.has(v) ? n.delete(v) : n.add(v)
    fn(n)
  }

  const needsRows = cats.has('counter')
  const needsDigits = cats.has('number') || cats.has('money')

  const finitePool = useMemo(() => {
    const p: Card[] = []
    if (cats.has('counter')) p.push(...buildCounterCards(rows))
    if (cats.has('wago')) p.push(...buildWagoCards())
    return irregularOnly ? p.filter(c => c.irregular) : p
  }, [cats, rows, irregularOnly])

  const hasGenerative = cats.has('number') || cats.has('money') || cats.has('date')
    || cats.has('time') || cats.has('wareki')
  const ready = cats.size > 0
    && (!needsRows || rows.size > 0)
    && (!needsDigits || digits.size > 0)
    && (finitePool.length > 0 || hasGenerative)

  const handleStart = () => {
    const target = count === 0 ? Math.max(finitePool.length, 40) : count
    const pool: Card[] = [...finitePool]
    const digitArr = [...digits]
    const gen: (() => Card)[] = []
    if (cats.has('number') && digitArr.length) gen.push(() => makeNumberCard(digitArr, irregularOnly))
    if (cats.has('money') && digitArr.length) gen.push(() => makeMoneyCard(digitArr, irregularOnly))
    if (cats.has('date')) gen.push(() => makeDateCard(irregularOnly))
    if (cats.has('time')) gen.push(() => makeTimeCard(irregularOnly))
    if (cats.has('wareki')) gen.push(() => makeWarekiCard(irregularOnly))
    if (gen.length) {
      const need = Math.max(target - pool.length, gen.length * 8)
      for (let i = 0; i < need; i++) pool.push(gen[i % gen.length]())
    }
    if (!pool.length) return
    const shuffled = pool.sort(() => Math.random() - 0.5)
    onStart(shuffled.slice(0, target), direction)
  }

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">카테고리</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_CATS.map(c => (
            <button key={c} onClick={() => toggle(cats, c, setCats)}
              className={`px-3 py-2 rounded-lg text-left transition ${cats.has(c) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              <span className="text-xs font-bold block">{CAT_LABELS[c]}</span>
              <span className={`text-[10px] ${cats.has(c) ? 'text-blue-200' : 'text-gray-600'}`}>{CAT_DESC[c]}</span>
            </button>
          ))}
        </div>
      </div>

      {needsRows && (
        <div className="bg-gray-900 rounded-xl p-4 mb-3">
          <p className="text-xs text-gray-500 mb-2">조수사 그룹</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROWS.map(r => (
              <button key={r} onClick={() => toggle(rows, r, setRows)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${rows.has(r) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {ROW_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsDigits && (
        <div className="bg-gray-900 rounded-xl p-4 mb-3">
          <p className="text-xs text-gray-500 mb-2">자릿수</p>
          <div className="flex flex-wrap gap-1.5">
            {DIGIT_OPTIONS.map(d => (
              <button key={d.key} onClick={() => toggle(digits, d.key, setDigits)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${digits.has(d.key) ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">출제 방향</p>
        <div className="flex gap-2">
          <button onClick={() => setDirection('read')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${direction === 'read' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            👁 표기 → 읽기
          </button>
          <button onClick={() => setDirection('listen')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${direction === 'listen' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            👂 음성 → 숫자
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          숫자는 실전에서 대부분 귀로 들어옵니다. 한 바퀴 돈 뒤에는 음성 방향으로 뒤집어 보세요.
        </p>
      </div>

      <button onClick={() => setIrregularOnly(v => !v)}
        className={`w-full rounded-xl p-4 mb-3 text-left transition ${irregularOnly ? 'bg-red-950/60 border border-red-900' : 'bg-gray-900 border border-transparent'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{irregularOnly ? '🔥 불규칙만' : '전체 조합'}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {irregularOnly ? '규칙에서 벗어나는 것만 출제 — 실제로 외울 것은 이쪽뿐' : '규칙형까지 포함 (초반 감 잡기용)'}
            </p>
          </div>
          <span className={`w-10 h-6 rounded-full flex items-center px-0.5 transition ${irregularOnly ? 'bg-red-600 justify-end' : 'bg-gray-700 justify-start'}`}>
            <span className="w-5 h-5 bg-white rounded-full block" />
          </span>
        </div>
      </button>

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
        고정 카드 {finitePool.length}장{hasGenerative && ' + 무작위 생성'}
      </p>

      <button onClick={handleStart} disabled={!ready}
        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 py-4 rounded-xl font-bold text-lg transition">
        연습 시작 →
      </button>
    </div>
  )
}

// ── 퀴즈 화면 ────────────────────────────────────────────────────
function QuizScreen({ cards, direction, onDone }: { cards: Card[]; direction: Direction; onDone: () => void }) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setReveal] = useState(false)
  const [mastered, setMastered] = useState(0)
  const [total] = useState(cards.length)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [speakRate, setSpeakRate] = useState(0.8)

  const current = queue[0]

  useEffect(() => {
    if (!current) return
    if (direction === 'listen') { speak(current.answer, speakRate); return }
    if (autoSpeak) speak(current.prompt.replace(/,/g, ''), speakRate)
  }, [queue, autoSpeak, speakRate, direction])

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
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-blue-400 font-semibold uppercase tracking-widest">
            {CAT_LABELS[current.cat]}
          </p>
          {current.irregular && (
            <span className="text-[10px] bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-bold">불규칙</span>
          )}
        </div>

        {direction === 'listen' ? (
          <div className="text-center py-4">
            <button onClick={() => speak(current.answer, speakRate)}
              className="text-6xl hover:scale-110 transition">🔊</button>
            <p className="text-sm text-gray-500 mt-3">들리는 대로 숫자를 적어보세요</p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold mb-1">{current.prompt}</p>
              {current.sub && <p className="text-sm text-gray-500">{current.sub}</p>}
            </div>
            <button onClick={() => speak(current.answer, speakRate)}
              className="text-blue-400 hover:text-blue-300 text-2xl transition">🔊</button>
          </div>
        )}
      </div>

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
          {direction === 'listen' && (
            <p className="text-3xl font-bold text-white mb-2">{current.prompt}</p>
          )}
          <p className="text-3xl font-bold text-green-300 mb-1">{current.answer}</p>
          {current.note && <p className="text-xs text-gray-500 mt-2">{current.note}</p>}
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
export default function NumberPracticePage() {
  const [session, setSession] = useState<{ cards: Card[]; direction: Direction } | null>(null)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT</Link>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🔢</span>
          <h1 className="text-2xl font-bold">数詞・助数詞練習</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          숫자 · 조수사 · 날짜 · 시간 · 금액 반사신경 트레이닝 · 조수사 {COUNTERS.length}종
        </p>
        {session === null
          ? <SettingsScreen onStart={(cards, direction) => setSession({ cards, direction })} />
          : <QuizScreen cards={session.cards} direction={session.direction} onDone={() => setSession(null)} />
        }
      </div>
    </main>
  )
}
