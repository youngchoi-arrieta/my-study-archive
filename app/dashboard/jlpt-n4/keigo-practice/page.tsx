'use client'

import { useState, useMemo } from 'react'
import {
  TrainerCard, TrainerLayout, QuizScreen, Panel, ChipRow, ModeGrid,
  CountRow, CheatBox, StartButton, shuffle, toggleIn,
  RuleSheet, VoicePicker,
} from '../_components/TrainerShell'

// ═══════════════════════════════════════════════════════════════
//  敬語練習
//  尊敬(상대를 올림) / 謙譲(나를 낮춤) / 丁寧(정중) 3축.
//
//  役職・呼称練習의 「部長の田中」가 여기서 문법이 된다.
//  특수형 20개 남짓만 예외이고, 나머지는 두 규칙으로 생성된다.
// ═══════════════════════════════════════════════════════════════

type Grp = 'special' | 'regular' | 'suru' | 'error'

const G_LABELS: Record<Grp, string> = {
  special: '특수형 (외울 것)',
  regular: '규칙형 お〜になる / お〜する',
  suru: 'する동사 ご〜になる / ご〜する',
  error: '자주 틀리는 형태',
}
const ALL_G = Object.keys(G_LABELS) as Grp[]

interface Verb {
  plain: string
  ko: string
  son: string | null    // 尊敬語
  ken: string | null    // 謙譲語
  tei: string           // 丁寧語
  grp: Grp
  note?: string
}

const VERBS: Verb[] = [
  // ── 특수형 ──
  { plain: 'する', ko: '하다', son: 'なさる', ken: 'いたす', tei: 'します', grp: 'special' },
  { plain: '行く', ko: '가다', son: 'いらっしゃる', ken: '参る / 伺う', tei: '行きます', grp: 'special', note: '伺う는 상대가 있는 곳으로 갈 때 · 参る는 단순 이동' },
  { plain: '来る', ko: '오다', son: 'いらっしゃる / お見えになる', ken: '参る', tei: '来ます', grp: 'special' },
  { plain: 'いる', ko: '있다', son: 'いらっしゃる', ken: 'おる', tei: 'います', grp: 'special', note: '行く·来る·いる 셋이 존경형을 いらっしゃる 하나로 공유' },
  { plain: '言う', ko: '말하다', son: 'おっしゃる', ken: '申す / 申し上げる', tei: '言います', grp: 'special', note: '이름을 댈 때는 「〜と申します」' },
  { plain: '見る', ko: '보다', son: 'ご覧になる', ken: '拝見する', tei: '見ます', grp: 'special' },
  { plain: '聞く', ko: '듣다·묻다', son: 'お聞きになる', ken: '伺う / 拝聴する', tei: '聞きます', grp: 'special' },
  { plain: '食べる・飲む', ko: '먹다·마시다', son: '召し上がる', ken: 'いただく', tei: '食べます', grp: 'special' },
  { plain: '知る', ko: '알다', son: 'ご存じだ', ken: '存じる / 存じ上げる', tei: '知っています', grp: 'special', note: '사람을 알 때는 存じ上げる, 사물은 存じる' },
  { plain: 'くれる', ko: '(남이 나에게) 주다', son: 'くださる', ken: null, tei: 'くれます', grp: 'special' },
  { plain: 'あげる', ko: '(내가 남에게) 주다', son: null, ken: 'さしあげる', tei: 'あげます', grp: 'special' },
  { plain: 'もらう', ko: '받다', son: null, ken: 'いただく / 頂戴する', tei: 'もらいます', grp: 'special', note: '召し上がる의 짝인 いただく와 형태가 같음 — 문맥으로 구분' },
  { plain: '会う', ko: '만나다', son: 'お会いになる', ken: 'お目にかかる', tei: '会います', grp: 'special' },
  { plain: '借りる', ko: '빌리다', son: null, ken: '拝借する', tei: '借ります', grp: 'special' },
  { plain: '思う', ko: '생각하다', son: null, ken: '存じる', tei: '思います', grp: 'special' },
  { plain: '着る', ko: '입다', son: 'お召しになる', ken: null, tei: '着ます', grp: 'special' },
  { plain: '寝る', ko: '자다', son: 'お休みになる', ken: null, tei: '寝ます', grp: 'special' },
  { plain: '死ぬ', ko: '죽다', son: 'お亡くなりになる', ken: null, tei: '亡くなります', grp: 'special' },
  { plain: '訪ねる', ko: '방문하다', son: null, ken: '伺う / お邪魔する', tei: '訪ねます', grp: 'special' },
  { plain: 'わかる', ko: '알다·이해하다', son: null, ken: '承知する / かしこまる', tei: 'わかります', grp: 'special', note: '「了解しました」는 동료·아랫사람용' },
  // ── 규칙형 ──
  { plain: '待つ', ko: '기다리다', son: 'お待ちになる', ken: 'お待ちする', tei: '待ちます', grp: 'regular' },
  { plain: '書く', ko: '쓰다', son: 'お書きになる', ken: 'お書きする', tei: '書きます', grp: 'regular' },
  { plain: '使う', ko: '쓰다·사용하다', son: 'お使いになる', ken: 'お使いする', tei: '使います', grp: 'regular' },
  { plain: '読む', ko: '읽다', son: 'お読みになる', ken: 'お読みする', tei: '読みます', grp: 'regular' },
  { plain: '帰る', ko: '돌아가다', son: 'お帰りになる', ken: null, tei: '帰ります', grp: 'regular' },
  { plain: '持つ', ko: '들다', son: 'お持ちになる', ken: 'お持ちする', tei: '持ちます', grp: 'regular' },
  { plain: '座る', ko: '앉다', son: 'お座りになる', ken: null, tei: '座ります', grp: 'regular' },
  { plain: '話す', ko: '이야기하다', son: 'お話しになる', ken: 'お話しする', tei: '話します', grp: 'regular' },
  // ── する동사 ──
  { plain: '利用する', ko: '이용하다', son: 'ご利用になる', ken: 'ご利用する', tei: '利用します', grp: 'suru' },
  { plain: '案内する', ko: '안내하다', son: 'ご案内になる', ken: 'ご案内する / ご案内いたす', tei: '案内します', grp: 'suru' },
  { plain: '説明する', ko: '설명하다', son: 'ご説明になる', ken: 'ご説明する', tei: '説明します', grp: 'suru' },
  { plain: '連絡する', ko: '연락하다', son: 'ご連絡になる', ken: 'ご連絡する', tei: '連絡します', grp: 'suru' },
  { plain: '相談する', ko: '상담하다', son: 'ご相談になる', ken: 'ご相談する', tei: '相談します', grp: 'suru' },
]

