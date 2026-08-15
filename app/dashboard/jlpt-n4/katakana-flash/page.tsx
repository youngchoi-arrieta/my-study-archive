'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  TrainerLayout, Panel, ChipRow, ModeGrid, CheatBox, StartButton,
  speak, shuffle, toggleIn, RuleSheet, VoicePicker,
} from '../_components/TrainerShell'

// ═══════════════════════════════════════════════════════════════
//  カタカナ速読
//  다른 트레이너와 달리 "아느냐"가 아니라 "얼마나 빨리 아느냐"를
//  훈련한다. 그래서 뒤집는 카드가 아니라 순간노출(tachistoscope) +
//  자동채점 + 반응시간 측정 구조.
// ═══════════════════════════════════════════════════════════════

// ── 자형 혼동 세트 ───────────────────────────────────────────────
interface Glyph { c: string; r: string; ko: string }
interface GlyphSet { id: string; label: string; chars: Glyph[]; tip: string }

const GLYPH_SETS: GlyphSet[] = [
  {
    id: 'shitsu', label: 'シ ツ ソ ン', tip: '점 위치와 획 방향의 2×2',
    chars: [
      { c: 'シ', r: 'shi', ko: '시' }, { c: 'ツ', r: 'tsu', ko: '츠' },
      { c: 'ソ', r: 'so', ko: '소' }, { c: 'ン', r: 'n', ko: 'ㄴ 받침' },
    ],
  },
  {
    id: 'kuwa', label: 'ク ワ ケ タ', tip: '왼쪽 위 꺾임의 각도',
    chars: [
      { c: 'ク', r: 'ku', ko: '쿠' }, { c: 'ワ', r: 'wa', ko: '와' },
      { c: 'ケ', r: 'ke', ko: '케' }, { c: 'タ', r: 'ta', ko: '타' },
    ],
  },
  {
    id: 'sunume', label: 'ス ヌ メ ヲ', tip: '삐침이 몇 개, 어디서 시작하는가',
    chars: [
      { c: 'ス', r: 'su', ko: '스' }, { c: 'ヌ', r: 'nu', ko: '누' },
      { c: 'メ', r: 'me', ko: '메' }, { c: 'ヲ', r: 'wo', ko: '오(を)' },
    ],
  },
  {
    id: 'koyu', label: 'コ ユ エ ロ', tip: '가로 두 획의 연결 방식',
    chars: [
      { c: 'コ', r: 'ko', ko: '코' }, { c: 'ユ', r: 'yu', ko: '유' },
      { c: 'エ', r: 'e', ko: '에' }, { c: 'ロ', r: 'ro', ko: '로' },
    ],
  },
  {
    id: 'chite', label: 'チ テ ナ', tip: '세로획이 가로획을 뚫는가',
    chars: [
      { c: 'チ', r: 'chi', ko: '치' }, { c: 'テ', r: 'te', ko: '테' },
      { c: 'ナ', r: 'na', ko: '나' },
    ],
  },
  {
    id: 'mamu', label: 'マ ム ア 了', tip: '아래 꼬리가 붙는가 떨어지는가',
    chars: [
      { c: 'マ', r: 'ma', ko: '마' }, { c: 'ム', r: 'mu', ko: '무' },
      { c: 'ア', r: 'a', ko: '아' },
    ],
  },
  {
    id: 'mira', label: 'ミ ラ ラ 三', tip: '세 획의 기울기',
    chars: [
      { c: 'ミ', r: 'mi', ko: '미' }, { c: 'ラ', r: 'ra', ko: '라' },
      { c: 'ヨ', r: 'yo', ko: '요' },
    ],
  },
  {
    id: 'reru', label: 'レ ル ノ ハ', tip: '획 수와 벌어짐',
    chars: [
      { c: 'レ', r: 're', ko: '레' }, { c: 'ル', r: 'ru', ko: '루' },
      { c: 'ノ', r: 'no', ko: '노' }, { c: 'ハ', r: 'ha', ko: '하' },
    ],
  },
  {
    id: 'hoo', label: 'ホ オ 木', tip: '세로획 위가 튀어나오는가',
    chars: [
      { c: 'ホ', r: 'ho', ko: '호' }, { c: 'オ', r: 'o', ko: '오' },
    ],
  },
  {
    id: 'seya', label: 'セ ヤ 也', tip: '가로획을 뚫는 위치',
    chars: [
      { c: 'セ', r: 'se', ko: '세' }, { c: 'ヤ', r: 'ya', ko: '야' },
    ],
  },
  {
    id: 'fuwau', label: 'フ ワ ウ ラ', tip: '위 점과 아래 굽음',
    chars: [
      { c: 'フ', r: 'fu', ko: '후' }, { c: 'ウ', r: 'u', ko: '우' },
      { c: 'ワ', r: 'wa', ko: '와' }, { c: 'ラ', r: 'ra', ko: '라' },
    ],
  },
  {
    id: 'dakuten', label: 'ジ ズ ヅ ヂ', tip: '탁점이 붙으면 판별이 더 어려워짐',
    chars: [
      { c: 'ジ', r: 'ji', ko: '지' }, { c: 'ズ', r: 'zu', ko: '즈' },
      { c: 'ヅ', r: 'zu', ko: '즈(つ계열)' }, { c: 'ヂ', r: 'ji', ko: '지(ち계열)' },
    ],
  },
]

