'use client'

import { useState, useMemo } from 'react'
import {
  TrainerCard, TrainerLayout, QuizScreen, Panel, ChipRow, ModeGrid,
  CountRow, IrregularToggle, CheatBox, StartButton, shuffle, toggleIn,
  RuleSheet, VoicePicker,
} from '../_components/TrainerShell'

// ═══════════════════════════════════════════════════════════════
//  漢字音対応
//  한국 한자음 → 일본 음독. 한국어 화자만 쓸 수 있는 지름길.
//  받침이 일본 음독의 끝소리를 거의 결정한다.
// ═══════════════════════════════════════════════════════════════

type Batchim = 'k' | 'l' | 'mn' | 'ng' | 'p' | 'none'

const B_LABELS: Record<Batchim, string> = {
  k: 'ㄱ 받침', l: 'ㄹ 받침', mn: 'ㅁ·ㄴ 받침', ng: 'ㅇ 받침', p: 'ㅂ 받침', none: '받침 없음',
}
const B_RULES: Record<Batchim, string> = {
  k: '→ く · き',
  l: '→ つ · ち',
  mn: '→ ん',
  ng: '→ う · い (장음)',
  p: '→ う (일부는 つ)',
  none: '규칙 약함 — 개별 암기',
}
const ALL_B = Object.keys(B_LABELS) as Batchim[]

interface Kan {
  k: string       // 한자
  ko: string      // 한국 음
  on: string      // 일본 음독 (주된 것)
  alt?: string    // 다른 음독
  b: Batchim
  ex: string      // 예시어
  exR: string     // 예시어 읽기
  irr?: boolean
  note?: string
}

