// 병기고 — 상수
// -------------------------------------------------------------------
// 계열 색, 상태, 소화 체크리스트, 출고 형태. 화면은 전부 여기서 읽는다.
// 체크 항목을 바꾸고 싶으면 DIGEST_CHECKS 만 고치면 된다.

export type UnitStatus = 'concept' | 'building' | 'active' | 'retired'

export const STATUS_META: Record<UnitStatus, { label: string; color: string; dot: string }> = {
  concept:  { label: '설계',  color: '#94A3B8', dot: '○' },
  building: { label: '제작',  color: '#E0B341', dot: '◐' },
  active:   { label: '가동',  color: '#34D399', dot: '●' },
  retired:  { label: '퇴역',  color: '#6B7280', dot: '×' },
}
export const STATUS_ORDER: UnitStatus[] = ['concept', 'building', 'active', 'retired']

// 계열 — 자유 입력이지만, 아는 이름이면 색이 붙는다
export const FAMILIES: { label: string; color: string }[] = [
  { label: '증명·시험', color: '#5DCAA5' },
  { label: '운전·제어', color: '#85B7EB' },
  { label: '보호',      color: '#F0997B' },
  { label: '통신',      color: '#A78BFA' },
  { label: '시장·VPP',  color: '#E0B341' },
  { label: '부하',      color: '#F472B6' },
  { label: '현장',      color: '#34D399' },
  { label: '코어',      color: '#FBBF24' },
]
const FAMILY_FALLBACK = '#94A3B8'
export const familyColor = (f: string | null | undefined) =>
  FAMILIES.find(x => x.label === (f ?? '').trim())?.color ?? FAMILY_FALLBACK
export const CORE_FAMILY = '코어'

// 소화 체크 — 다 채워야 출고할 수 있다
//   auto 가 있는 항목은 파일 유무로 자동 판정 (손으로 못 끔)
export interface DigestCheck {
  key: string
  label: string
  hint: string
  auto?: 'note'
}
export const DIGEST_CHECKS: DigestCheck[] = [
  { key: 'note',      label: '제1원리 노트가 붙어 있다',
    hint: '이 리비전의 📐 칸에 PDF 가 올라가 있으면 자동으로 켜져요.', auto: 'note' },
  { key: 'explain',   label: '설명 모드로 핵심 장면을 비전문가에게 말로 풀 수 있다',
    hint: 'IT 출신 동료에게 화면 하나씩 짚어 가며 3분 안에.' },
  { key: 'why',       label: '엔진의 식마다 "왜 실제 장비가 이렇게 모델링되는지" 답할 수 있다',
    hint: '1차 지연·포화·샘플링 주기 — 수식이 아니라 근거를.' },
  { key: 'public',    label: '규칙·숫자는 공개 자료·예시값뿐이다',
    hint: '고객 NDA 수치·사내 문서 원문 없음. [확인]/[추정]/[가정]/[불명] 꼬리표 정리.' },
  { key: 'noprivate', label: '개인 노트·채팅 제목을 출처로 넣지 않았다',
    hint: '사내판에는 활용처 칸이 없어도 된다. 제목도 무난하게.' },
  { key: 'bell',      label: '벨 날이 없다',
    hint: '누가 들고 휘둘러도 특정 사람·부서·사업을 평가하는 근거로 쓰일 문구가 없다.' },
  { key: 'refs',      label: '참조문헌·출발 프로젝트·대응 표준이 적혀 있다',
    hint: '기체 정보의 표준·참조 칸과 HTML 안의 출처 표기.' },
]

// 출고 형태 — 자유 입력 + 자주 쓰는 것
export const RELEASE_FORMS = ['HTML 실행본', '소스 zip', '사내판 PDF', '시연(화면 공유)', '드라이브 업로드']

// 파일 세 칸
export type Slot = 'html' | 'zip' | 'note'
export const SLOT_META: Record<Slot, { icon: string; label: string; accept: string; ext: RegExp }> = {
  html: { icon: '▶', label: '실행 HTML',     accept: '.html,.htm,text/html', ext: /\.html?$/i },
  zip:  { icon: '📦', label: '소스 zip',      accept: '.zip,application/zip', ext: /\.zip$/i },
  note: { icon: '📐', label: '제1원리 노트',  accept: '.pdf,application/pdf', ext: /\.pdf$/i },
}
export const SLOTS: Slot[] = ['html', 'zip', 'note']

export const MAX_FILE_BYTES = 50 * 1024 * 1024