// ── 단어 ─────────────────────────────────────────────────────────
type Cat = 'unit' | 'device' | 'circuit' | 'tool' | 'material' | 'general'

const CAT_LABELS: Record<Cat, string> = {
  unit: '단위·법칙', device: '기기·부품', circuit: '회로·현상',
  tool: '공구·계측', material: '자재·배선', general: '일반 외래어',
}
const ALL_CATS = Object.keys(CAT_LABELS) as Cat[]

interface Word {
  w: string        // カタカナ
  ko: string       // 한국어 뜻
  en?: string      // 원어
  cat: Cat
  /** 혼동 세트 ID — 오답 선택지를 여기서 뽑는다 */
  conf?: string
  note?: string
}

const WORDS: Word[] = [
  // 단위·법칙
  { w: 'ボルト', ko: '볼트', en: 'volt / bolt', cat: 'unit', conf: 'wa', note: '전압 단위 volt와 나사 bolt가 표기가 완전히 같음 — 문맥으로만 구분' },
  { w: 'アンペア', ko: '암페어', en: 'ampere', cat: 'unit', conf: 'a' },
  { w: 'オーム', ko: '옴', en: 'ohm', cat: 'unit' },
  { w: 'ワット', ko: '와트', en: 'watt', cat: 'unit', conf: 'wa' },
  { w: 'ヘルツ', ko: '헤르츠', en: 'hertz', cat: 'unit' },
  { w: 'ファラド', ko: '패럿', en: 'farad', cat: 'unit' },
  { w: 'ヘンリー', ko: '헨리', en: 'henry', cat: 'unit' },
  { w: 'テスラ', ko: '테슬라', en: 'tesla', cat: 'unit' },
  { w: 'ウェーバ', ko: '웨버', en: 'weber', cat: 'unit' },
  { w: 'ジーメンス', ko: '지멘스', en: 'siemens', cat: 'unit', conf: 'shi' },
  { w: 'クーロン', ko: '쿨롱', en: 'coulomb', cat: 'unit' },
  { w: 'ジュール', ko: '줄', en: 'joule', cat: 'unit' },
  { w: 'キルヒホッフ', ko: '키르히호프', en: 'Kirchhoff', cat: 'unit' },
  { w: 'フレミング', ko: '플레밍', en: 'Fleming', cat: 'unit' },
  { w: 'ファラデー', ko: '패러데이', en: 'Faraday', cat: 'unit' },
  { w: 'レンツ', ko: '렌츠', en: 'Lenz', cat: 'unit' },
  // 기기·부품
  { w: 'モーター', ko: '모터', en: 'motor', cat: 'device' },
  { w: 'トランス', ko: '변압기', en: 'transformer', cat: 'device', note: '変圧器의 현장 통칭' },
  { w: 'インバータ', ko: '인버터', en: 'inverter', cat: 'device', conf: 'in' },
  { w: 'コンバータ', ko: '컨버터', en: 'converter', cat: 'device', conf: 'kon' },
  { w: 'コンデンサ', ko: '콘덴서', en: 'capacitor', cat: 'device', conf: 'kon' },
  { w: 'コンプレッサー', ko: '압축기', en: 'compressor', cat: 'device', conf: 'kon' },
  { w: 'コネクタ', ko: '커넥터', en: 'connector', cat: 'device', conf: 'kon' },
  { w: 'コンセント', ko: '콘센트', en: 'outlet', cat: 'device', conf: 'kon', note: '和製英語 — 영어로는 outlet' },
  { w: 'ブレーカー', ko: '차단기', en: 'breaker', cat: 'device' },
  { w: 'ヒューズ', ko: '퓨즈', en: 'fuse', cat: 'device' },
  { w: 'リレー', ko: '릴레이', en: 'relay', cat: 'device', conf: 'ri' },
  { w: 'レギュレータ', ko: '레귤레이터', en: 'regulator', cat: 'device', conf: 'ri' },
  { w: 'ソレノイド', ko: '솔레노이드', en: 'solenoid', cat: 'device', conf: 'so' },
  { w: 'ソケット', ko: '소켓', en: 'socket', cat: 'device', conf: 'so' },
  { w: 'ダイオード', ko: '다이오드', en: 'diode', cat: 'device' },
  { w: 'トランジスタ', ko: '트랜지스터', en: 'transistor', cat: 'device', conf: 'sta' },
  { w: 'サイリスタ', ko: '사이리스터', en: 'thyristor', cat: 'device', conf: 'sta' },
  { w: 'サーミスタ', ko: '서미스터', en: 'thermistor', cat: 'device', conf: 'sta' },
  { w: 'バリスタ', ko: '배리스터', en: 'varistor', cat: 'device', conf: 'sta' },
  { w: 'コイル', ko: '코일', en: 'coil', cat: 'device' },
  { w: 'センサー', ko: '센서', en: 'sensor', cat: 'device' },
  { w: 'アクチュエータ', ko: '액추에이터', en: 'actuator', cat: 'device' },
  { w: 'エンコーダ', ko: '엔코더', en: 'encoder', cat: 'device' },
  { w: 'サーボ', ko: '서보', en: 'servo', cat: 'device' },
  { w: 'タービン', ko: '터빈', en: 'turbine', cat: 'device' },
  { w: 'ポンプ', ko: '펌프', en: 'pump', cat: 'device' },
  { w: 'ヒーター', ko: '히터', en: 'heater', cat: 'device' },
  { w: 'バッテリー', ko: '배터리', en: 'battery', cat: 'device' },
  { w: 'アンプ', ko: '증폭기', en: 'amplifier', cat: 'device', conf: 'a' },
  { w: 'フィルタ', ko: '필터', en: 'filter', cat: 'device' },
  { w: 'アンテナ', ko: '안테나', en: 'antenna', cat: 'device', conf: 'a' },
  // 회로·현상
  { w: 'インピーダンス', ko: '임피던스', en: 'impedance', cat: 'circuit', conf: 'in' },
  { w: 'インダクタンス', ko: '인덕턴스', en: 'inductance', cat: 'circuit', conf: 'in' },
  { w: 'リアクタンス', ko: '리액턴스', en: 'reactance', cat: 'circuit', conf: 'ri' },
  { w: 'コンダクタンス', ko: '컨덕턴스', en: 'conductance', cat: 'circuit', conf: 'kon' },
  { w: 'アース', ko: '접지', en: 'earth / ground', cat: 'circuit', conf: 'a' },
  { w: 'アーク', ko: '아크', en: 'arc', cat: 'circuit', conf: 'a' },
  { w: 'サージ', ko: '서지', en: 'surge', cat: 'circuit' },
  { w: 'ノイズ', ko: '노이즈', en: 'noise', cat: 'circuit' },
  { w: 'パルス', ko: '펄스', en: 'pulse', cat: 'circuit' },
  { w: 'シーケンス', ko: '시퀀스', en: 'sequence', cat: 'circuit', conf: 'shi' },
  { w: 'シーケンサ', ko: '시퀀서(PLC)', en: 'sequencer', cat: 'circuit', conf: 'shi' },
  { w: 'フィードバック', ko: '피드백', en: 'feedback', cat: 'circuit' },
  { w: 'ゲイン', ko: '이득', en: 'gain', cat: 'circuit' },
  { w: 'デューティ', ko: '듀티비', en: 'duty', cat: 'circuit' },
  { w: 'ショート', ko: '단락', en: 'short', cat: 'circuit' },
  { w: 'リーク', ko: '누설', en: 'leak', cat: 'circuit', conf: 'ri' },
  { w: 'スイッチング', ko: '스위칭', en: 'switching', cat: 'circuit' },
  { w: 'デルタ', ko: '델타(△결선)', en: 'delta', cat: 'circuit' },
  { w: 'スター', ko: '스타(Y결선)', en: 'star', cat: 'circuit' },
  // 공구·계측
  { w: 'テスター', ko: '테스터·멀티미터', en: 'tester', cat: 'tool' },
  { w: 'メガー', ko: '절연저항계', en: 'megger', cat: 'tool', note: '絶縁抵抗計. メーター와 혼동 주의' },
  { w: 'クランプメーター', ko: '클램프미터', en: 'clamp meter', cat: 'tool' },
  { w: 'オシロスコープ', ko: '오실로스코프', en: 'oscilloscope', cat: 'tool' },
  { w: 'ドライバー', ko: '드라이버', en: 'screwdriver', cat: 'tool' },
  { w: 'ペンチ', ko: '펜치', en: 'pliers', cat: 'tool', note: '和製 — pinchers에서 옴' },
  { w: 'ニッパー', ko: '니퍼', en: 'nippers', cat: 'tool' },
  { w: 'ラジオペンチ', ko: '라디오펜치', en: 'needle-nose pliers', cat: 'tool' },
  { w: 'ワイヤストリッパー', ko: '와이어 스트리퍼', en: 'wire stripper', cat: 'tool' },
  { w: 'リーマ', ko: '리머', en: 'reamer', cat: 'tool', conf: 'ri' },
  { w: 'ノギス', ko: '버니어캘리퍼스', en: 'calipers', cat: 'tool', note: '네덜란드어 nonius 유래' },
  { w: 'スパナ', ko: '스패너', en: 'spanner', cat: 'tool' },
  { w: 'プライヤー', ko: '플라이어', en: 'pliers', cat: 'tool' },
  // 자재·배선
  { w: 'ケーブル', ko: '케이블', en: 'cable', cat: 'material' },
  { w: 'ワイヤ', ko: '와이어', en: 'wire', cat: 'material', conf: 'wa' },
  { w: 'プラグ', ko: '플러그', en: 'plug', cat: 'material' },
  { w: 'スイッチ', ko: '스위치', en: 'switch', cat: 'material' },
  { w: 'ターミナル', ko: '단자', en: 'terminal', cat: 'material' },
  { w: 'シールド', ko: '차폐', en: 'shield', cat: 'material', conf: 'shi' },
  { w: 'シース', ko: '시스(외피)', en: 'sheath', cat: 'material', conf: 'shi' },
  { w: 'ダクト', ko: '덕트', en: 'duct', cat: 'material' },
  { w: 'ラック', ko: '랙', en: 'rack', cat: 'material' },
  { w: 'モール', ko: '몰딩', en: 'molding', cat: 'material' },
  { w: 'ボックス', ko: '박스', en: 'box', cat: 'material' },
  { w: 'パイプ', ko: '파이프', en: 'pipe', cat: 'material' },
  { w: 'ビニル', ko: '비닐', en: 'vinyl', cat: 'material', note: 'VVFケーブル의 V' },
  { w: 'ポリエチレン', ko: '폴리에틸렌', en: 'polyethylene', cat: 'material' },
  { w: 'ゴム', ko: '고무', en: 'rubber', cat: 'material' },
  { w: 'ワッシャ', ko: '와셔', en: 'washer', cat: 'material', conf: 'wa' },
  { w: 'ナット', ko: '너트', en: 'nut', cat: 'material' },
  // 일반
  { w: 'メンテナンス', ko: '유지보수', en: 'maintenance', cat: 'general' },
  { w: 'トラブル', ko: '고장·문제', en: 'trouble', cat: 'general' },
  { w: 'マニュアル', ko: '매뉴얼', en: 'manual', cat: 'general' },
  { w: 'スケジュール', ko: '일정', en: 'schedule', cat: 'general' },
  { w: 'チェック', ko: '점검', en: 'check', cat: 'general' },
  { w: 'リスク', ko: '리스크', en: 'risk', cat: 'general', conf: 'ri' },
  { w: 'コスト', ko: '비용', en: 'cost', cat: 'general', conf: 'kon' },
  { w: 'データ', ko: '데이터', en: 'data', cat: 'general' },
  { w: 'システム', ko: '시스템', en: 'system', cat: 'general' },
  { w: 'ユニット', ko: '유닛', en: 'unit', cat: 'general' },
]