const KANJI: Kan[] = [
  // ㄱ 받침 → く・き
  { k: '学', ko: '학', on: 'がく', b: 'k', ex: '学生', exR: 'がくせい' },
  { k: '石', ko: '석', on: 'せき', alt: 'しゃく', b: 'k', ex: '石油', exR: 'せきゆ' },
  { k: '木', ko: '목', on: 'もく', alt: 'ぼく', b: 'k', ex: '木曜日', exR: 'もくようび' },
  { k: '国', ko: '국', on: 'こく', b: 'k', ex: '国語', exR: 'こくご' },
  { k: '食', ko: '식', on: 'しょく', b: 'k', ex: '食堂', exR: 'しょくどう' },
  { k: '的', ko: '적', on: 'てき', b: 'k', ex: '目的', exR: 'もくてき' },
  { k: '作', ko: '작', on: 'さく', alt: 'さ', b: 'k', ex: '作品', exR: 'さくひん' },
  { k: '着', ko: '착', on: 'ちゃく', b: 'k', ex: '到着', exR: 'とうちゃく' },
  { k: '式', ko: '식', on: 'しき', b: 'k', ex: '形式', exR: 'けいしき' },
  { k: '力', ko: '력', on: 'りょく', alt: 'りき', b: 'k', ex: '努力', exR: 'どりょく' },
  { k: '確', ko: '확', on: 'かく', b: 'k', ex: '確認', exR: 'かくにん' },
  { k: '約', ko: '약', on: 'やく', b: 'k', ex: '約束', exR: 'やくそく' },
  { k: '読', ko: '독', on: 'どく', b: 'k', ex: '読書', exR: 'どくしょ' },
  { k: '白', ko: '백', on: 'はく', b: 'k', ex: '白紙', exR: 'はくし' },
  { k: '楽', ko: '락·악', on: 'らく', alt: 'がく', b: 'k', ex: '音楽', exR: 'おんがく', irr: true, note: '樂(락·악) 두 음이 그대로 らく/がく로 갈림' },
  // ㄹ 받침 → つ・ち
  { k: '発', ko: '발', on: 'はつ', b: 'l', ex: '発表', exR: 'はっぴょう' },
  { k: '日', ko: '일', on: 'にち', alt: 'じつ', b: 'l', ex: '日本', exR: 'にほん' },
  { k: '一', ko: '일', on: 'いち', alt: 'いつ', b: 'l', ex: '一番', exR: 'いちばん' },
  { k: '物', ko: '물', on: 'ぶつ', alt: 'もつ', b: 'l', ex: '動物', exR: 'どうぶつ' },
  { k: '月', ko: '월', on: 'げつ', alt: 'がつ', b: 'l', ex: '月曜日', exR: 'げつようび' },
  { k: '出', ko: '출', on: 'しゅつ', b: 'l', ex: '出発', exR: 'しゅっぱつ' },
  { k: '室', ko: '실', on: 'しつ', b: 'l', ex: '教室', exR: 'きょうしつ' },
  { k: '質', ko: '질', on: 'しつ', b: 'l', ex: '質問', exR: 'しつもん' },
  { k: '実', ko: '실', on: 'じつ', b: 'l', ex: '実際', exR: 'じっさい' },
  { k: '別', ko: '별', on: 'べつ', b: 'l', ex: '特別', exR: 'とくべつ' },
  { k: '活', ko: '활', on: 'かつ', b: 'l', ex: '生活', exR: 'せいかつ' },
  { k: '決', ko: '결', on: 'けつ', b: 'l', ex: '決定', exR: 'けってい' },
  { k: '設', ko: '설', on: 'せつ', b: 'l', ex: '設計', exR: 'せっけい' },
  { k: '切', ko: '절', on: 'せつ', alt: 'さい', b: 'l', ex: '親切', exR: 'しんせつ' },
  { k: '術', ko: '술', on: 'じゅつ', b: 'l', ex: '技術', exR: 'ぎじゅつ' },
  { k: '必', ko: '필', on: 'ひつ', b: 'l', ex: '必要', exR: 'ひつよう' },
  { k: '末', ko: '말', on: 'まつ', b: 'l', ex: '週末', exR: 'しゅうまつ' },
  // ㅁ·ㄴ 받침 → ん
  { k: '感', ko: '감', on: 'かん', b: 'mn', ex: '感動', exR: 'かんどう' },
  { k: '山', ko: '산', on: 'さん', b: 'mn', ex: '火山', exR: 'かざん' },
  { k: '心', ko: '심', on: 'しん', b: 'mn', ex: '安心', exR: 'あんしん' },
  { k: '新', ko: '신', on: 'しん', b: 'mn', ex: '新聞', exR: 'しんぶん' },
  { k: '金', ko: '금', on: 'きん', b: 'mn', ex: '現金', exR: 'げんきん' },
  { k: '間', ko: '간', on: 'かん', b: 'mn', ex: '時間', exR: 'じかん' },
  { k: '分', ko: '분', on: 'ぶん', alt: 'ふん', b: 'mn', ex: '自分', exR: 'じぶん' },
  { k: '言', ko: '언', on: 'げん', b: 'mn', ex: '言語', exR: 'げんご' },
  { k: '関', ko: '관', on: 'かん', b: 'mn', ex: '関係', exR: 'かんけい' },
  { k: '電', ko: '전', on: 'でん', b: 'mn', ex: '電気', exR: 'でんき' },
  { k: '安', ko: '안', on: 'あん', b: 'mn', ex: '安全', exR: 'あんぜん' },
  { k: '門', ko: '문', on: 'もん', b: 'mn', ex: '専門', exR: 'せんもん' },
  { k: '民', ko: '민', on: 'みん', b: 'mn', ex: '国民', exR: 'こくみん' },
  { k: '験', ko: '험', on: 'けん', b: 'mn', ex: '試験', exR: 'しけん' },
  { k: '点', ko: '점', on: 'てん', b: 'mn', ex: '点数', exR: 'てんすう' },
  // ㅇ 받침 → う・い
  { k: '空', ko: '공', on: 'くう', b: 'ng', ex: '空気', exR: 'くうき' },
  { k: '生', ko: '생', on: 'せい', alt: 'しょう', b: 'ng', ex: '学生', exR: 'がくせい' },
  { k: '中', ko: '중', on: 'ちゅう', b: 'ng', ex: '中国', exR: 'ちゅうごく' },
  { k: '東', ko: '동', on: 'とう', b: 'ng', ex: '東京', exR: 'とうきょう' },
  { k: '成', ko: '성', on: 'せい', b: 'ng', ex: '成功', exR: 'せいこう' },
  { k: '正', ko: '정', on: 'せい', alt: 'しょう', b: 'ng', ex: '正解', exR: 'せいかい' },
  { k: '場', ko: '장', on: 'じょう', b: 'ng', ex: '会場', exR: 'かいじょう' },
  { k: '上', ko: '상', on: 'じょう', b: 'ng', ex: '上手', exR: 'じょうず' },
  { k: '英', ko: '영', on: 'えい', b: 'ng', ex: '英語', exR: 'えいご' },
  { k: '名', ko: '명', on: 'めい', alt: 'みょう', b: 'ng', ex: '有名', exR: 'ゆうめい' },
  { k: '工', ko: '공', on: 'こう', b: 'ng', ex: '工場', exR: 'こうじょう' },
  { k: '用', ko: '용', on: 'よう', b: 'ng', ex: '使用', exR: 'しよう' },
  { k: '行', ko: '행', on: 'こう', alt: 'ぎょう', b: 'ng', ex: '銀行', exR: 'ぎんこう' },
  { k: '強', ko: '강', on: 'きょう', b: 'ng', ex: '勉強', exR: 'べんきょう' },
  { k: '情', ko: '정', on: 'じょう', b: 'ng', ex: '情報', exR: 'じょうほう' },
  { k: '性', ko: '성', on: 'せい', b: 'ng', ex: '性格', exR: 'せいかく' },
  { k: '境', ko: '경', on: 'きょう', b: 'ng', ex: '環境', exR: 'かんきょう' },
  // ㅂ 받침 → う
  { k: '十', ko: '십', on: 'じゅう', b: 'p', ex: '十分', exR: 'じゅうぶん' },
  { k: '合', ko: '합', on: 'ごう', b: 'p', ex: '合格', exR: 'ごうかく' },
  { k: '入', ko: '입', on: 'にゅう', b: 'p', ex: '入学', exR: 'にゅうがく' },
  { k: '集', ko: '집', on: 'しゅう', b: 'p', ex: '集中', exR: 'しゅうちゅう' },
  { k: '答', ko: '답', on: 'とう', b: 'p', ex: '答案', exR: 'とうあん' },
  { k: '級', ko: '급', on: 'きゅう', b: 'p', ex: '上級', exR: 'じょうきゅう' },
  { k: '業', ko: '업', on: 'ぎょう', b: 'p', ex: '授業', exR: 'じゅぎょう' },
  { k: '習', ko: '습', on: 'しゅう', b: 'p', ex: '練習', exR: 'れんしゅう' },
  { k: '法', ko: '법', on: 'ほう', b: 'p', ex: '方法', exR: 'ほうほう' },
  { k: '立', ko: '립', on: 'りつ', alt: 'りゅう', b: 'p', ex: '立場', exR: 'たちば', irr: true, note: 'ㅂ 받침인데 つ — 立·接·雑·圧이 이 예외 그룹' },
  { k: '接', ko: '접', on: 'せつ', b: 'p', ex: '面接', exR: 'めんせつ', irr: true, note: 'ㅂ 받침인데 つ' },
  { k: '雑', ko: '잡', on: 'ざつ', b: 'p', ex: '雑誌', exR: 'ざっし', irr: true, note: 'ㅂ 받침인데 つ' },
  // 받침 없음
  { k: '気', ko: '기', on: 'き', alt: 'け', b: 'none', ex: '天気', exR: 'てんき' },
  { k: '時', ko: '시', on: 'じ', b: 'none', ex: '時間', exR: 'じかん' },
  { k: '所', ko: '소', on: 'しょ', b: 'none', ex: '場所', exR: 'ばしょ' },
  { k: '話', ko: '화', on: 'わ', b: 'none', ex: '会話', exR: 'かいわ' },
  { k: '理', ko: '리', on: 'り', b: 'none', ex: '理由', exR: 'りゆう' },
  { k: '高', ko: '고', on: 'こう', b: 'none', ex: '最高', exR: 'さいこう', note: 'ㅗ·ㅛ로 끝나면 こう·ぞう처럼 う가 붙는 경향' },
  { k: '道', ko: '도', on: 'どう', b: 'none', ex: '道路', exR: 'どうろ' },
  { k: '子', ko: '자', on: 'し', alt: 'す', b: 'none', ex: '調子', exR: 'ちょうし' },
]

