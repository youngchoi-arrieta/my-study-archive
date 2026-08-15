'use client'

import { useState, useMemo } from 'react'
import {
  TrainerCard, TrainerLayout, QuizScreen, Panel, ChipRow, ModeGrid,
  CountRow, CheatBox, StartButton, shuffle, toggleIn,
  RuleSheet, VoicePicker,
} from '../_components/TrainerShell'

// ═══════════════════════════════════════════════════════════════
//  自他動詞練習
//  페어 자체가 변환축. 어미에 규칙이 있고, 조사(が／を)와
//  〜ている／〜てある가 그 위에 얹힌다.
// ═══════════════════════════════════════════════════════════════

type Grp = 'a-e' | 'r-s' | 'k-ke' | 'k-kas' | 'e-u' | 'u-e' | 'yasu'

const G_LABELS: Record<Grp, string> = {
  'a-e': '〜aる / 〜eる',
  'r-s': '〜る / 〜す',
  'k-ke': '〜く / 〜ける',
  'k-kas': '〜く / 〜かす',
  'e-u': '〜eる / 〜u',
  'u-e': '〜u / 〜eる',
  'yasu': '〜eる / 〜やす',
}
const G_HINT: Record<Grp, string> = {
  'a-e': '가장 큰 그룹 — 자동사가 あ단',
  'r-s': '타동사에 す가 붙음',
  'k-ke': '자동사 〜く, 타동사 〜ける',
  'k-kas': '타동사에 かす',
  'e-u': '자동사가 〜れる 꼴 (가능형과 혼동 주의)',
  'u-e': '자동사가 짧은 쪽',
  'yasu': '증감·온도 계열',
}
const ALL_G = Object.keys(G_LABELS) as Grp[]

interface Pair {
  ji: string; jiR: string      // 자동사
  ta: string; taR: string      // 타동사
  ko: string
  grp: Grp
  obj: string; objR: string    // 예문용 목적어
  aspect?: boolean             // ている/てある 대조에 적합한가
  jiTe?: string; taTe?: string // て형 (aspect 카드에만 필요 — 규칙 생성 대신 명시)
  note?: string
}

