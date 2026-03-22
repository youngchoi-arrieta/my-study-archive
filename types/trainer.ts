export type ContactType = 'NO' | 'NC' | 'tNO' | 'tNC' | 'coil'

export interface BlankAnswer {
  label: string
  type: ContactType
}

export function answerToString(a: BlankAnswer) {
  return `${a.label}-${a.type}`
}

export interface BlankBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  answer: BlankAnswer
}

export interface TimechartSignal {
  label: string
  locked: boolean
  pattern: (0 | 1)[]
}

// DB snake_case 컬럼명과 일치
export interface Problem {
  id: string
  title: string
  exam_type: string
  source_doc: string
  description: string
  operation_text: string
  image_path: string
  blanks: BlankBox[]
  palette: BlankAnswer[]
  timechart: {
    steps: number
    stepLabels: string[]
    signals: TimechartSignal[]
  }
  difficulty: 1 | 2 | 3
  tags: string[]
  created_at: string
}
