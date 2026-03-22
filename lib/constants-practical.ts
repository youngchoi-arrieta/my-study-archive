export interface Step {
  id: number
  name: string
  target: number // 초
  checklist: string[]
  tips: string[]
}

export interface StepLog {
  stepId: number
  name: string
  elapsed: number
  mistakes: string[]
  memo?: string
}

export interface Session {
  id: string
  user_id: string
  problem_no: number
  total_time: number
  step_logs: StepLog[]
  memo?: string
  created_at: string
}

export interface User {
  id: string
  name: string
  created_at: string
}

export const DEFAULT_STEPS: Step[] = [
  {
    id: 1,
    name: "도면 파악",
    target: 300,
    checklist: [
      "시퀀스회로도 핀번호 표시 완료",
      "보조회로 단자대 번호 표시 완료",
      "푸쉬버튼/램프 색깔 확인",
      "배관별 전선 수 표시 완료",
      "새들 위치 표시 완료",
    ],
    tips: [
      "핀번호 잘못 매기면 이후 모든 작업이 실격 — 가장 중요한 단계",
      "주회로 및 보조회로 핀번호, 단자대 번호를 도면에 직접 표시",
      "WL·YL 상하 뒤집힘, cap 미체결 → 무조건 실격",
      "새들 누락 시 배관 작업 중 1개씩 빠지는 실수 유발",
    ],
  },
  {
    id: 2,
    name: "제어반 & 외부 부하 세팅",
    target: 900,
    checklist: [
      "모든 핀베이스 상하 방향 확인",
      "핀베이스 고정 후 마스킹테이프 + 이름 표기",
      "푸쉬버튼 NO/NC 마스킹테이프 구분 표시",
      "커넥터 박스에 부하 조립 완료",
      "공통선 미리 연결 완료",
    ],
    tips: [
      "나사 고정 전 30초 육안 점검 — 핀베이스 상하·위치 확인 필수",
      "MCCB 자리에 12pin base 고정하는 실수 자주 발생",
      "8pin base 드릴 고정 시 단계적으로 천천히",
      "이 단계에서 제어반을 벽판에 나사 고정하는 행위 절대 금지",
    ],
  },
  {
    id: 3,
    name: "제도 및 배관",
    target: 3600,
    checklist: [
      "제어반 위치 분필 제도 완료",
      "배관선 및 기구 위치 표시 완료",
      "TB·컨트롤박스·팔각박스 임시 고정 완료",
      "PE관·CD관 길이 재단 완료",
      "PE관 배관 완료",
      "CD관 배관 완료",
      "새들 누락 없이 전부 고정 완료",
    ],
    tips: [
      "분필 제도 시 CD/PE관 구분, 단자대 번호, 부하 색깔 반드시 기재",
      "새들 간격은 2구 컨트롤박스 뚜껑 긴 변 활용 (약 140mm)",
      "PE관은 스프링벤더 넣고 직선화 후 배관 — 스프링 없이 구부리면 실격",
      "PE관 먼저 전부 배관 후 CD관 배관 순서 준수",
      "배관 말단은 제어반에서 10~20mm 떨어진 위치에서 재단",
    ],
  },
  {
    id: 4,
    name: "입선 및 외부 완성",
    target: 1800,
    checklist: [
      "배관별 전선 수·길이 준비 완료",
      "전선 끝 테이프 마감 후 입선 완료",
      "외부 단자대 전선 체결 완료",
      "벨테스터로 단자대 번호별 전선 구분 완료",
      "푸쉬버튼·램프 색깔·상하 방향 최종 확인",
      "컨트롤박스 뚜껑 체결 완료",
      "30초 최종 배치 도면 대조 완료",
    ],
    tips: [
      "전선 입선 시 한쪽 끝 테이프 마감 — 관 내부 걸림 방지",
      "전선관 양 입구에서 20cm 여유길이 확보 필수",
      "부하 전선 체결 시 ㄱ자 후크로 체결 — 뚜껑 닫은 후 접촉불량 방지",
      "뚜껑 닫은 후 벨테스터는 단자대쪽에서만 진행",
    ],
  },
  {
    id: 5,
    name: "주회로 & 보조회로 배선",
    target: 5400,
    checklist: [
      "2.5sq 주회로 배선 완료 (갈-흑-회 순서)",
      "1.5sq 황색 보조회로 배선 완료",
      "공통선 배선 완료",
      "a접점 배선 완료",
      "b접점 배선 완료",
      "퓨즈홀더 등 난이도 높은 배선 완료",
      "형광펜으로 완료 구간 전부 표시",
      "짧은 전선 누락 없는지 최종 확인",
    ],
    tips: [
      "가장 집중력이 필요한 단계 — 화장실 다녀온 후 착수",
      "주회로 갈-흑-회 순서 절대 준수",
      "스트리핑 → 전선 구부리기 → 단자대 체결 일괄 처리로 시간 절약",
      "공통선 → a접점 → b접점 순서로 배선",
      "퓨즈홀더 J-hook 배선은 맨 마지막에",
      "형광펜으로 완료 표시하며 누락 방지",
    ],
  },
  {
    id: 6,
    name: "케이블 고정 & 벨테스터 검사",
    target: 1800,
    checklist: [
      "케이블 새들 고정 완료",
      "전원선 단자대 외부 연결 완료",
      "TB1 주회로 벨테스터 전수 검사 완료",
      "배선 오류 수정 완료",
      "최종 동작 확인 완료",
    ],
    tips: [
      "목걸이형 벨테스터로 단자대 외부→내부 전수 검사",
      "케이블 주회로 전선 갈-흑-회-청 색깔 순서 준수",
      "오류 발견 시 당황하지 말고 빠르게 수정 — 의외로 누락·오배선 많음",
    ],
  },
]