const PAIRS: Pair[] = [
  { ji: '開く', jiR: 'あく', ta: '開ける', taR: 'あける', ko: '열리다 / 열다', grp: 'k-ke', obj: 'ドア', objR: 'どあ', aspect: true, jiTe: '開いて', taTe: '開けて' },
  { ji: '閉まる', jiR: 'しまる', ta: '閉める', taR: 'しめる', ko: '닫히다 / 닫다', grp: 'a-e', obj: '窓', objR: 'まど', aspect: true, jiTe: '閉まって', taTe: '閉めて' },
  { ji: '始まる', jiR: 'はじまる', ta: '始める', taR: 'はじめる', ko: '시작되다 / 시작하다', grp: 'a-e', obj: '授業', objR: 'じゅぎょう' },
  { ji: '終わる', jiR: 'おわる', ta: '終える', taR: 'おえる', ko: '끝나다 / 끝내다', grp: 'a-e', obj: '仕事', objR: 'しごと' },
  { ji: '止まる', jiR: 'とまる', ta: '止める', taR: 'とめる', ko: '멈추다 / 멈추게 하다', grp: 'a-e', obj: '車', objR: 'くるま', aspect: true, jiTe: '止まって', taTe: '止めて' },
  { ji: '決まる', jiR: 'きまる', ta: '決める', taR: 'きめる', ko: '정해지다 / 정하다', grp: 'a-e', obj: '予定', objR: 'よてい', aspect: true, jiTe: '決まって', taTe: '決めて' },
  { ji: '集まる', jiR: 'あつまる', ta: '集める', taR: 'あつめる', ko: '모이다 / 모으다', grp: 'a-e', obj: '資料', objR: 'しりょう', aspect: true, jiTe: '集まって', taTe: '集めて' },
  { ji: '変わる', jiR: 'かわる', ta: '変える', taR: 'かえる', ko: '바뀌다 / 바꾸다', grp: 'a-e', obj: '時間', objR: 'じかん' },
  { ji: '上がる', jiR: 'あがる', ta: '上げる', taR: 'あげる', ko: '오르다 / 올리다', grp: 'a-e', obj: '値段', objR: 'ねだん' },
  { ji: '下がる', jiR: 'さがる', ta: '下げる', taR: 'さげる', ko: '내리다 / 내리게 하다', grp: 'a-e', obj: '温度', objR: 'おんど' },
  { ji: '見つかる', jiR: 'みつかる', ta: '見つける', taR: 'みつける', ko: '발견되다 / 발견하다', grp: 'a-e', obj: '鍵', objR: 'かぎ' },
  { ji: '助かる', jiR: 'たすかる', ta: '助ける', taR: 'たすける', ko: '살아나다 / 돕다', grp: 'a-e', obj: '命', objR: 'いのち' },
  { ji: '曲がる', jiR: 'まがる', ta: '曲げる', taR: 'まげる', ko: '굽다 / 구부리다', grp: 'a-e', obj: '針金', objR: 'はりがね' },
  { ji: '掛かる', jiR: 'かかる', ta: '掛ける', taR: 'かける', ko: '걸리다 / 걸다', grp: 'a-e', obj: '絵', objR: 'え', aspect: true, jiTe: '掛かって', taTe: '掛けて' },
  { ji: '当たる', jiR: 'あたる', ta: '当てる', taR: 'あてる', ko: '맞다 / 맞히다', grp: 'a-e', obj: 'ボール', objR: 'ぼーる' },
  { ji: '温まる', jiR: 'あたたまる', ta: '温める', taR: 'あたためる', ko: '데워지다 / 데우다', grp: 'a-e', obj: 'スープ', objR: 'すーぷ' },
  { ji: '落ちる', jiR: 'おちる', ta: '落とす', taR: 'おとす', ko: '떨어지다 / 떨어뜨리다', grp: 'r-s', obj: '財布', objR: 'さいふ' },
  { ji: '起きる', jiR: 'おきる', ta: '起こす', taR: 'おこす', ko: '일어나다 / 깨우다', grp: 'r-s', obj: '子供', objR: 'こども' },
  { ji: '降りる', jiR: 'おりる', ta: '降ろす', taR: 'おろす', ko: '내리다 / 내려놓다', grp: 'r-s', obj: '荷物', objR: 'にもつ' },
  { ji: '過ぎる', jiR: 'すぎる', ta: '過ごす', taR: 'すごす', ko: '지나다 / 보내다', grp: 'r-s', obj: '時間', objR: 'じかん' },
  { ji: '出る', jiR: 'でる', ta: '出す', taR: 'だす', ko: '나오다 / 내다', grp: 'r-s', obj: 'ごみ', objR: 'ごみ' },
  { ji: '消える', jiR: 'きえる', ta: '消す', taR: 'けす', ko: '꺼지다 / 끄다', grp: 'r-s', obj: '電気', objR: 'でんき', aspect: true, jiTe: '消えて', taTe: '消して' },
  { ji: '汚れる', jiR: 'よごれる', ta: '汚す', taR: 'よごす', ko: '더러워지다 / 더럽히다', grp: 'r-s', obj: '服', objR: 'ふく' },
  { ji: '壊れる', jiR: 'こわれる', ta: '壊す', taR: 'こわす', ko: '망가지다 / 망가뜨리다', grp: 'r-s', obj: '機械', objR: 'きかい' },
  { ji: '倒れる', jiR: 'たおれる', ta: '倒す', taR: 'たおす', ko: '쓰러지다 / 쓰러뜨리다', grp: 'r-s', obj: '木', objR: 'き' },
  { ji: '直る', jiR: 'なおる', ta: '直す', taR: 'なおす', ko: '고쳐지다 / 고치다', grp: 'r-s', obj: '時計', objR: 'とけい' },
  { ji: '残る', jiR: 'のこる', ta: '残す', taR: 'のこす', ko: '남다 / 남기다', grp: 'r-s', obj: '料理', objR: 'りょうり' },
  { ji: '回る', jiR: 'まわる', ta: '回す', taR: 'まわす', ko: '돌다 / 돌리다', grp: 'r-s', obj: 'ハンドル', objR: 'はんどる' },
  { ji: '動く', jiR: 'うごく', ta: '動かす', taR: 'うごかす', ko: '움직이다 / 움직이게 하다', grp: 'k-kas', obj: '机', objR: 'つくえ' },
  { ji: '沸く', jiR: 'わく', ta: '沸かす', taR: 'わかす', ko: '끓다 / 끓이다', grp: 'k-kas', obj: 'お湯', objR: 'おゆ' },
  { ji: '乾く', jiR: 'かわく', ta: '乾かす', taR: 'かわかす', ko: '마르다 / 말리다', grp: 'k-kas', obj: '洗濯物', objR: 'せんたくもの' },
  { ji: '付く', jiR: 'つく', ta: '付ける', taR: 'つける', ko: '켜지다·붙다 / 켜다·붙이다', grp: 'k-ke', obj: '電気', objR: 'でんき', aspect: true, jiTe: '付いて', taTe: '付けて' },
  { ji: '続く', jiR: 'つづく', ta: '続ける', taR: 'つづける', ko: '계속되다 / 계속하다', grp: 'k-ke', obj: '話', objR: 'はなし' },
  { ji: '届く', jiR: 'とどく', ta: '届ける', taR: 'とどける', ko: '도착하다 / 전달하다', grp: 'k-ke', obj: '荷物', objR: 'にもつ' },
  { ji: '割れる', jiR: 'われる', ta: '割る', taR: 'わる', ko: '깨지다 / 깨다', grp: 'e-u', obj: 'コップ', objR: 'こっぷ' },
  { ji: '切れる', jiR: 'きれる', ta: '切る', taR: 'きる', ko: '끊어지다 / 자르다', grp: 'e-u', obj: 'ひも', objR: 'ひも' },
  { ji: '売れる', jiR: 'うれる', ta: '売る', taR: 'うる', ko: '팔리다 / 팔다', grp: 'e-u', obj: '本', objR: 'ほん', note: '가능형 「売れる」와 형태가 같음 — 문맥으로 구분' },
  { ji: '折れる', jiR: 'おれる', ta: '折る', taR: 'おる', ko: '부러지다 / 꺾다', grp: 'e-u', obj: '枝', objR: 'えだ' },
  { ji: '並ぶ', jiR: 'ならぶ', ta: '並べる', taR: 'ならべる', ko: '늘어서다 / 늘어놓다', grp: 'u-e', obj: 'いす', objR: 'いす', aspect: true, jiTe: '並んで', taTe: '並べて' },
  { ji: '進む', jiR: 'すすむ', ta: '進める', taR: 'すすめる', ko: '나아가다 / 진행하다', grp: 'u-e', obj: '計画', objR: 'けいかく' },
  { ji: '育つ', jiR: 'そだつ', ta: '育てる', taR: 'そだてる', ko: '자라다 / 기르다', grp: 'u-e', obj: '花', objR: 'はな' },
  { ji: '建つ', jiR: 'たつ', ta: '建てる', taR: 'たてる', ko: '세워지다 / 짓다', grp: 'u-e', obj: 'ビル', objR: 'びる' },
  { ji: '入る', jiR: 'はいる', ta: '入れる', taR: 'いれる', ko: '들어가다 / 넣다', grp: 'u-e', obj: 'お茶', objR: 'おちゃ', note: '읽기가 はいる／いれる로 완전히 갈리는 예외 페어' },
  { ji: '増える', jiR: 'ふえる', ta: '増やす', taR: 'ふやす', ko: '늘다 / 늘리다', grp: 'yasu', obj: '人数', objR: 'にんずう' },
  { ji: '減る', jiR: 'へる', ta: '減らす', taR: 'へらす', ko: '줄다 / 줄이다', grp: 'yasu', obj: '体重', objR: 'たいじゅう' },
  { ji: '冷える', jiR: 'ひえる', ta: '冷やす', taR: 'ひやす', ko: '차가워지다 / 차게 하다', grp: 'yasu', obj: 'ビール', objR: 'びーる' },
  { ji: '燃える', jiR: 'もえる', ta: '燃やす', taR: 'もやす', ko: '타다 / 태우다', grp: 'yasu', obj: 'ごみ', objR: 'ごみ' },
]