// ── 한자어 단어 (촉음화 포함) ────────────────────────────────────
interface Word { w: string; ko: string; r: string; sokuon?: boolean; note?: string }

const WORDS: Word[] = [
  { w: '学校', ko: '학교', r: 'がっこう', sokuon: true, note: 'がく + こう → か행 앞에서 촉음화' },
  { w: '学生', ko: '학생', r: 'がくせい', note: 'さ행 앞이지만 촉음화 없음 — 学校와 대조' },
  { w: '学期', ko: '학기', r: 'がっき', sokuon: true },
  { w: '発表', ko: '발표', r: 'はっぴょう', sokuon: true, note: 'はつ + ひょう → 촉음화 + は행 반탁음(ぴ)' },
  { w: '出発', ko: '출발', r: 'しゅっぱつ', sokuon: true, note: 'しゅつ + はつ → っ + ぱ' },
  { w: '失敗', ko: '실패', r: 'しっぱい', sokuon: true },
  { w: '発見', ko: '발견', r: 'はっけん', sokuon: true },
  { w: '発明', ko: '발명', r: 'はつめい', note: 'ま행 앞에서는 촉음화 없음' },
  { w: '結果', ko: '결과', r: 'けっか', sokuon: true },
  { w: '国家', ko: '국가', r: 'こっか', sokuon: true },
  { w: '雑誌', ko: '잡지', r: 'ざっし', sokuon: true },
  { w: '実行', ko: '실행', r: 'じっこう', sokuon: true },
  { w: '実際', ko: '실제', r: 'じっさい', sokuon: true },
  { w: '作家', ko: '작가', r: 'さっか', sokuon: true },
  { w: '一切', ko: '일절', r: 'いっさい', sokuon: true },
  { w: '決定', ko: '결정', r: 'けってい', sokuon: true },
  { w: '設計', ko: '설계', r: 'せっけい', sokuon: true },
  { w: '目的', ko: '목적', r: 'もくてき' },
  { w: '食堂', ko: '식당', r: 'しょくどう' },
  { w: '特別', ko: '특별', r: 'とくべつ', note: 'が·ざ·だ·ば행(탁음) 앞에서는 촉음화하지 않음' },
  { w: '質問', ko: '질문', r: 'しつもん' },
  { w: '教室', ko: '교실', r: 'きょうしつ' },
  { w: '生活', ko: '생활', r: 'せいかつ' },
  { w: '関係', ko: '관계', r: 'かんけい' },
  { w: '説明', ko: '설명', r: 'せつめい' },
  { w: '必要', ko: '필요', r: 'ひつよう' },
  { w: '週末', ko: '주말', r: 'しゅうまつ' },
  { w: '技術', ko: '기술', r: 'ぎじゅつ' },
  { w: '安全', ko: '안전', r: 'あんぜん' },
  { w: '専門', ko: '전문', r: 'せんもん' },
  { w: '試験', ko: '시험', r: 'しけん' },
  { w: '面接', ko: '면접', r: 'めんせつ' },
  { w: '練習', ko: '연습', r: 'れんしゅう' },
  { w: '授業', ko: '수업', r: 'じゅぎょう' },
  { w: '方法', ko: '방법', r: 'ほうほう' },
  { w: '合格', ko: '합격', r: 'ごうかく' },
  { w: '入学', ko: '입학', r: 'にゅうがく' },
  { w: '集中', ko: '집중', r: 'しゅうちゅう' },
  { w: '銀行', ko: '은행', r: 'ぎんこう' },
  { w: '情報', ko: '정보', r: 'じょうほう' },
  { w: '成功', ko: '성공', r: 'せいこう' },
  { w: '工場', ko: '공장', r: 'こうじょう' },
  { w: '資料', ko: '자료', r: 'しりょう' },
  { w: '経済', ko: '경제', r: 'けいざい' },
  { w: '政治', ko: '정치', r: 'せいじ' },
  { w: '社会', ko: '사회', r: 'しゃかい' },
  { w: '文化', ko: '문화', r: 'ぶんか' },
  { w: '自然', ko: '자연', r: 'しぜん' },
  { w: '環境', ko: '환경', r: 'かんきょう' },
  { w: '問題', ko: '문제', r: 'もんだい' },
  { w: '可能', ko: '가능', r: 'かのう' },
  { w: '確認', ko: '확인', r: 'かくにん' },
  { w: '準備', ko: '준비', r: 'じゅんび' },
  { w: '連絡', ko: '연락', r: 'れんらく' },
]

