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