// ── 문제 유형 ────────────────────────────────────────────────────
type Mode = 'glyph' | 'word' | 'flash'

const M_LABELS: Record<Mode, string> = {
  glyph: '자형 판별', word: '단어 → 뜻', flash: '순간노출 자가채점',
}
const M_DESCS: Record<Mode, string> = {
  glyph: 'シ/ツ 같은 헷갈리는 낱자', word: '4지선다 · 자동채점', flash: '보고 → 가려지고 → 스스로 확인',
}
const ALL_MODES = Object.keys(M_LABELS) as Mode[]

const EXPOSURES = [
  { ms: 200, label: '0.2초' },
  { ms: 300, label: '0.3초' },
  { ms: 500, label: '0.5초' },
  { ms: 800, label: '0.8초' },
  { ms: 0, label: '무제한' },
]

interface Q {
  key: string
  mode: Mode
  display: string       // 순간노출될 것
  answer: string        // 정답 텍스트
  sub?: string
  options?: string[]    // 4지선다 (glyph·word)
  correct?: string
  speakText: string
  note?: string
}

const pick = <T,>(arr: T[], n: number): T[] => shuffle(arr).slice(0, n)

function buildGlyphQs(sets: GlyphSet[], n: number): Q[] {
  const all = sets.flatMap(s => s.chars.map(c => ({ c, s })))
  if (!all.length) return []
  const out: Q[] = []
  for (let i = 0; i < n; i++) {
    const { c, s } = all[Math.floor(Math.random() * all.length)]
    const distract = pick(s.chars.filter(x => x.ko !== c.ko), 3).map(x => x.ko)
    const opts = shuffle([c.ko, ...distract])
    out.push({
      key: `g-${c.c}-${i}`, mode: 'glyph',
      display: c.c, answer: `${c.ko} (${c.r})`, sub: s.label,
      options: opts, correct: c.ko, speakText: c.c, note: s.tip,
    })
  }
  return out
}