// ── 문제 유형 ────────────────────────────────────────────────────
type QMode = 'ji2ta' | 'ta2ji' | 'judge' | 'particle' | 'aspect'

const M_LABELS: Record<QMode, string> = {
  ji2ta: '自 → 他', ta2ji: '他 → 自', judge: '自? 他?', particle: 'が / を', aspect: 'ている / てある',
}
const M_DESCS: Record<QMode, string> = {
  ji2ta: '자동사에서 타동사로', ta2ji: '타동사에서 자동사로', judge: '주어진 동사의 자·타 판정',
  particle: '문장에 맞는 조사와 동사', aspect: '상태인가, 누가 해 둔 것인가',
}
const ALL_M = Object.keys(M_LABELS) as QMode[]

function buildCards(pairs: Pair[], modes: Set<QMode>): TrainerCard[] {
  const out: TrainerCard[] = []

  for (const p of pairs) {
    if (modes.has('ji2ta')) out.push({
      key: `jt-${p.ji}`, tag: `自 → 他 · ${G_LABELS[p.grp]}`,
      prompt: `${p.ji}（${p.jiR}）`, sub: `${p.ko.split(' / ')[0]} · 타동사는?`,
      answer: `${p.ta}（${p.taR}）`, speakText: p.taR, irregular: !!p.note, note: p.note,
    })
    if (modes.has('ta2ji')) out.push({
      key: `tj-${p.ta}`, tag: `他 → 自 · ${G_LABELS[p.grp]}`,
      prompt: `${p.ta}（${p.taR}）`, sub: `${p.ko.split(' / ')[1]} · 자동사는?`,
      answer: `${p.ji}（${p.jiR}）`, speakText: p.jiR, irregular: !!p.note, note: p.note,
    })
    if (modes.has('judge')) {
      out.push({
        key: `jg-j-${p.ji}`, tag: '자·타 판정',
        prompt: `${p.ji}（${p.jiR}）`, sub: '自動詞? 他動詞?',
        answer: `自動詞 — ${p.obj}が${p.ji}`, speakText: `${p.objR}が${p.jiR}`,
        note: `짝: ${p.ta}（${p.taR}）`,
      })
      out.push({
        key: `jg-t-${p.ta}`, tag: '자·타 판정',
        prompt: `${p.ta}（${p.taR}）`, sub: '自動詞? 他動詞?',
        answer: `他動詞 — ${p.obj}を${p.ta}`, speakText: `${p.objR}を${p.taR}`,
        note: `짝: ${p.ji}（${p.jiR}）`,
      })
    }
    if (modes.has('particle')) {
      out.push({
        key: `pt-j-${p.ji}`, tag: '조사 + 동사',
        prompt: `${p.obj} ___ ___。\n(저절로 ${p.ko.split(' / ')[0]})`, sub: 'が? を? 그리고 어느 동사?',
        answer: `${p.obj}が${p.ji}`, speakText: `${p.objR}が${p.jiR}`,
        note: '자동사는 が — 행위자가 등장하지 않음',
      })
      out.push({
        key: `pt-t-${p.ta}`, tag: '조사 + 동사',
        prompt: `(私は) ${p.obj} ___ ___。\n(내가 ${p.ko.split(' / ')[1]})`, sub: 'が? を? 그리고 어느 동사?',
        answer: `${p.obj}を${p.ta}`, speakText: `${p.objR}を${p.taR}`,
        note: '타동사는 を — 누가 했는지가 있음',
      })
    }
    if (modes.has('aspect') && p.aspect && p.jiTe && p.taTe) {
      out.push({
        key: `as-j-${p.ji}`, tag: 'ている / てある',
        prompt: `${p.obj}が ＿＿＿＿。\n(그냥 그런 상태)`, sub: '自動詞＋ている? 他動詞＋てある?',
        answer: `${p.obj}が${p.jiTe}いる`,
        speakText: `${p.obj}が${p.jiTe}いる`,
        note: '自動詞 + ている = 단순한 상태. 누가 그랬는지는 관심 밖',
      })
      out.push({
        key: `as-t-${p.ta}`, tag: 'ている / てある',
        prompt: `${p.obj}が ＿＿＿＿。\n(누군가 의도를 갖고 해 둔 상태)`, sub: '自動詞＋ている? 他動詞＋てある?',
        answer: `${p.obj}が${p.taTe}ある`,
        speakText: `${p.obj}が${p.taTe}ある`,
        irregular: true,
        note: '他動詞 + てある = 해 둔 상태. 타동사인데 조사가 を가 아니라 が인 점이 함정',
      })
    }
  }

  return out
}