// ── 상황 문제 ────────────────────────────────────────────────────
interface Situ { q: string; a: string; speak: string; note?: string }

const SITUATIONS: Situ[] = [
  { q: '부장님이 오셨습니다', a: '部長がいらっしゃいました', speak: 'ぶちょうがいらっしゃいました' },
  { q: '(제가) 내일 귀사로 가겠습니다', a: '明日、御社に伺います', speak: 'あした、おんしゃにうかがいます', note: '내 행위 → 謙譲. 参ります도 가능' },
  { q: '(제가) 자료를 봤습니다', a: '資料を拝見しました', speak: 'しりょうをはいけんしました' },
  { q: '손님이 자료를 보셨습니다', a: 'お客様が資料をご覧になりました', speak: 'おきゃくさまがしりょうをごらんになりました' },
  { q: '성함을 말씀해 주십시오', a: 'お名前をおっしゃってください', speak: 'おなまえをおっしゃってください' },
  { q: '저는 김이라고 합니다', a: 'キムと申します', speak: 'きむともうします' },
  { q: '사장님이 드셨습니다', a: '社長が召し上がりました', speak: 'しゃちょうがめしあがりました' },
  { q: '(제가) 선물을 받았습니다', a: 'お土産をいただきました', speak: 'おみやげをいただきました' },
  { q: '부장님이 (저에게) 주셨습니다', a: '部長がくださいました', speak: 'ぶちょうがくださいました' },
  { q: '잠시만 기다려 주십시오', a: '少々お待ちください', speak: 'しょうしょうおまちください' },
  { q: '(제가) 안내해 드리겠습니다', a: 'ご案内いたします', speak: 'ごあんないいたします' },
  { q: '알고 계십니까?', a: 'ご存じですか', speak: 'ごぞんじですか' },
  { q: '(제가) 처음 뵙겠습니다', a: 'お目にかかれて光栄です / 初めまして', speak: 'おめにかかれてこうえいです' },
  { q: '부장님은 지금 자리에 안 계십니다 (사외 대상)', a: '田中は席を外しております', speak: 'たなかはせきをはずしております', note: '자기 편이므로 おる(겸양). いらっしゃいません은 오류' },
  { q: '(제가) 잘 알겠습니다', a: '承知しました / かしこまりました', speak: 'しょうちしました' },
]

