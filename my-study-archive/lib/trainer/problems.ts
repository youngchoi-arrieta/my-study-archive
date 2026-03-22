import type { Problem } from '@/types/trainer'

export const PROBLEMS: Problem[] = [
  {
    id: 'gisa-001-A',
    title: '전기기능사 공개도면 001-A',
    exam_type: '전기기능사',
    source_doc: '공개도면 001-A (2025)',
    difficulty: 2,
    tags: ['자동/수동', 'FLS', '타이머', 'EOCR'],
    created_at: '2025-08-04',
    description: 'SS-A(자동): FLS 수위감지 → X·MC1 여자(M1·RL). SS-M(수동): PB1 기동 → T·MC1(M1·RL) → t초 후 MC2(M2·GL). PB0/SS전환 시 정지. 과전류 → EOCR → FR 플리커.',
    operation_text: `가) MCCB 투입 → EOCR 전원 공급
나) 자동운전: SS-A → FLS 수위감지 → X·MC1 여자 → M1·RL. FLS해제 또는 SS-M시 정지.
다) 수동운전: SS-M → PB1 기동 → T·MC1 → M1·RL. t초 후 MC2 → M2·GL. PB0/SS-A시 정지.
라) EOCR 동작: 과전류 → 전동기 정지·FR·BZ. FR플리커 → BZ/YL 교대. EOCR리셋 → 복귀.`,
    image_path: '/problems/001-A.png',
    // blanks는 관리자 편집기에서 드래그로 채워짐 — 초기엔 빈 배열
    blanks: [],
    palette: [
      { label: 'EOCR', type: 'NC' },
      { label: 'EOCR', type: 'NO' },
      { label: 'SS-A', type: 'NO' },
      { label: 'SS-M', type: 'NO' },
      { label: 'FLS',  type: 'NO' },
      { label: 'PB0',  type: 'NC' },
      { label: 'PB1',  type: 'NO' },
      { label: 'X',    type: 'NO' },
      { label: 'MC1',  type: 'NO' },
      { label: 'MC1',  type: 'NC' },
      { label: 'MC2',  type: 'NO' },
      { label: 'T',    type: 'tNO' },
      { label: 'FR',   type: 'NO' },
      { label: 'FR',   type: 'NC' },
    ],
    timechart: {
      steps: 10,
      stepLabels: ['0','1','2','t','4','5','6','7','8','9'],
      signals: [
        { label: 'SS-M',    locked: true,  pattern: [0,1,1,1,1,1,1,0,0,0] },
        { label: 'PB1',     locked: true,  pattern: [0,1,0,0,0,0,0,0,0,0] },
        { label: 'T · MC1', locked: false, pattern: [0,1,1,1,1,1,0,0,0,0] },
        { label: 'T 설정중', locked: true,  pattern: [0,1,1,1,0,0,0,0,0,0] },
        { label: 'MC2',     locked: false, pattern: [0,0,0,0,1,1,0,0,0,0] },
        { label: 'RL',      locked: false, pattern: [0,1,1,1,1,1,0,0,0,0] },
        { label: 'GL',      locked: false, pattern: [0,0,0,0,1,1,0,0,0,0] },
        { label: 'PB0',     locked: true,  pattern: [0,0,0,0,0,0,1,0,0,0] },
      ],
    },
  },
]