// ── 페이지 ───────────────────────────────────────────────────────
export default function TransitivityPage() {
  const [cards, setCards] = useState<TrainerCard[] | null>(null)
  const [modes, setModes] = useState<Set<QMode>>(new Set(['ji2ta', 'ta2ji']))
  const [grps, setGrps] = useState<Set<Grp>>(new Set(ALL_G))
  const [count, setCount] = useState(20)

  const pool = useMemo(
    () => buildCards(PAIRS.filter(p => grps.has(p.grp)), modes),
    [modes, grps],
  )

  return (
    <TrainerLayout icon="🔀" title="自他動詞練習"
      subtitle={`자동사·타동사 ${PAIRS.length}페어 · 조사와 ている／てある까지`}>
      {cards === null ? (
        <div className="max-w-xl mx-auto">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

          <RuleSheet slug="transitivity" />

          <Panel label="문제 유형">
            <ModeGrid items={ALL_M} labels={M_LABELS} descs={M_DESCS} active={modes}
              onToggle={v => toggleIn(modes, v, setModes)} />
          </Panel>

          <Panel label="어미 패턴">
            <ChipRow items={ALL_G} labels={G_LABELS} active={grps} onToggle={v => toggleIn(grps, v, setGrps)} />
          </Panel>

          <CheatBox title="어미 패턴 · 조사 규칙">
            <div className="space-y-2 text-xs">
              {ALL_G.map(g => {
                const sample = PAIRS.filter(p => p.grp === g).slice(0, 3)
                return (
                  <div key={g} className="flex gap-3 items-start">
                    <span className="shrink-0 w-24 font-bold text-violet-400">{G_LABELS[g]}</span>
                    <div className="min-w-0">
                      <p className="text-gray-300">{G_HINT[g]}</p>
                      <p className="text-gray-600 mt-0.5">{sample.map(p => `${p.ji}/${p.ta}`).join(' · ')}</p>
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-gray-800 text-gray-500 leading-relaxed space-y-1">
                <p><span className="text-amber-400 font-bold">自動詞 + が</span> — ドアが開く (저절로 열린다)</p>
                <p><span className="text-amber-400 font-bold">他動詞 + を</span> — ドアを開ける (내가 연다)</p>
                <p className="pt-1">
                  여기에 상태 표현이 얹힙니다.
                  <span className="text-white"> ドアが開いている</span>는 그냥 열려 있는 것,
                  <span className="text-white"> ドアが開けてある</span>는 누군가 의도를 가지고 열어 둔 것입니다.
                  てある인데도 조사가 を가 아니라 が인 점이 가장 많이 틀리는 자리입니다.
                </p>
              </div>
            </div>
          </CheatBox>

          <VoicePicker />

          <Panel label="문제 수"><CountRow count={count} setCount={setCount} /></Panel>

          <StartButton disabled={!pool.length}
            hint={`전체 ${pool.length}장 중 ${count === 0 ? pool.length : Math.min(count, pool.length)}문제`}
            onClick={() => pool.length && setCards(shuffle(pool).slice(0, count === 0 ? pool.length : count))} />
        </div>
      ) : (
        <QuizScreen cards={cards} onDone={() => setCards(null)} ruleSlug="transitivity" />
      )}
    </TrainerLayout>
  )
}