// ── 자주 틀리는 형태 ─────────────────────────────────────────────
const ERRORS: { wrong: string; right: string; why: string; speak: string }[] = [
  { wrong: 'おっしゃられる', right: 'おっしゃる', why: '이중경어 — おっしゃる 자체가 이미 존경어', speak: 'おっしゃる' },
  { wrong: 'ご覧になられる', right: 'ご覧になる', why: '이중경어', speak: 'ごらんになる' },
  { wrong: '拝見させていただきます', right: '拝見します', why: '겸양 + 겸양의 과잉', speak: 'はいけんします' },
  { wrong: '部長が申しました', right: '部長がおっしゃいました', why: '사내에서 상사에게 겸양어를 쓴 오류', speak: 'おっしゃいました' },
  { wrong: '(사외에) 田中部長がいらっしゃいます', right: '部長の田中が参ります', why: '자기 편은 낮춘다 — 親族의 「父」와 같은 구조', speak: 'ぶちょうのたなかがまいります' },
  { wrong: 'お客様がお待ちしています', right: 'お客様がお待ちになっています', why: 'お〜する는 겸양 — 손님에게 쓰면 안 됨', speak: 'おまちになっています' },
  { wrong: '社長にご苦労様です', right: '社長にお疲れ様です', why: 'ご苦労様는 윗사람이 아랫사람에게', speak: 'おつかれさまです' },
  { wrong: 'とんでもございません', right: 'とんでもないことです', why: 'とんでもない는 한 단어 — ない만 떼어낼 수 없음', speak: 'とんでもないことです' },
]

// ── 문제 유형 ────────────────────────────────────────────────────
type QMode = 'son' | 'ken' | 'which' | 'situ' | 'err'

const M_LABELS: Record<QMode, string> = {
  son: '→ 尊敬語', ken: '→ 謙譲語', which: '尊敬? 謙譲?', situ: '상황 → 표현', err: '오류 교정',
}
const M_DESCS: Record<QMode, string> = {
  son: '기본형에서 존경어로', ken: '기본형에서 겸양어로', which: '주어진 경어의 방향 판정',
  situ: '한국어 상황을 일본어로', err: '자주 틀리는 형태 고치기',
}
const ALL_M = Object.keys(M_LABELS) as QMode[]

function buildCards(verbs: Verb[], modes: Set<QMode>): TrainerCard[] {
  const out: TrainerCard[] = []
  const first = (s: string) => s.split(' / ')[0]

  for (const v of verbs) {
    if (modes.has('son') && v.son) {
      out.push({
        key: `s-${v.plain}`, tag: '尊敬語 (상대를 올림)',
        prompt: v.plain, sub: `${v.ko} · 尊敬語는?`,
        answer: v.son, speakText: first(v.son),
        irregular: v.grp === 'special', note: v.note,
      })
    }
    if (modes.has('ken') && v.ken) {
      out.push({
        key: `k-${v.plain}`, tag: '謙譲語 (나를 낮춤)',
        prompt: v.plain, sub: `${v.ko} · 謙譲語는?`,
        answer: v.ken, speakText: first(v.ken),
        irregular: v.grp === 'special', note: v.note,
      })
    }
    if (modes.has('which')) {
      if (v.son) out.push({
        key: `w-s-${v.plain}`, tag: '방향 판정',
        prompt: first(v.son), sub: '尊敬? 謙譲?',
        answer: `尊敬語 — ${v.plain}（${v.ko}）`, speakText: first(v.son),
        note: v.ken ? `짝이 되는 謙譲語는 ${first(v.ken)}` : undefined,
      })
      if (v.ken) out.push({
        key: `w-k-${v.plain}`, tag: '방향 판정',
        prompt: first(v.ken), sub: '尊敬? 謙譲?',
        answer: `謙譲語 — ${v.plain}（${v.ko}）`, speakText: first(v.ken),
        note: v.son ? `짝이 되는 尊敬語는 ${first(v.son)}` : undefined,
      })
    }
  }

  if (modes.has('situ')) {
    SITUATIONS.forEach((s, i) => out.push({
      key: `si-${i}`, tag: '상황 → 표현',
      prompt: s.q, sub: '일본어로는?',
      answer: s.a, speakText: s.speak, note: s.note,
    }))
  }

  if (modes.has('err')) {
    ERRORS.forEach((e, i) => out.push({
      key: `er-${i}`, tag: '오류 교정',
      prompt: `✗ ${e.wrong}`, sub: '어디가 틀렸고, 올바른 형태는?',
      answer: `○ ${e.right}`, speakText: e.speak, note: e.why, irregular: true,
    }))
  }

  return out
}

