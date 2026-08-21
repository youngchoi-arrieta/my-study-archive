// ═══════════════════════════════════════════════════════════════
//  공기업 필기 — 기업별 참고 프리셋
//
//  ⚠ 여기 값은 전부 「미검증 참고값」이다.
//
//  kp_ncs 테이블에 시드를 넣지 않았던 이유는 그대로 유효하다 —
//  영역 구성과 문항수는 기업마다 다르고 회차마다 바뀌어서,
//  미리 채워두면 "확인했다고 착각한 값"이 남는다.
//
//  그래서 자동으로 들어가지 않는다. 버튼을 눌러 불러온 행에는
//  memo 에 미확인 표시가 자동으로 붙고, 화면에 ⚠ 배지가 뜬다.
//  공고를 열어 확인한 뒤 memo 를 직접 고쳐 지우면 배지가 사라진다.
//
//  출처: 사용자가 별도로 조사한 정리표 (2026-08 시점).
//  공식 공고가 아니므로 숫자가 틀릴 수 있고, 특히 아래는 자주 바뀐다.
//    · 문항수·시간 (회차마다 조정됨)
//    · 영역 구성 (직렬·채용유형별로 다름)
//    · 전공 출제 범위 (법규 추가/제외)
// ═══════════════════════════════════════════════════════════════

import { NcsAreaKey, NcsRow, emptyNcsRow } from './constants-koreapub-ncs'

/** 프리셋에 미확인 표시로 박아두는 문구. 이게 memo 에 남아 있으면 ⚠ 배지가 뜬다 */
export const UNVERIFIED = '⚠ 참고 프리셋 — 공고 미확인'

export interface WrittenPreset {
  /** COMPANIES 의 id. 없는 기업은 이름으로 매칭할 수 있게 aliases 를 둔다 */
  id: string
  aliases?: string[]
  name: string
  areas: NcsAreaKey[]
  ncsLabel?: string
  ncsQ: number | null
  ncsMin: number | null
  majorLabel?: string
  majorQ: number | null
  majorMin: number | null
  extras?: { label: string; q: number | null; min: number | null }[]
  totalMin?: number | null
  combined?: boolean
  /** NCS : 전공 배점 비율 */
  ratio: string
  /** 출제 유형 — PSAT형 / 모듈형 / 피듈형 */
  style: string
  /** 전공 출제 범위와 특징 */
  major: string
}

