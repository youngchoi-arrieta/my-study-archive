'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── 활용 엔진 (인라인) ────────────────────────────────────────────
type VerbGroup = '1' | '2' | '3' | 'suru'
type ConjType = 'masu'|'nai'|'te'|'ta'|'volitional'|'potential'|'prohibitive'|'imperative'|'causative'|'passive'|'causpass'

interface Verb { kanji: string; kana: string; meaning: string; group: VerbGroup }

const CONJ_LABELS: Record<ConjType, string> = {
  masu:'ます形', nai:'ない形', te:'て形', ta:'た形',
  volitional:'意志形', potential:'可能形', prohibitive:'禁止形',
  imperative:'命令形', causative:'사역形', passive:'수동形', causpass:'사역수동形',
}
const CONJ_MEANINGS: Record<ConjType, string> = {
  masu:'~합니다 (정중체)', nai:'~하지 않다', te:'~하고, ~해서', ta:'~했다 (과거)',
  volitional:'~하자, ~해야지', potential:'~할 수 있다', prohibitive:'~하지 마라',
  imperative:'~해라 (명령)', causative:'~시키다, ~하게 하다', passive:'~당하다, ~받다', causpass:'억지로 ~하게 되다',
}
const ALL_CONJ_TYPES = Object.keys(CONJ_LABELS) as ConjType[]
const GROUP_LABELS: Record<VerbGroup, string> = { '1':'1그룹','2':'2그룹','3':'3그룹','suru':'する動詞' }
const ALL_GROUPS: VerbGroup[] = ['1','2','3','suru']

const EXCEPTIONS: Record<string, Partial<Record<ConjType, string>>> = {
  'いく': { te:'いって', ta:'いった' },
}
const G1: Record<string, Record<string,string>> = {
  'う':{ ms:'い',ns:'わ',te:'って',ta:'った',vo:'おう',po:'える',im:'え',ca:'わせる',pa:'われる',cp:'わせられる' },
  'く':{ ms:'き',ns:'か',te:'いて',ta:'いた',vo:'こう',po:'ける',im:'け',ca:'かせる',pa:'かれる',cp:'かせられる' },
  'ぐ':{ ms:'ぎ',ns:'が',te:'いで',ta:'いだ',vo:'ごう',po:'げる',im:'げ',ca:'がせる',pa:'がれる',cp:'がせられる' },
  'す':{ ms:'し',ns:'さ',te:'して',ta:'した',vo:'そう',po:'せる',im:'せ',ca:'させる',pa:'される',cp:'させられる' },
  'つ':{ ms:'ち',ns:'た',te:'って',ta:'った',vo:'とう',po:'てる',im:'て',ca:'たせる',pa:'たれる',cp:'たせられる' },
  'ぬ':{ ms:'に',ns:'な',te:'んで',ta:'んだ',vo:'のう',po:'ねる',im:'ね',ca:'なせる',pa:'なれる',cp:'なせられる' },
  'ぶ':{ ms:'び',ns:'ば',te:'んで',ta:'んだ',vo:'ぼう',po:'べる',im:'べ',ca:'ばせる',pa:'ばれる',cp:'ばせられる' },
  'む':{ ms:'み',ns:'ま',te:'んで',ta:'んだ',vo:'もう',po:'める',im:'め',ca:'ませる',pa:'まれる',cp:'ませられる' },
  'る':{ ms:'り',ns:'ら',te:'って',ta:'った',vo:'ろう',po:'れる',im:'れ',ca:'らせる',pa:'られる',cp:'らせられる' },
}
const G2: Record<ConjType,string> = {
  masu:'ます',nai:'ない',te:'て',ta:'た',volitional:'よう',potential:'られる',
  prohibitive:'na',imperative:'ろ',causative:'させる',passive:'られる',causpass:'させられる',
}
const SURU: Record<ConjType,string> = {
  masu:'します',nai:'しない',te:'して',ta:'した',volitional:'しよう',potential:'できる',
  prohibitive:'するな',imperative:'しろ',causative:'させる',passive:'される',causpass:'させられる',
}
const KURU: Record<ConjType,string> = {
  masu:'きます',nai:'こない',te:'きて',ta:'きた',volitional:'こよう',potential:'こられる',
  prohibitive:'くるな',imperative:'こい',causative:'こさせる',passive:'こられる',causpass:'こさせられる',
}