function buildWordQs(words: Word[], n: number): Q[] {
  if (words.length < 4) return []
  const out: Q[] = []
  for (let i = 0; i < n; i++) {
    const w = words[Math.floor(Math.random() * words.length)]
    let pool = w.conf ? WORDS.filter(x => x.conf === w.conf && x.w !== w.w) : []
    if (pool.length < 3) pool = pool.concat(WORDS.filter(x => x.cat === w.cat && x.w !== w.w && !pool.includes(x)))
    if (pool.length < 3) pool = pool.concat(WORDS.filter(x => x.w !== w.w))
    const distract = pick(pool, 3).map(x => x.ko)
    out.push({
      key: `w-${w.w}-${i}`, mode: 'word',
      display: w.w, answer: `${w.ko}${w.en ? ` · ${w.en}` : ''}`, sub: CAT_LABELS[w.cat],
      options: shuffle([w.ko, ...distract]), correct: w.ko, speakText: w.w, note: w.note,
    })
  }
  return out
}

function buildFlashQs(words: Word[], n: number): Q[] {
  return pick(words, Math.min(n, words.length)).map((w, i) => ({
    key: `f-${w.w}-${i}`, mode: 'flash' as Mode,
    display: w.w, answer: `${w.ko}${w.en ? ` · ${w.en}` : ''}`, sub: CAT_LABELS[w.cat],
    speakText: w.w, note: w.note,
  }))
}

