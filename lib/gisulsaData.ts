import { supabase } from '@/lib/supabase'
import {
  GisulsaSlug, GisulsaQuestion, GISULSA_SPECS, qKey, examDocId,
} from '@/lib/constants-gisulsa'
import { BALSONG_SEED } from '@/lib/data-gisulsa-balsong'
import { TOPICS, Topic, guessTopicCodes, parseTag } from '@/lib/constants-topics'

// 기술사 데이터 계층
// -------------------------------------------------------------------
// 세 갈래에서 오는 걸 한 곳에서 합친다.
//   1) 시드      — lib/data-gisulsa-*.ts (코드에 박힘, 즉시 렌더)
//   2) DB 문항   — gs_questions (앱에서 직접 태깅한 것)
//   3) 덴켄 참조 — denken12_answers (topic_code, 없으면 자유 텍스트 추정)
//
// 3번이 이 앱의 요점이다. 덴켄 1·2종 풀이 화면에 이미 쌓아둔 주제·키워드를
// 소급 태깅 없이 끌어와, 기술사 토픽마다 「電験에서도 이만큼 나왔다」를 붙인다.

// ── 시드 ────────────────────────────────────────────────────────────
const SEEDS: Record<GisulsaSlug, GisulsaQuestion[]> = {
  balsong:  BALSONG_SEED,
  geonchuk: [],
  eungyong: [],
  anjeon:   [],
}

export const seedOf = (jong: GisulsaSlug) => SEEDS[jong] ?? []
export const allSeed = (): GisulsaQuestion[] => GISULSA_SPECS.flatMap(s => seedOf(s.slug))

// ── DB 문항 ─────────────────────────────────────────────────────────
export interface QuestionRow {
  id: string
  jong: string
  exam: number
  session: number
  no: number
  points: number
  topics: string[] | null
  title: string
}

export async function loadDbQuestions(jong?: GisulsaSlug): Promise<GisulsaQuestion[]> {
  let q = supabase.from('gs_questions')
    .select('id, jong, exam, session, no, points, topics, title')
  if (jong) q = q.eq('jong', jong)
  const { data } = await q
  return ((data as QuestionRow[]) ?? []).map(r => ({
    id: r.id,
    jong: r.jong as GisulsaSlug,
    exam: r.exam, session: r.session, no: r.no, points: r.points,
    topics: r.topics ?? [],
    title: r.title,
    source: 'db' as const,
  }))
}

/** 시드 + DB. 같은 (종목·회차·교시·번호)면 DB가 이긴다 — 앱에서 고친 태깅이 우선 */
export function mergeQuestions(seed: GisulsaQuestion[], db: GisulsaQuestion[]): GisulsaQuestion[] {
  const m = new Map<string, GisulsaQuestion>()
  seed.forEach(q => m.set(qKey(q), q))
  db.forEach(q => m.set(qKey(q), q))
  return [...m.values()].sort((a, b) =>
    b.exam - a.exam || a.session - b.session || a.no - b.no)
}

export async function saveQuestion(q: Omit<GisulsaQuestion, 'source' | 'id'>): Promise<string | null> {
  const { error } = await supabase.from('gs_questions').upsert({
    jong: q.jong, exam: q.exam, session: q.session, no: q.no,
    points: q.points, topics: q.topics, title: q.title,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'jong,exam,session,no' })
  return error ? error.message : null
}

// ── 회차 PDF ────────────────────────────────────────────────────────
// denken_exam_docs 를 그대로 재사용한다. scope='gisulsa', exam_id='gs_{종목}_{회차}',
// phase='all' (기술사는 1차/2차 구분이 없다).
export interface ExamPaper { exam: number; questionUrl: string | null; solutionUrl: string | null }