export const WRITTEN_PRESETS: WrittenPreset[] = [
  {
    id: 'kesco', name: '한국전기안전공사',
    areas: ['comm', 'math', 'solve', 'resource', 'info', 'org'],
    ncsQ: 50, ncsMin: 60, majorQ: 50, majorMin: 60,
    ratio: '50 : 50', style: '모듈형~피듈형',
    major: '전기기사 5과목 + 전기사업법·전기안전관리법 등 관련 법규 출제',
  },
  {
    id: 'kps', name: '한전KPS',
    areas: ['comm', 'math', 'solve', 'resource', 'info'],
    ncsQ: 50, ncsMin: 50, majorQ: 50, majorMin: 50,
    ratio: '66.7 : 33.3 (NCS 100점 : 전공 50점)', style: '피듈형',
    major: '전기기사 5과목 중심. NCS 배점 비중이 전공의 2배로 매우 높음',
  },
  {
    id: 'kepco', name: '한국전력공사',
    areas: ['comm', 'math', 'solve', 'resource', 'info'],
    ncsQ: 40, ncsMin: null, majorQ: 15, majorMin: null, totalMin: 70, combined: true,
    ratio: '40 : 60', style: 'PSAT형~피듈형',
    major: '전기기사 5과목. 감점제(-0.2~0.25점) 적용으로 전략적 풀이 필요',
  },
  {
    id: 'khnp', aliases: ['한국수력원자력', '한수원'], name: '한국수력원자력',
    areas: ['comm', 'math', 'solve', 'resource', 'org'],
    ncsQ: 50, ncsMin: null, majorQ: 30, majorMin: null, totalMin: 90, combined: true,
    ratio: '30 : 70', style: 'PSAT형',
    major: '전기기사 범위 + 회사상식 및 한국사 일부 포함',
  },
  {
    id: 'komipo', aliases: ['발전5사', '남동발전', '남부발전', '동서발전', '서부발전', '중부발전'],
    name: '발전 5사 (남동·남부·동서·서부·중부)',
    areas: ['comm', 'math', 'solve', 'resource', 'tech', 'info'],
    ncsQ: 30, ncsMin: null, majorQ: 50, majorMin: null, totalMin: 85, combined: true,
    ratio: '20~30 : 70~80', style: '피듈형~PSAT형',
    major: '전기기사 5과목 + 제어공학·전기응용 일부 추가. 전공 배점 높음. 회차별로 70~80문항 / 80~90분 사이에서 조정됨',
  },
  {
    id: 'korail', name: '한국철도공사 (코레일)',
    areas: ['comm', 'math', 'solve'],
    ncsQ: 25, ncsMin: null, majorQ: 25, majorMin: null, totalMin: 60, combined: true,
    ratio: '50 : 50', style: 'PSAT형',
    major: '전기일반·전기기사 수준. 철도법령 추가 시 문항 수 변동 가능',
  },
  {
    id: 'seoulmetro', aliases: ['서울교통공사', '서교공'], name: '서울교통공사',
    areas: ['comm', 'math', 'solve', 'resource', 'info', 'tech', 'org', 'self', 'people', 'ethic'],
    ncsQ: 40, ncsMin: null, majorQ: 40, majorMin: null, totalMin: 90, combined: true,
    ratio: '50 : 50', style: '순수 모듈형',
    major: '전기이론·전기기기·전력공학 등. 모듈 기본서 암기 위주',
  },
  {
    id: 'kogas', aliases: ['한국가스공사', '가스공사'], name: '한국가스공사',
    areas: ['comm', 'math', 'solve', 'info', 'tech'],
    ncsQ: 16, ncsMin: null, majorQ: 64, majorMin: null, totalMin: 90, combined: true,
    ratio: '20 : 80', style: '피듈형',
    major: '전공 비중 및 계산 난이도가 매우 높음 (전기기사 + 전기응용)',
  },
  {
    id: 'kr', aliases: ['국가철도공단', 'KR'], name: '국가철도공단',
    areas: ['comm', 'math', 'solve', 'resource', 'info'],
    ncsQ: 40, ncsMin: null, majorQ: 40, majorMin: null, totalMin: 100, combined: true,
    ratio: '50 : 50', style: '피듈형',
    major: '전기기사 수준. NCS/전공 각 50점 균등 배점',
  },
  {
    id: 'lh', aliases: ['한국토지주택공사', 'LH'], name: '한국토지주택공사',
    areas: ['comm', 'math', 'solve', 'tech'],
    ncsQ: 35, ncsMin: null, majorQ: 35, majorMin: null, totalMin: 70, combined: true,
    ratio: '50 : 50', style: 'PSAT형',
    major: '전기기사 수준 전공 출제',
  },
]

export const presetFor = (companyId: string, name?: string): WrittenPreset | undefined =>
  WRITTEN_PRESETS.find(p =>
    p.id === companyId ||
    (name ? p.aliases?.some(a => name.includes(a)) || name.includes(p.name) : false))

/** 프리셋을 NcsRow 로 — 미확인 표시를 memo 에 박아서 돌려준다 */
export function applyPreset(companyId: string, p: WrittenPreset, base?: NcsRow): NcsRow {
  const row = base ?? emptyNcsRow(companyId)
  return {
    ...row,
    areas: Object.fromEntries(p.areas.map(k => [k, { on: true, q: null }])),
    ncs_label: p.ncsLabel ?? row.ncs_label,
    ncs_q: p.ncsQ, ncs_min: p.ncsMin,
    major_label: p.majorLabel ?? row.major_label,
    major_q: p.majorQ, major_min: p.majorMin,
    extras: p.extras ?? [],
    combined: p.combined ?? false,
    total_min: p.totalMin ?? null,
    cutoff: row.cutoff,
    memo: `${UNVERIFIED} · ${p.ratio} · ${p.style} · ${p.major}`,
  }
}

export const isUnverified = (row: { memo: string | null }) => !!row.memo?.includes(UNVERIFIED)