function conjugate(verb: Verb, type: ConjType): string {
  const { kana, group } = verb
  const exc = EXCEPTIONS[kana]?.[type]
  if (exc) return exc
  if (group === '2') {
    const stem = kana.slice(0,-1)
    if (type === 'prohibitive') return kana + 'な'
    return stem + G2[type]
  }
  if (group === '3') return kana === 'くる' ? KURU[type] : SURU[type]
  if (group === 'suru') {
    const prefix = kana.endsWith('する') ? kana.slice(0,-2) : kana
    if (type === 'prohibitive') return kana + 'な'
    return prefix + SURU[type]
  }
  const last = kana.slice(-1); const stem = kana.slice(0,-1); const r = G1[last]
  if (!r) return kana + '??'
  if (type==='masu')        return stem+r.ms+'ます'
  if (type==='nai')         return stem+r.ns+'ない'
  if (type==='te')          return stem+r.te
  if (type==='ta')          return stem+r.ta
  if (type==='volitional')  return stem+r.vo
  if (type==='potential')   return stem+r.po
  if (type==='prohibitive') return kana+'な'
  if (type==='imperative')  return stem+r.im
  if (type==='causative')   return stem+r.ca
  if (type==='passive')     return stem+r.pa
  if (type==='causpass')    return stem+r.cp
  return kana
}