export const MISTAKE_PRESETS = [
  "핀번호 오기입", "극성 반대 결선", "접지선 미연결",
  "전선 피복 벗김 과다", "나사 조임 불량", "색상 규칙 위반",
  "핀베이스 상하 반전", "새들 누락", "부하 색깔/상하 반전",
  "푸쉬버튼 NO/NC 혼동", "단자대 번호 오결선", "전선 여유 부족",
]

// 공정별 실수 태그 (stepId 기준)
export const STEP_MISTAKE_PRESETS: Record<number, string[]> = {
  1: [ // 도면 파악
    "핀번호 오기입",
    "단자대 번호 오기입",
  ],
  2: [ // 제어반 & 외부 부하 세팅
    "MCCB 또는 핀베이스 상하 반전",
    "제어반 400×420을 420×400으로 고정",
    "핀베이스 나사 체결 불량 (흔들림/탈착)",
  ],
  3: [ // 제도 및 배관
    "새들 누락",
    "배관 커넥터 누락",
    "배관 씹힘",
    "배관 수평화 실패",
    "배관 커넥터 제어반에 올라타지 않음",
  ],
  4: [ // 입선 및 외부 완성
    "도면과 다른 기구배치 (상하 반전)",
    "푸쉬버튼 NO/NC 혼동",
    "배관별 전선수와 상이",
    "외부 단자대 체결순서 미준수",
    "전선 길이 재단 실패",
  ],
  5: [ // 주회로 & 보조회로 배선
    "FLS 접지선 보호도체 단자대 미연결",
    "극성 반대 결선",
    "색상 규칙 위반",
    "단자대 번호 오결선",
  ],
  6: [ // 케이블 고정 & 벨테스터
    "케이블 새들 누락",
    "외부/제어반 단자대 케이블 전선 갈-흑-회 상순 미준수",
    "퓨즈홀더 커버 안 씌움",
    "컨트롤박스 네 모서리 전부 고정 X",
  ],
}

export const PROBLEMS = Array.from({ length: 18 }, (_, i) => ({
  no: i + 1,
  type: i < 9 ? 'FLS' : 'LS',
  diagrams: [] as string[],
}))

export const FLS_PROBLEMS = PROBLEMS.filter(p => p.type === 'FLS')
export const LS_PROBLEMS = PROBLEMS.filter(p => p.type === 'LS')

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function fmtTimeLabel(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`
  if (m > 0) return `${m}분 ${sec > 0 ? sec + '초' : ''}`
  return `${sec}초`
}

export const STORAGE_USER_KEY = 'elec_trainer_user'
export const STORAGE_DISQUALIFY_KEY = 'elec_trainer_disqualify'

export const DEFAULT_DISQUALIFY = [
  '지급된 재료 이외의 재료 사용',
  '배선 작업 미완성 (미완성 상태로 제출)',
  '주어진 시간 초과',
  '시험 중 타인의 도움을 받은 경우',
  '수험자 본인이 완성 작품을 파손한 경우',
  '전선 피복을 벗기지 않고 접속',
  '단자나 터미널에 전선을 2가닥 이상 결선',
  '나사 조임 불량으로 전선이 쉽게 빠지는 경우',
  '주회로 결선 오류 (상 순서 오결선)',
  '제어회로 결선 오류로 동작 불가',
  '접지선 미연결',
  '외함 또는 금속 부품에 전선 피복 손상',
]