// ── 실행 화면 ────────────────────────────────────────────────────
interface Result { q: Q; ok: boolean; ms: number }

function RunScreen({ qs, exposure, onDone }: { qs: Q[]; exposure: number; onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const [phase, setPhase] = useState<'ask' | 'result'>('ask')
  const [picked, setPicked] = useState<string | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const startedAt = useRef(Date.now())

  const q = qs[idx]

  useEffect(() => {
    if (!q) return
    setVisible(true)
    setPhase('ask')
    setPicked(null)
    startedAt.current = Date.now()
    if (exposure === 0) return
    const t = setTimeout(() => setVisible(false), exposure)
    return () => clearTimeout(t)
  }, [idx, exposure, q])

  const record = useCallback((ok: boolean) => {
    setResults(r => [...r, { q, ok, ms: Date.now() - startedAt.current }])
  }, [q])

  if (!q) {
    const total = results.length || 1
    const correct = results.filter(r => r.ok).length
    const avg = Math.round(results.reduce((a, r) => a + r.ms, 0) / total)
    const weak = results.filter(r => !r.ok || r.ms > avg * 1.6)
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 text-center">
          <div className="text-4xl mb-3">⏱</div>
          <p className="text-3xl font-bold mb-1">{Math.round((correct / total) * 100)}%</p>
          <p className="text-sm text-gray-400 mb-4">{correct} / {results.length}문제</p>
          <div className="flex justify-center gap-6 text-sm">
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest">평균 반응</p>
              <p className="font-bold text-blue-400">{avg}ms</p>
            </div>
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest">노출</p>
              <p className="font-bold text-amber-400">{exposure === 0 ? '무제한' : `${exposure}ms`}</p>
            </div>
          </div>
        </div>

        {weak.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-4">
            <p className="text-xs text-red-400 font-semibold uppercase tracking-widest mb-3">
              틀렸거나 느렸던 것 {weak.length}개
            </p>
            <div className="space-y-2">
              {weak.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-lg font-bold shrink-0">{r.q.display}</span>
                  <span className="text-xs text-gray-500 truncate flex-1">{r.q.answer}</span>
                  <span className={`text-[11px] shrink-0 ${r.ok ? 'text-amber-500' : 'text-red-400'}`}>
                    {r.ok ? `${r.ms}ms` : '오답'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onDone} className="w-full bg-gray-700 hover:bg-gray-600 py-4 rounded-xl font-bold transition">
          ← 설정으로
        </button>
      </div>
    )
  }

  const masked = '▮'.repeat(Math.max(q.display.length, 2))
  const isChoice = !!q.options

  const choose = (opt: string) => {
    if (phase === 'result') return
    setPicked(opt)
    record(opt === q.correct)
    setPhase('result')
  }

  const selfGrade = (ok: boolean) => {
    record(ok)
    setIdx(i => i + 1)
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{idx + 1} / {qs.length}</p>
        <p className="text-xs text-gray-600">{exposure === 0 ? '무제한' : `${exposure}ms 노출`}</p>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} />
      </div>

      {/* 노출 영역 */}
      <div className="bg-gray-900 rounded-2xl px-6 py-10 mb-4 border border-blue-900 flex flex-col items-center justify-center min-h-[180px]">
        <p className={`font-bold tracking-wider text-center leading-tight ${q.mode === 'glyph' ? 'text-8xl' : 'text-5xl'} ${visible ? 'text-white' : 'text-gray-800'}`}>
          {visible ? q.display : masked}
        </p>
        {!visible && phase === 'ask' && (
          <p className="text-[11px] text-gray-600 mt-4">기억으로 답하세요</p>
        )}
      </div>

      {/* 4지선다 */}
      {isChoice && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {q.options!.map(opt => {
              const isCorrect = opt === q.correct
              const isPicked = opt === picked
              const cls = phase === 'ask'
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                : isCorrect ? 'bg-green-700 text-white'
                  : isPicked ? 'bg-red-800 text-white' : 'bg-gray-900 text-gray-600'
              return (
                <button key={opt} onClick={() => choose(opt)} disabled={phase === 'result'}
                  className={`rounded-xl py-4 px-3 text-sm font-bold transition ${cls}`}>
                  {opt}
                </button>
              )
            })}
          </div>
          {phase === 'result' && (
            <>
              <div className="bg-gray-900 rounded-2xl p-5 mb-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold text-green-300">{q.display} — {q.answer}</p>
                  <button onClick={() => speak(q.speakText, 0.9)} className="text-green-400 text-lg">🔊</button>
                </div>
                {q.note && <p className="text-xs text-gray-500 mt-2 leading-relaxed">💡 {q.note}</p>}
              </div>
              <button onClick={() => setIdx(i => i + 1)}
                className="w-full bg-blue-700 hover:bg-blue-600 py-4 rounded-xl font-bold text-lg transition">
                다음 →
              </button>
            </>
          )}
        </>
      )}

      {/* 자가채점 */}
      {!isChoice && (
        phase === 'ask' ? (
          <button onClick={() => setPhase('result')}
            className="w-full bg-gray-800 hover:bg-gray-700 rounded-2xl p-6 text-gray-500 text-lg font-semibold transition border-2 border-dashed border-gray-700 mb-4">
            탭하여 정답 보기
          </button>
        ) : (
          <>
            <div className="bg-gray-900 rounded-2xl p-6 mb-4 border border-green-900">
              <div className="flex items-center justify-between mb-1">
                <p className="text-2xl font-bold text-green-300">{q.answer}</p>
                <button onClick={() => speak(q.speakText, 0.9)} className="text-green-400 text-lg">🔊</button>
              </div>
              <p className="text-sm text-gray-500">{q.display} · {q.sub}</p>
              {q.note && <p className="text-xs text-gray-500 mt-2 leading-relaxed">💡 {q.note}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => selfGrade(false)}
                className="flex-1 bg-red-900 hover:bg-red-800 rounded-2xl py-4 font-bold text-lg transition">😅 못 읽음</button>
              <button onClick={() => selfGrade(true)}
                className="flex-1 bg-green-700 hover:bg-green-600 rounded-2xl py-4 font-bold text-lg transition">✅ 읽음</button>
            </div>
          </>
        )
      )}
    </div>
  )
}