const VERB_LIST: Verb[] = [
  // 1그룹
  {kanji:'会う',kana:'あう',meaning:'만나다',group:'1'},
  {kanji:'遊ぶ',kana:'あそぶ',meaning:'놀다',group:'1'},
  {kanji:'洗う',kana:'あらう',meaning:'씻다',group:'1'},
  {kanji:'歩く',kana:'あるく',meaning:'걷다',group:'1'},
  {kanji:'言う',kana:'いう',meaning:'말하다',group:'1'},
  {kanji:'行く',kana:'いく',meaning:'가다',group:'1'},
  {kanji:'急ぐ',kana:'いそぐ',meaning:'서두르다',group:'1'},
  {kanji:'抱く',kana:'いだく',meaning:'(마음 속에) 품다',group:'1'},
  {kanji:'歌う',kana:'うたう',meaning:'노래하다',group:'1'},
  {kanji:'おく',kana:'おく',meaning:'두다, 놓다',group:'1'},
  {kanji:'怒る',kana:'おこる',meaning:'꾸짖다',group:'1'},
  {kanji:'押す',kana:'おす',meaning:'누르다, 밀다',group:'1'},
  {kanji:'泳ぐ',kana:'およぐ',meaning:'수영하다',group:'1'},
  {kanji:'終わる',kana:'おわる',meaning:'끝나다',group:'1'},
  {kanji:'買う',kana:'かう',meaning:'사다',group:'1'},
  {kanji:'帰る',kana:'かえる',meaning:'돌아가다',group:'1'},
  {kanji:'書く',kana:'かく',meaning:'쓰다, 적다',group:'1'},
  {kanji:'勝つ',kana:'かつ',meaning:'이기다',group:'1'},
  {kanji:'聞く',kana:'きく',meaning:'듣다, 묻다',group:'1'},
  {kanji:'切る',kana:'きる',meaning:'자르다',group:'1'},
  {kanji:'曇る',kana:'くもる',meaning:'흐리다',group:'1'},
  {kanji:'転ぶ',kana:'ころぶ',meaning:'넘어지다',group:'1'},
  {kanji:'死ぬ',kana:'しぬ',meaning:'죽다',group:'1'},
  {kanji:'吸う',kana:'すう',meaning:'(담배를) 피우다',group:'1'},
  {kanji:'座る',kana:'すわる',meaning:'앉다',group:'1'},
  {kanji:'出す',kana:'だす',meaning:'내다, 제출하다',group:'1'},
  {kanji:'使う',kana:'つかう',meaning:'사용하다',group:'1'},
  {kanji:'つく',kana:'つく',meaning:'켜지다',group:'1'},
  {kanji:'作る',kana:'つくる',meaning:'만들다',group:'1'},
  {kanji:'手伝う',kana:'てつだう',meaning:'돕다, 거들다',group:'1'},
  {kanji:'直す',kana:'なおす',meaning:'고치다',group:'1'},
  {kanji:'脱ぐ',kana:'ぬぐ',meaning:'벗다',group:'1'},
  {kanji:'盗む',kana:'ぬすむ',meaning:'훔치다',group:'1'},
  {kanji:'残す',kana:'のこす',meaning:'남기다',group:'1'},
  {kanji:'登る',kana:'のぼる',meaning:'오르다',group:'1'},
  {kanji:'飲む',kana:'のむ',meaning:'마시다',group:'1'},
  {kanji:'入る',kana:'はいる',meaning:'들어가다',group:'1'},
  {kanji:'運ぶ',kana:'はこぶ',meaning:'옮기다',group:'1'},
  {kanji:'走る',kana:'はしる',meaning:'달리다',group:'1'},
  {kanji:'話す',kana:'はなす',meaning:'이야기하다',group:'1'},
  {kanji:'まける',kana:'まける',meaning:'지다',group:'1'},
  {kanji:'待つ',kana:'まつ',meaning:'기다리다',group:'1'},
  {kanji:'持つ',kana:'もつ',meaning:'들다, 가지다',group:'1'},
  {kanji:'焼く',kana:'やく',meaning:'굽다',group:'1'},
  {kanji:'休む',kana:'やすむ',meaning:'쉬다',group:'1'},
  {kanji:'呼ぶ',kana:'よぶ',meaning:'부르다',group:'1'},
  {kanji:'読む',kana:'よむ',meaning:'읽다',group:'1'},
  {kanji:'渡る',kana:'わたる',meaning:'건너다',group:'1'},
  {kanji:'笑う',kana:'わらう',meaning:'웃다',group:'1'},
  // 2그룹
  {kanji:'開ける',kana:'あける',meaning:'열다',group:'2'},
  {kanji:'浴びる',kana:'あびる',meaning:'샤워하다',group:'2'},
  {kanji:'要る',kana:'いる',meaning:'필요하다',group:'2'},
  {kanji:'入れる',kana:'いれる',meaning:'넣다',group:'2'},
  {kanji:'起きる',kana:'おきる',meaning:'일어나다',group:'2'},
  {kanji:'落ちる',kana:'おちる',meaning:'떨어지다',group:'2'},
  {kanji:'覚える',kana:'おぼえる',meaning:'외우다, 기억하다',group:'2'},
  {kanji:'降りる',kana:'おりる',meaning:'내리다',group:'2'},
  {kanji:'借りる',kana:'かりる',meaning:'빌리다',group:'2'},
  {kanji:'考える',kana:'かんがえる',meaning:'생각하다',group:'2'},
  {kanji:'決める',kana:'きめる',meaning:'결정하다',group:'2'},
  {kanji:'着る',kana:'きる',meaning:'입다',group:'2'},
  {kanji:'答える',kana:'こたえる',meaning:'대답하다',group:'2'},
  {kanji:'閉める',kana:'しめる',meaning:'닫다',group:'2'},
  {kanji:'知らせる',kana:'しらせる',meaning:'알리다',group:'2'},
  {kanji:'信じる',kana:'しんじる',meaning:'믿다',group:'2'},
  {kanji:'すすめる',kana:'すすめる',meaning:'추천하다',group:'2'},
  {kanji:'捨てる',kana:'すてる',meaning:'버리다',group:'2'},
  {kanji:'助ける',kana:'たすける',meaning:'돕다',group:'2'},
  {kanji:'建てる',kana:'たてる',meaning:'짓다, 세우다',group:'2'},
  {kanji:'食べる',kana:'たべる',meaning:'먹다',group:'2'},
  {kanji:'つける',kana:'つける',meaning:'켜다',group:'2'},
  {kanji:'続ける',kana:'つづける',meaning:'계속하다',group:'2'},
  {kanji:'出かける',kana:'でかける',meaning:'외출하다',group:'2'},
  {kanji:'寝る',kana:'ねる',meaning:'자다',group:'2'},
  {kanji:'始める',kana:'はじめる',meaning:'시작하다',group:'2'},
  {kanji:'晴れる',kana:'はれる',meaning:'개다, 맑다',group:'2'},
  {kanji:'褒める',kana:'ほめる',meaning:'칭찬하다',group:'2'},
  {kanji:'見つける',kana:'みつける',meaning:'찾다, 발견하다',group:'2'},
  {kanji:'見る',kana:'みる',meaning:'보다',group:'2'},
  {kanji:'止める・辞める',kana:'やめる',meaning:'그만두다',group:'2'},
  {kanji:'忘れる',kana:'わすれる',meaning:'잊다',group:'2'},
  // 3그룹
  {kanji:'する',kana:'する',meaning:'하다',group:'3'},
  {kanji:'来る',kana:'くる',meaning:'오다',group:'3'},
  // する동사
  {kanji:'散歩する',kana:'さんぽする',meaning:'산책하다',group:'suru'},
  {kanji:'注意する',kana:'ちゅういする',meaning:'주의하다',group:'suru'},
  {kanji:'勉強する',kana:'べんきょうする',meaning:'공부하다',group:'suru'},
  {kanji:'利用する',kana:'りようする',meaning:'이용하다',group:'suru'},
  {kanji:'練習する',kana:'れんしゅうする',meaning:'연습하다',group:'suru'},
]