// ── 문제 유형 ────────────────────────────────────────────────────
type QMode = 'on' | 'back' | 'word' | 'rule'

const M_LABELS: Record<QMode, string> = {
  on: '한자 → 음독', back: '음독 → 한자', word: '한자어 → 읽기', rule: '받침 규칙',
}
const M_DESCS: Record<QMode, string> = {
  on: '한국음을 보고 일본 음독', back: '음독을 보고 한자·한국음', word: '한자어 전체 읽기 (촉음 포함)', rule: '받침별 대응 6장',
}
const ALL_M = Object.keys(M_LABELS) as QMode[]

function buildCards(kanji: Kan[], words: Word[], modes: Set<QMode>): TrainerCard[] {
  const out: TrainerCard[] = []
  for (const k of kanji) {
    const full = k.on + (k.alt ? ` / ${k.alt}` : '')
    if (modes.has('on')) {
      out.push({
        key: `on-${k.k}-${k.ko}`, tag: `${B_LABELS[k.b]} ${B_RULES[k.b]}`,
        prompt: `${k.k}\n${k.ko}`, sub: '일본 음독은?',
        answer: `${full}\n${k.ex}（${k.exR}）`, speakText: k.exR,
        irregular: k.irr, note: k.note,
      })
    }
    if (modes.has('back')) {
      out.push({
        key: `bk-${k.k}-${k.ko}`, tag: '음독 → 한자',
        prompt: k.on, sub: `${k.ex}（${k.exR}）에 쓰이는 한자는?`,
        answer: `${k.k} — 한국음 「${k.ko}」`, speakText: k.exR,
        irregular: k.irr, note: k.note,
      })
    }
  }
  if (modes.has('word')) {
    for (const w of words) {
      out.push({
        key: `w-${w.w}`, tag: w.sokuon ? '한자어 · 촉음화' : '한자어',
        prompt: `${w.w}\n${w.ko}`, sub: '일본어 읽기는?',
        answer: w.r, speakText: w.r, irregular: w.sokuon, note: w.note,
      })
    }
  }
  if (modes.has('rule')) {
    for (const b of ALL_B) {
      const ex = KANJI.filter(k => k.b === b && !k.irr).slice(0, 4)
      out.push({
        key: `rl-${b}`, tag: '받침 규칙',
        prompt: B_LABELS[b], sub: '일본 음독의 끝소리는?',
        answer: B_RULES[b], speakText: ex[0]?.on ?? '',
        note: ex.map(k => `${k.k}(${k.ko})→${k.on}`).join(' · '),
      })
    }
  }
  return out
}

