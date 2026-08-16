import { supabase } from '@/lib/supabase'

// ═══════════════════════════════════════════════════════════════
//  회차 단위 공유 문서 (解答 PDF)
//
//  電験은 問題지는 과목별로 나뉘어 있지만 解答은 회차·차수당 PDF 한 장에
//  전 과목이 다 들어 있다. 그래서 解答 URL을 과목마다 따로 저장하면
//  같은 링크를 네 번(一次) 또는 두 번(二次) 넣어야 한다.
//
//  이 모듈은 (scope, exam_id, phase) 하나에 解答 URL을 저장하고,
//  어느 과목에서 열어도 같은 것을 보게 한다.
// ═══════════════════════════════════════════════════════════════

export type DocScope = 'denken12' | 'denken3'
/** 一次·二次로 解答 PDF가 갈린다. 三種처럼 구분이 없으면 'all' */
export type DocPhase = 'ichiji' | 'niji' | 'all'

export interface ExamDoc {
  scope: DocScope
  exam_id: string
  phase: DocPhase
  answer_url: string | null
  question_url: string | null
}

/** 二次 과목명으로 phase를 판정 */
export const phaseOfSubject = (subject: string): DocPhase =>
  subject.includes('電力・管理') || subject.includes('機械・制御') ? 'niji' : 'ichiji'

export async function loadExamDoc(
  scope: DocScope, examId: string, phase: DocPhase,
): Promise<ExamDoc | null> {
  const { data } = await supabase
    .from('denken_exam_docs')
    .select('scope, exam_id, phase, answer_url, question_url')
    .eq('scope', scope).eq('exam_id', examId).eq('phase', phase)
    .limit(1)
  return (data?.[0] as ExamDoc) ?? null
}

/** 회차 전체의 解答 URL을 저장 — 같은 차수의 모든 과목이 함께 본다 */
export async function saveExamAnswerUrl(
  scope: DocScope, examId: string, phase: DocPhase, url: string,
): Promise<string | null> {
  const { error } = await supabase.from('denken_exam_docs').upsert({
    scope, exam_id: examId, phase,
    answer_url: url.trim() || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'scope,exam_id,phase' })
  return error ? error.message : null
}

/** 허브에서 회차별 解答 보유 여부를 한 번에 */
export async function loadExamDocs(scope: DocScope, examIds: string[]): Promise<ExamDoc[]> {
  if (!examIds.length) return []
  const { data } = await supabase
    .from('denken_exam_docs')
    .select('scope, exam_id, phase, answer_url, question_url')
    .eq('scope', scope).in('exam_id', examIds)
  return (data as ExamDoc[]) ?? []
}

export const docKey = (examId: string, phase: DocPhase) => `${examId}__${phase}`
