// 카드 상태 색상 (전체 공통)
export const STATUS_COLORS: Record<string, string> = {
  '새 카드': 'bg-gray-600',
  '오답노트': 'bg-red-600',
  '완료': 'bg-blue-600',
}

// 도면 카드 타입 색상
export const TYPE_COLORS: Record<string, string> = {
  '도면해석': 'bg-blue-800',
  'Table spec': 'bg-purple-700',
  '시퀀스회로도': 'bg-teal-700',
}

// 카드 상태 목록
export const STATUS_LIST = ['새 카드', '오답노트', '완료'] as const
export type CardStatus = typeof STATUS_LIST[number]

// 전기기사 실기 주제 트리
export type TopicTree = {
  label: string
  color: string
  subs: string[]
}

export const TOPIC_TREE: TopicTree[] = [
  {
    label: '변전설비 계산',
    color: 'bg-blue-700',
    subs: [
      '변압기 용량 산정',
      '고장계산 / 차단기 용량',
      '퍼센트 임피던스',
      '계기용 변성기',
      '역률 개선 (콘덴서)',
      '전력용 개폐장치',
    ],
  },
  {
    label: '수변전설비 설계',
    color: 'bg-indigo-700',
    subs: [
      '수변전 구성 기기',
      '특고압 표준 결선도 / 도면 해석',
      '차단기 정격 선정',
    ],
  },
  {
    label: '부하설비 계산',
    color: 'bg-green-700',
    subs: [
      '조명 계산',
      '축전지 설비',
      '전동기',
      '예비전원설비',
    ],
  },
  {
    label: '전선 설계 (테이블 스펙)',
    color: 'bg-yellow-700',
    subs: [
      '전압강하 / 전선 굵기 선정',
      '표준 부하 상정 / 분기회로 수 계산',
      '전력용 콘덴서 용량',
    ],
  },
  {
    label: '전력설비 / 배전 계산',
    color: 'bg-orange-700',
    subs: [
      '단상 3선식 / 설비불평형률',
      '부하 용량 계산',
      '전압강하 (송배전 맥락)',
      '역률·전력 계산 기초',
    ],
  },
  {
    label: '시퀀스 제어',
    color: 'bg-teal-700',
    subs: [
      '유접점 회로',
      '무접점 회로',
      'PLC 래더 다이어그램',
      '타임차트 해석',
    ],
  },
  {
    label: 'KEC (접지·피뢰)',
    color: 'bg-purple-700',
    subs: [
      '접지 시스템',
      '피뢰시스템',
      '저압 전기설비 접지 방식',
    ],
  },
]

// 문제 성격 태그
export const PROBLEM_NATURE = ['계산', '결선', '단답/용어', '도면해석', '시퀀스', 'Table spec'] as const
export type ProblemNature = typeof PROBLEM_NATURE[number]

export const NATURE_COLORS: Record<string, string> = {
  '계산': 'bg-blue-600',
  '결선': 'bg-indigo-600',
  '단답/용어': 'bg-gray-600',
  '도면해석': 'bg-green-700',
  '시퀀스': 'bg-teal-600',
  'Table spec': 'bg-purple-600',
}