// ── 페이지 ───────────────────────────────────────────────────────
export default function KanjiReadingPage() {
  const [cards, setCards] = useState<TrainerCard[] | null>(null)
  const [modes, setModes] = useState<Set<QMode>>(new Set(['on', 'word']))
  const [bs, setBs] = useState<Set<Batchim>>(new Set(ALL_B))
  const [irrOnly, setIrrOnly] = useState(false)
  const [count, setCount] = useState(20)

  const pool = useMemo(() => {
    const all = buildCards(KANJI.filter(k => bs.has(k.b)), WORDS, modes)
    return irrOnly ? all.filter(c => c.irregular) : all
  }, [modes, bs, irrOnly])

  return (
    <TrainerLayout icon="🈷" title="漢字音対応"
      subtitle={`한국 한자음 → 일본 음독 · 한자 ${KANJI.length}자 · 한자어 ${WORDS.length}개`}>
      {cards === null ? (
        <div className="max-w-xl mx-auto">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

          <RuleSheet slug="kanji-reading" />

          <Panel label="문제 유형">
            <ModeGrid items={ALL_M} labels={M_LABELS} descs={M_DESCS} active={modes}
              onToggle={v => toggleIn(modes, v, setModes)} />
          </Panel>

          <Panel label="받침 그룹">
            <ChipRow items={ALL_B} labels={B_LABELS} active={bs} onToggle={v => toggleIn(bs, v, setBs)} />
          </Panel>

          <IrregularToggle on={irrOnly} setOn={setIrrOnly}
            onText="규칙이 깨지는 한자와 촉음화 단어만"
            offText="규칙형까지 전부 (대응 감각 만들기)" />

          <CheatBox title="받침 → 음독 대응표">
            <div className="space-y-2 text-xs">
              {ALL_B.map(b => (
                <div key={b} className="flex gap-3 items-start">
                  <span className="shrink-0 w-20 font-bold text-blue-400">{B_LABELS[b]}</span>
                  <div className="min-w-0">
                    <p className="text-gray-300">{B_RULES[b]}</p>
                    <p className="text-gray-600 mt-0.5">
                      {KANJI.filter(k => k.b === b && !k.irr).slice(0, 5).map(k => `${k.k}(${k.ko})→${k.on}`).join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
              <p className="text-gray-500 pt-2 border-t border-gray-800 leading-relaxed">
                <span className="text-amber-400 font-bold">촉음화</span>: 앞 글자가 く·つ로 끝나고 뒷 글자가
                か·さ·た·は행으로 시작하면 っ로 줄어듭니다. は행은 반탁음까지 —
                はつ+ひょう → <span className="text-white">はっぴょう</span>.
                조수사의 いっぽん과 똑같은 기계장치입니다.
              </p>
            </div>
          </CheatBox>

          <VoicePicker />

          <Panel label="문제 수"><CountRow count={count} setCount={setCount} /></Panel>

          <StartButton disabled={!pool.length}
            hint={`전체 ${pool.length}장 중 ${count === 0 ? pool.length : Math.min(count, pool.length)}문제`}
            onClick={() => pool.length && setCards(shuffle(pool).slice(0, count === 0 ? pool.length : count))} />
        </div>
      ) : (
        <QuizScreen cards={cards} onDone={() => setCards(null)} promptSize="text-4xl" ruleSlug="kanji-reading" />
      )}
    </TrainerLayout>
  )
}