// ── TTS ──────────────────────────────────────────────────────────
function speak(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'; u.rate = rate
  window.speechSynthesis.speak(u)
}

// ── QuizCard 타입 ─────────────────────────────────────────────────
type QuizCard = { verb: Verb; type: ConjType; answer: string }

// ── 설정 화면 ────────────────────────────────────────────────────
function SettingsScreen({ onStart }: { onStart: (cards: QuizCard[]) => void }) {
  const [groups, setGroups] = useState<Set<VerbGroup>>(new Set(['1','2']))
  const [types, setTypes] = useState<Set<ConjType>>(new Set(['masu','nai','te','ta']))
  const [count, setCount] = useState(20)

  const toggleGroup = (g: VerbGroup) => setGroups(prev => { const n=new Set(prev); n.has(g)?n.delete(g):n.add(g); return n })
  const toggleType  = (t: ConjType)  => setTypes(prev =>  { const n=new Set(prev); n.has(t)?n.delete(t):n.add(t); return n })

  const handleStart = () => {
    const filtered = VERB_LIST.filter(v => groups.has(v.group))
    const typeArr = [...types]
    if (!filtered.length || !typeArr.length) return
    const pool: QuizCard[] = []
    for (const verb of filtered)
      for (const type of typeArr)
        pool.push({ verb, type, answer: conjugate(verb, type) })
    const shuffled = pool.sort(() => Math.random() - 0.5)
    onStart(count === 0 ? shuffled : shuffled.slice(0, count))
  }

  const totalPool = VERB_LIST.filter(v => groups.has(v.group)).length * types.size

  return (
    <div className="max-w-xl mx-auto">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">연습 범위 설정</p>
      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">동사 그룹</p>
        <div className="flex flex-wrap gap-2">
          {ALL_GROUPS.map(g => (
            <button key={g} onClick={() => toggleGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${groups.has(g)?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 mb-3">
        <p className="text-xs text-gray-500 mb-2">활용형</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CONJ_TYPES.map(t => (
            <button key={t} onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${types.has(t)?'bg-violet-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {CONJ_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 mb-5">
        <p className="text-xs text-gray-500 mb-2">문제 수</p>
        <div className="flex gap-2">
          {[10,20,30,50].map(n => (
            <button key={n} onClick={() => setCount(n)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${count===n?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {n}문제
            </button>
          ))}
          <button onClick={() => setCount(0)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${count===0?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            전체
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-600 text-center mb-4">
        예상 문제 수: {totalPool}개 중 {count===0?totalPool:Math.min(count,totalPool)}문제
      </p>
      <button onClick={handleStart} disabled={!groups.size||!types.size}
        className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 py-4 rounded-xl font-bold text-lg transition">
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

  useEffect(() => {
    if (!autoSpeak || !current) return
    speak(current.verb.kana, speakRate)
  }, [queue, autoSpeak, speakRate])

  if (!current) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold mb-2">완료!</h2>
      <p className="text-gray-400 mb-6">숙지 {mastered} / {total}문제</p>
      <button onClick={onDone} className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold">← 설정으로</button>
    </div>
  )

  const hitMastered = () => { setMastered(p=>p+1); setReveal(false); setQueue(prev=>prev.slice(1)) }
  const hitNotYet   = () => { setReveal(false); setQueue(prev=>[...prev.slice(1),prev[0]]) }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">남은 {queue.length}장 · 숙지 {mastered}/{total}</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">速</span>
          <input type="range" min="0.5" max="1.2" step="0.05" value={speakRate}
            onChange={e => setSpeakRate(parseFloat(e.target.value))} className="w-14 accent-blue-500" />
          <button onClick={() => setAutoSpeak(v=>!v)}
            className={`text-lg transition ${autoSpeak?'opacity-100':'opacity-30'}`}>🔊</button>
        </div>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-6">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{width:`${(mastered/total)*100}%`}} />
      </div>
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
        <div className="border-t border-gray-800 pt-3">
          <p className="text-lg font-semibold text-yellow-400">{CONJ_LABELS[current.type]}は？</p>
          <p className="text-xs text-gray-600 mt-0.5">{CONJ_MEANINGS[current.type]}</p>
        </div>
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
          <p className="text-3xl font-bold text-green-300 mb-1">{current.answer}</p>
          <p className="text-sm text-gray-500">{CONJ_MEANINGS[current.type]}</p>
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
        {cards === null
          ? <SettingsScreen onStart={setCards} />
          : <QuizScreen cards={cards} onDone={() => setCards(null)} />
        }
      </div>
    </main>
  )
}