// ── 페이지 ───────────────────────────────────────────────────────
export default function KatakanaFlashPage() {
  const [qs, setQs] = useState<Q[] | null>(null)
  const [modes, setModes] = useState<Set<Mode>>(new Set(['word']))
  const [cats, setCats] = useState<Set<Cat>>(new Set(ALL_CATS))
  const [sets, setSets] = useState<Set<string>>(new Set(GLYPH_SETS.map(s => s.id)))
  const [exposure, setExposure] = useState(300)
  const [count, setCount] = useState(20)

  const words = useMemo(() => WORDS.filter(w => cats.has(w.cat)), [cats])
  const glyphSets = useMemo(() => GLYPH_SETS.filter(s => sets.has(s.id)), [sets])

  const ready = modes.size > 0
    && (!modes.has('glyph') || glyphSets.length > 0)
    && ((!modes.has('word') && !modes.has('flash')) || words.length >= 4)

  const start = () => {
    const per = Math.ceil(count / modes.size)
    const all: Q[] = []
    if (modes.has('glyph')) all.push(...buildGlyphQs(glyphSets, per))
    if (modes.has('word')) all.push(...buildWordQs(words, per))
    if (modes.has('flash')) all.push(...buildFlashQs(words, per))
    if (!all.length) return
    setQs(shuffle(all).slice(0, count))
  }

  const expLabels = Object.fromEntries(EXPOSURES.map(e => [String(e.ms), e.label])) as Record<string, string>
  const glyphLabels = Object.fromEntries(GLYPH_SETS.map(s => [s.id, s.label])) as Record<string, string>

  return (
    <TrainerLayout icon="⚡" title="カタカナ速読"
      subtitle={`순간노출 반응속도 훈련 · 전기 외래어 ${WORDS.length}개 · 혼동 자형 ${GLYPH_SETS.length}세트`}>
      {qs === null ? (
        <div className="max-w-xl mx-auto">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">훈련 설정</p>

          <RuleSheet slug="katakana-flash" />

          <Panel label="노출 시간 — 이게 이 트레이너의 핵심">
            <ChipRow
              items={EXPOSURES.map(e => String(e.ms))}
              labels={expLabels}
              active={new Set([String(exposure)])}
              onToggle={v => setExposure(Number(v))}
              color="amber"
            />
            <p className="text-[10px] text-gray-600 mt-2">
              설정한 시간이 지나면 글자가 ▮로 가려집니다. 그 다음은 기억으로 답해야 합니다.
            </p>
          </Panel>

          <Panel label="문제 유형">
            <ModeGrid items={ALL_MODES} labels={M_LABELS} descs={M_DESCS} active={modes}
              onToggle={v => toggleIn(modes, v, setModes)} />
          </Panel>

          {(modes.has('word') || modes.has('flash')) && (
            <Panel label="단어 범위">
              <ChipRow items={ALL_CATS} labels={CAT_LABELS} active={cats}
                onToggle={v => toggleIn(cats, v, setCats)} />
            </Panel>
          )}

          {modes.has('glyph') && (
            <Panel label="혼동 자형 세트">
              <ChipRow items={GLYPH_SETS.map(s => s.id)} labels={glyphLabels} active={sets}
                onToggle={v => toggleIn(sets, v, setSets)} color="blue" />
            </Panel>
          )}

          <CheatBox title="シ ツ ソ ン 판별법">
            <div className="text-xs space-y-3">
              <div className="grid grid-cols-3 gap-2 items-center text-center">
                <span />
                <span className="text-[10px] text-gray-500 font-bold">점이 왼쪽 · 획은 아래→위</span>
                <span className="text-[10px] text-gray-500 font-bold">점이 위 · 획은 위→아래</span>
                <span className="text-[10px] text-gray-500 font-bold text-left">점 2개</span>
                <span className="text-3xl font-bold text-blue-300">シ</span>
                <span className="text-3xl font-bold text-amber-300">ツ</span>
                <span className="text-[10px] text-gray-500 font-bold text-left">점 1개</span>
                <span className="text-3xl font-bold text-blue-300">ン</span>
                <span className="text-3xl font-bold text-amber-300">ソ</span>
              </div>
              <p className="text-gray-400 leading-relaxed pt-2 border-t border-gray-800">
                네 글자를 따로 외우면 계속 헷갈립니다. 축이 두 개뿐이에요 —
                <span className="text-white"> 점의 개수</span>와
                <span className="text-white"> 획이 오는 방향</span>.
                획 방향은 점의 위치로 드러납니다. 점이 <span className="text-blue-300">왼쪽에 세로로</span> 붙으면
                마지막 획이 아래에서 위로 올라오고(シ・ン), 점이 <span className="text-amber-300">위에 가로로</span>
                붙으면 위에서 아래로 내려옵니다(ツ・ソ).
              </p>
              <p className="text-gray-400 leading-relaxed">
                손으로 몇 번 써 보면 이 감각이 훨씬 빨리 붙습니다. 획순 자체가 판별 근거라서,
                눈으로만 보면 계속 도형 대조를 하게 되고 그게 0.3초를 못 넘기는 이유입니다.
              </p>
              <p className="text-gray-500 leading-relaxed pt-2 border-t border-gray-800">
                <span className="text-amber-400 font-bold">장음 ー</span>도 속도를 잡아먹습니다.
                JIS 관례상 3음절 이상이면 끝의 장음을 생략해서
                <span className="text-white"> インバータ · コンデンサ · サーバ</span>처럼 쓰지만,
                현장 문서에는 <span className="text-white">インバーター</span>도 그대로 나옵니다.
                둘 다 같은 단어로 받아들이세요.
              </p>
            </div>
          </CheatBox>

          <VoicePicker />

          <Panel label="문제 수">
            <div className="flex gap-2">
              {[10, 20, 30, 50].map(n => (
                <button key={n} onClick={() => setCount(n)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${count === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {n}문제
                </button>
              ))}
            </div>
          </Panel>

          <StartButton disabled={!ready} hint={`${count}문제 · ${exposure === 0 ? '무제한' : `${exposure}ms`} 노출`}
            onClick={start} />
        </div>
      ) : (
        <RunScreen qs={qs} exposure={exposure} onDone={() => setQs(null)} />
      )}
    </TrainerLayout>
  )
}
