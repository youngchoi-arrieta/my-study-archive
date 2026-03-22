import type { Problem, BlankAnswer } from '@/types/trainer'

export function scoreCircuit(
  blanks: Problem['blanks'],
  answers: Record<string, BlankAnswer>
) {
  let correct = 0
  blanks.forEach(b => {
    const v = answers[b.id]
    if (v && v.label === b.answer.label && v.type === b.answer.type) correct++
  })
  return { correct, total: blanks.length }
}

export function scoreTimechart(
  problem: Problem,
  answers: Record<string, 0 | 1>
) {
  let correct = 0, total = 0
  problem.timechart.signals.forEach((sig, si) => {
    if (sig.locked) return
    for (let ti = 0; ti < problem.timechart.steps; ti++) {
      total++
      if ((answers[`${si}-${ti}`] ?? 0) === sig.pattern[ti]) correct++
    }
  })
  return { correct, total }
}