export async function loadPapers(jong: GisulsaSlug, exams: number[]): Promise<Map<number, ExamPaper>> {
  const out = new Map<number, ExamPaper>()
  if (!exams.length) return out
  const ids = exams.map(e => examDocId(jong, e))
  const { data } = await supabase
    .from('denken_exam_docs')
    .select('exam_id, question_url, answer_url')
    .eq('scope', 'gisulsa').in('exam_id', ids)
  ;(data ?? []).forEach((r: { exam_id: string; question_url: string | null; answer_url: string | null }) => {
    const n = Number(r.exam_id.split('_').pop())
    if (!Number.isNaN(n)) out.set(n, { exam: n, questionUrl: r.question_url, solutionUrl: r.answer_url })
  })
  return out
}

export async function savePaper(
  jong: GisulsaSlug, exam: number, field: 'question_url' | 'answer_url', url: string,
): Promise<string | null> {
  const { error } = await supabase.from('denken_exam_docs').upsert({
    scope: 'gisulsa', exam_id: examDocId(jong, exam), phase: 'all',
    [field]: url.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'scope,exam_id,phase' })
  return error ? error.message : null
}

// ── 덴켄 참조 ───────────────────────────────────────────────────────
export interface DenkenRef {
  examId: string
  subject: string
  qNum: number
  topic: string | null
  keywords: string[]
  /** 명시 태깅(topic_code) 인지 자유 텍스트 추정인지 */
  matched: 'code' | 'guess'
}

interface DenkenRow {
  exam_id: string; subject: string; q_num: number
  topic: string | null; keywords: string[] | null; topic_code: string | null
}

/** 토픽 코드 → 덴켄 문항 목록 */
export async function loadDenkenRefs(): Promise<Map<string, DenkenRef[]>> {
  const out = new Map<string, DenkenRef[]>()
  const { data, error } = await supabase
    .from('denken12_answers')
    .select('exam_id, subject, q_num, topic, keywords, topic_code')
    .order('exam_id', { ascending: false })
  // topic_code 컬럼이 아직 없으면(마이그레이션 전) 조용히 빈 맵을 돌려준다
  if (error) return out

  const push = (code: string, ref: DenkenRef) => {
    const arr = out.get(code) ?? []
    if (!arr.some(r => r.examId === ref.examId && r.subject === ref.subject && r.qNum === ref.qNum)) {
      arr.push(ref); out.set(code, arr)
    }
  }

  ;((data as DenkenRow[]) ?? []).forEach(r => {
    const text = `${r.topic ?? ''} ${(r.keywords ?? []).join(' ')}`.trim()
    if (!text && !r.topic_code) return
    const base = {
      examId: r.exam_id, subject: r.subject, qNum: r.q_num,
      topic: r.topic, keywords: r.keywords ?? [],
    }
    if (r.topic_code) {
      push(r.topic_code, { ...base, matched: 'code' })
      return
    }
    guessTopicCodes(text).forEach(code => push(code, { ...base, matched: 'guess' }))
  })
  return out
}

// ── 보드 집계 ───────────────────────────────────────────────────────
// 보드의 행은 대주제(43개)다. 電験 매칭이 이 단위로 걸리기 때문이다.
// 서브노트를 실제로 쓰는 단위인 논점은 행을 펼쳤을 때 안에 나온다.

/** 논점 하나 = 서브노트 한 장 */
export interface PointRow {
  tag: string            // '변압기/병렬운전' 또는 '회로이론'
  label: string          // '병렬운전' 또는 '회로이론'
  count: number
  points: number
  questions: GisulsaQuestion[]
  status: number
}

export interface BoardRow {
  topic: Topic
  krCount: number
  krPoints: number
  /** 종목별 문항 수 — 어느 기술사 종목에서 나왔는지 */
  byJong: Record<string, number>
  questions: GisulsaQuestion[]
  /** 이 대주제 아래 논점들. 서브노트 장수는 이것의 길이다 */
  points_: PointRow[]
  jpRefs: DenkenRef[]
  jpCount: number
  /** 논점 진행에서 파생 — 전부 완료면 2, 하나라도 손댔으면 1 */
  status: number
  score: number
}