// ── 페이지 ───────────────────────────────────────────────────────
export default function KeigoPracticePage() {
  const [cards, setCards] = useState<TrainerCard[] | null>(null)
  const [modes, setModes] = useState<Set<QMode>>(new Set(['son', 'ken']))
  const [grps, setGrps] = useState<Set<Grp>>(new Set(['special', 'regular', 'suru']))
  const [count, setCount] = useState(20)

  const pool = useMemo(
    () => buildCards(VERBS.filter(v => grps.has(v.grp)), modes),
    [modes, grps],
  )

  const specials = VERBS.filter(v => v.grp === 'special')

  return (
    <TrainerLayout icon="🙇" title="敬語練習"
      subtitle={`尊敬·謙譲·丁寧 3축 · 동사 ${VERBS.length}개 · 상황 ${SITUATIONS.length}개`}>
      {cards === null ? (
        <div className="max-w-xl mx-auto">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>

          <RuleSheet slug="keigo-practice" />

          <Panel label="문제 유형">
            <ModeGrid items={ALL_M} labels={M_LABELS} descs={M_DESCS} active={modes}
              onToggle={v => toggleIn(modes, v, setModes)} />
          </Panel>

          <Panel label="동사 그룹">
            <ChipRow items={ALL_G.filter(g => g !== 'error') as Grp[]} labels={G_LABELS}
              active={grps} onToggle={v => toggleIn(grps, v, setGrps)} />
          </Panel>

          <CheatBox title="尊敬 / 謙譲 대조표">
            <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 font-bold border-b border-gray-800 pb-1 mb-1">
              <span>기본형</span><span>尊敬 (상대)</span><span>謙譲 (나)</span>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {specials.map(v => (
                <div key={v.plain} className="grid grid-cols-3 gap-2 text-[11px]">
                  <span className="text-gray-400 truncate">{v.plain}</span>
                  <span className="text-amber-300 truncate">{v.son ?? '—'}</span>
                  <span className="text-blue-300 truncate">{v.ken ?? '—'}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 pt-2 mt-2 border-t border-gray-800 leading-relaxed">
              특수형 밖에서는 규칙 두 개가 전부입니다.
              <span className="text-amber-400"> お＋ます형＋になる = 尊敬</span> /
              <span className="text-blue-400"> お＋ます형＋する = 謙譲</span>.
              한자어 する동사는 お 대신 ご를 씁니다(ご利用になる / ご説明する).
              <br />
              방향만 기억하면 됩니다 — <span className="text-white">주어가 상대면 尊敬, 주어가 나·우리 편이면 謙譲.</span>
              사외에서 자기 부장이 주어가 되면 謙譲인 이유가 이것입니다.
            </p>
          </CheatBox>

          <VoicePicker />

          <Panel label="문제 수"><CountRow count={count} setCount={setCount} /></Panel>

          <StartButton disabled={!pool.length}
            hint={`전체 ${pool.length}장 중 ${count === 0 ? pool.length : Math.min(count, pool.length)}문제`}
            onClick={() => pool.length && setCards(shuffle(pool).slice(0, count === 0 ? pool.length : count))} />
        </div>
      ) : (
        <QuizScreen cards={cards} onDone={() => setCards(null)} ruleSlug="keigo-practice" />
      )}
    </TrainerLayout>
  )
}