export function buildBoard(
  questions: GisulsaQuestion[],
  refs: Map<string, DenkenRef[]>,
  status: Record<string, number>,
): BoardRow[] {
  const rows = TOPICS.map(topic => {
    const qs = questions.filter(q =>
      q.topics.some(t => parseTag(t).topic === topic.key))

    const byJong: Record<string, number> = {}
    qs.forEach(q => { byJong[q.jong] = (byJong[q.jong] ?? 0) + 1 })

    // 이 대주제로 달린 태그를 모아 논점 행을 만든다
    const tagMap = new Map<string, GisulsaQuestion[]>()
    qs.forEach(q => q.topics.forEach(raw => {
      const t = parseTag(raw)
      if (t.topic !== topic.key) return
      const arr = tagMap.get(t.raw) ?? []
      arr.push(q); tagMap.set(t.raw, arr)
    }))
    const points_: PointRow[] = [...tagMap.entries()]
      .map(([tag, list]) => ({
        tag,
        label: parseTag(tag).point ?? topic.name,
        count: list.length,
        points: list.reduce((a, q) => a + q.points, 0),
        questions: list,
        status: status[tag] ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))

    const jpRefs = refs.get(topic.key) ?? []
    const done = points_.filter(p => p.status === 2).length
    const touched = points_.filter(p => p.status > 0).length
    const topicStatus = points_.length === 0 ? (status[topic.key] ?? 0)
      : done === points_.length ? 2 : touched > 0 ? 1 : 0

    return {
      topic,
      krCount: qs.length,
      krPoints: qs.reduce((a, q) => a + q.points, 0),
      byJong, questions: qs, points_,
      jpRefs, jpCount: jpRefs.length,
      status: topicStatus,
      score: 0,
    }
  })

  // 우선도 = 기술사 배점 60% + 電験 출제수 40%.
  // 電験 쪽 분모에 12문 바닥을 둔다 — 기출을 몇 문만 넣은 초기에 한 문항이
  // 순위를 뒤집는 걸 막기 위해서다. 채울수록 자연스럽게 반영된다.
  const maxKP = Math.max(1, ...rows.map(r => r.krPoints))
  const jpDen = Math.max(12, ...rows.map(r => r.jpCount))
  rows.forEach(r => { r.score = 0.6 * (r.krPoints / maxKP) + 0.4 * (r.jpCount / jpDen) })
  return rows
}

/** 기출에 실제로 등장한 논점 목록 — 태깅 화면에서 골라 쓰라고 */
export function knownPoints(questions: GisulsaQuestion[], topicKey: string): string[] {
  const s = new Set<string>()
  questions.forEach(q => q.topics.forEach(raw => {
    const t = parseTag(raw)
    if (t.topic === topicKey && t.point) s.add(t.point)
  }))
  return [...s].sort()
}

// ── 서브노트 진행 ───────────────────────────────────────────────────
export interface SubnoteRow {
  topic_code: string
  status: number
  body: string | null
  diagram_ids: string[] | null
  updated_at?: string
}

export async function loadSubnotes(): Promise<Map<string, SubnoteRow>> {
  const { data } = await supabase
    .from('gs_subnotes')
    .select('topic_code, status, body, diagram_ids, updated_at')
  const m = new Map<string, SubnoteRow>()
  ;((data as SubnoteRow[]) ?? []).forEach(r => m.set(r.topic_code, r))
  return m
}

export async function saveSubnote(
  tag: string, patch: Partial<Pick<SubnoteRow, 'status' | 'body' | 'diagram_ids'>>,
): Promise<string | null> {
  const { error } = await supabase.from('gs_subnotes').upsert({
    topic_code: tag, ...patch, updated_at: new Date().toISOString(),
  }, { onConflict: 'topic_code' })
  return error ? error.message : null
}

export const STATUS_META = [
  { label: '미착수', chip: 'bg-gray-800 text-gray-500', dot: '#4b5a6d' },
  { label: '작성중', chip: 'bg-amber-900/50 text-amber-300', dot: '#fbbf24' },
  { label: '완료',   chip: 'bg-green-900/50 text-green-300', dot: '#34d399' },
]
