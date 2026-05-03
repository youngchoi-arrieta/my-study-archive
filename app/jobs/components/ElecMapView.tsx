'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
export type JobZone = {
  id: string
  name: string
  nameEn: string
  x: number   // 진입난이도 1–10
  y: number   // 나와의 적합도 1–10
  growth: number  // 성장가능성 1–5
  salaryRange: string
  entryReq: string[]
  fitReason: string[]
  antiReason: string[]
  practitionerQuote: string
  practitionerYears: string
  nextStep: string
  tag: 'kr_field' | 'kr_technical' | 'kr_specialist' | 'abroad'
  status?: 'active' | 'watching' | 'pursuing'
  xNote?: string
  yNote?: string
}

// ─────────────────────────────────────────────
// 전략 카드 타입 + 기본값
// ─────────────────────────────────────────────
type StrategyCard = { title: string; color: string; items: string[] }

const DEFAULT_STRATEGY: StrategyCard[] = [
  { title: '즉시 액션 가능', color: '#16a34a', items: ['5/28 電気工事士2種 CBT (후쿠오카)', '전기기사 실기 결과 6/12 확인', '다산에듀 결과 대기'] },
  { title: '6개월 내 타겟', color: '#2563eb', items: ['변전설비 유지보수 업체 지원 (서류 준비)', 'JLPT N4 (7월 시험)', 'LinkedIn 외국계 FM cold outreach'] },
  { title: '2년 후 목표', color: '#7c3aed', items: ['보호계전 전문업체 경력직 이동', '電験3種 취득 (일본 기인국 피벗)', 'CBRE/Equinix 전기 엔지니어 지원'] },
]

// ─────────────────────────────────────────────
// 기본 데이터
// ─────────────────────────────────────────────
const DEFAULT_ZONES: JobZone[] = [
  {
    id: 'field', name: '현장 전기공사', nameEn: 'Field Electrical Construction',
    x: 2.5, y: 2.0, growth: 2,
    xNote: '기능사 있으면 즉시 진입 가능. 기술 장벽 낮음.',
    yNote: '현장 문화 부적합, 가족 분리 악화, 지적 자극 부족. 세 가지 모두 명백한 비적합.',
    salaryRange: '3,000 – 4,500만',
    entryReq: ['전기기능사 or 기사', '체력 및 현장 적응'],
    fitReason: ['자격증 이미 보유', '빠른 진입 가능'],
    antiReason: ['현장 문화 맞지 않음', '가족 분리 상황 악화', '지적 자극 적음'],
    practitionerQuote: '40대 초반 입문해서 20년. 직접 부딪혀서 경험하라.',
    practitionerYears: '20년차 (전기기사)',
    nextStep: '진입 불필요 – 명백한 비적합',
    tag: 'kr_field', status: 'watching',
  },
  {
    id: 'facility', name: '시설관리', nameEn: 'Building Facility Management',
    x: 2.0, y: 2.5, growth: 2,
    xNote: '기능사로 진입 가능. 오히려 기사 보유가 역효과.',
    yNote: '반복 업무, 성장 한계. 긴급 생계 외엔 투자 가치 낮음.',
    salaryRange: '3,000 – 4,200만',
    entryReq: ['전기기능사 (기사 숨겨야)', '야간 포함 교대 가능'],
    fitReason: ['즉시 진입 가능', '실내 근무'],
    antiReason: ['기사 보유 시 "오래 못 있을 사람"으로 분류', '반복적 업무', '성장 한계'],
    practitionerQuote: '기사증 있고 경력 없으면 걸림돌. 처음 취직할 땐 기능사만 이력서에 적으세요.',
    practitionerYears: '11년차 (전기기사)',
    nextStep: '긴급 생계 필요 시에만 고려',
    tag: 'kr_field',
  },
  {
    id: 'solar', name: '태양광 / 신재생', nameEn: 'Solar & Renewable Energy',
    x: 3.5, y: 4.0, growth: 3,
    xNote: '기사 취득 후 교육 이수면 진입. 중간 난이도.',
    yNote: '시장 성장 중이지만 계전/보호보다 기술 깊이 낮음. 지방 현장 多.',
    salaryRange: '3,500 – 5,500만',
    entryReq: ['전기기사', '태양광 관련 교육 이수'],
    fitReason: ['시장 성장 중', '기사 취득 즉시 지원 가능'],
    antiReason: ['계전/보호보다 기술 깊이 낮음', '지방 현장 多'],
    practitionerQuote: '시설관리쪽으로 시작하면 태양광, 발전기 다 배울 수 있습니다.',
    practitionerYears: '37년차 (시공기사)',
    nextStep: '보호계전 방향 확정 전 브릿지 가능',
    tag: 'kr_technical',
  },
  {
    id: 'construction_mgmt', name: '공무 / 시공관리', nameEn: 'Construction Management',
    x: 4.5, y: 5.5, growth: 3,
    xNote: '기사 필수, 도면해석 능력 필요. 현장 경험 선호 → 미경력자엔 중간 장벽.',
    yNote: '도면해석 적성 확인됨. 기사 학습 내용 직결. 단 현장 문화 일부 포함.',
    salaryRange: '4,000 – 6,500만',
    entryReq: ['전기기사 필수', '도면 해석 능력', '현장 경험 선호'],
    fitReason: ['도면 해석 적성 확인됨', '기사 학습 중 배운 내용 직결'],
    antiReason: ['실무 경험 부재', '현장 문화 일부 포함'],
    practitionerQuote: '현실적인 첫 단계는 전기공사업체 공무 시공관리 쪽.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '보호계전 진입 전 경력 브릿지로 검토 가능',
    tag: 'kr_technical',
  },
  {
    id: 'substation', name: '변전설비 유지보수', nameEn: 'Substation Maintenance',
    x: 6.0, y: 7.5, growth: 4,
    xNote: '기사 + 도면·계전 경험 필요. 한전 협력사는 경력 선호 → 진입장벽 6.',
    yNote: 'Δ-Y 차동보호 독립 재구성 경험이 있음. 5년차 현직자가 "아깝다"고 평가한 수준. 보호계전 진입 전 최적 브릿지.',
    salaryRange: '4,500 – 7,500만',
    entryReq: ['전기기사', '도면해석 + 계전 세팅 경험', '한전 협력사 or 변전 전문업체'],
    fitReason: ['수리 감각 + 기사 수준 이해도 이미 보유', '보호계전 진입 전 최적 브릿지', 'Δ-Y 차동보호 재구성 경험'],
    antiReason: ['초기 경력 증명 필요', '야간 점검 포함 가능'],
    practitionerQuote: '수리 감각과 기사 수준 이해도가 이미 있기 때문에 현장 단순 업무로 시작하기엔 아깝습니다.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '→ 보호계전 전문업체로 이동하는 흐름이 가장 좋습니다',
    tag: 'kr_technical', status: 'watching',
  },
  {
    id: 'relay', name: '보호계전 엔지니어링', nameEn: 'Protection Relay Engineering',
    x: 8.0, y: 9.5, growth: 5,
    xNote: '변전 실무 경력 2년+ 사실상 필수. 국내 전문업체 소수 → 진입장벽 8.',
    yNote: '물리학 1원론 계산 + Δ-Y CT 결선 독립 재구성 + Blackburn 참고 수준. 가장 높은 적합도.',
    salaryRange: '5,500 – 1억+',
    entryReq: ['변전 실무 경력 2년+', '계전 세팅 실전 경험', '릴레이 도면 해석', '전기기사 필수'],
    fitReason: ['물리학 배경 → 1원론적 계산 강점', 'Δ-Y 차동보호 CT 결선 독립 재구성', '수리 감각과 기사급 이해도 확인', 'Blackburn & Domin 참고 수준'],
    antiReason: ['진입 장벽 높음 – 경력 필수', '국내 전문업체 소수', '한국 진입 루트 좁음'],
    practitionerQuote: '계전 전문 업체나 발전사 협력사로 이동하는 흐름이 가장 좋습니다.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '← 변전설비 유지보수 경력 2년 후 타겟',
    tag: 'kr_specialist', status: 'watching',
  },
  {
    id: 'foreign_dc', name: '외국계 FM / 데이터센터', nameEn: 'Foreign FM / Data Center',
    x: 7.0, y: 8.5, growth: 5,
    xNote: '기사 + 실무경력 + 영어 실무 → 세 가지 동시 필요. 경력직 우선 채용.',
    yNote: 'TOEFL 109 + 외국계 문화 적응력 + Lucy와 장기 합류 가능성. 영어가 차별화 포인트.',
    salaryRange: '5,500 – 1억+',
    entryReq: ['전기기사 + 실무 경력', '영어 실무 가능 (TOEFL 109 ✓)', '외국계 채용: CBRE / JLL / Equinix / NTT'],
    fitReason: ['TOEFL 109 – 영어 차별화 확실', '외국계 문화 적응력 (콜롬비아 1.5년)', '배우자 Lucy와 장기 합류 가능성'],
    antiReason: ['국내 전기 실무 경력 아직 없음', '초기 진입은 경력직 우선'],
    practitionerQuote: '영어 강점도 있기 때문에 외국계 설비사나 장비사까지 확장 가능성이 있습니다.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '변전/계전 경력 1-2년 후 LinkedIn cold outreach 타겟',
    tag: 'kr_specialist', status: 'watching',
  },
  {
    id: 'japan', name: '일본 전기직 (특정기능→기인국)', nameEn: 'Japan: 特定技能 → 技人国',
    x: 6.5, y: 8.0, growth: 5,
    xNote: '전기공사사 2종 + JLPT N4 (특정기능), N2 (高度専門職) → 단계적 장벽. 언어가 핵심 변수.',
    yNote: 'KAIST→법무성 지정대학 +10, Nano Letters +20, JLPT N2 +10 = 80점 고도전문직. Lucy와 재결합 타임라인이 핵심 제약.',
    salaryRange: '¥350 – 600만/년',
    entryReq: ['전기공사사 2종 (5/28 시험)', 'JLPT N4 (특정기능 최소)', 'JLPT N2 → 高度専門職 80점 목표', '건設분야 특정기능 평가시험'],
    fitReason: ['KAIST → 法務省 지정대학 +10점', 'Nano Letters → 研究実績 +20점', 'JLPT N2 취득 시 +10점 = 高度専門職 80점', '電験3種 → 技人国 기술 직무 피벗'],
    antiReason: ['특정기능1호: 가족 동반 불가 (5년)', '기인국: 회사 스폰서 필요', 'Lucy와 재결합 최소 5년+'],
    practitionerQuote: '方向さえ正せば遅くない出発です。（방향만 잡으면 늦지 않은 출발）',
    practitionerYears: '5년차 조언 + 직접 비자 리서치',
    nextStep: '5/28 電気工事士2種 → JLPT N4(7월) → 특정기능 → 電験3種 병행',
    tag: 'abroad', status: 'pursuing',
  },
  {
    id: 'canada', name: '캐나다 워홀', nameEn: 'Canada Working Holiday',
    x: 4.0, y: 6.5, growth: 4,
    xNote: '이미 초청장 수령. 진입 장벽은 현지 면허 인증 (IBEW 등)이 남은 관문.',
    yNote: 'TOEFL 109 즉시 활용, Lucy와 이주 가능성. 단 한국 계전 경력이 단절됨.',
    salaryRange: 'CAD 50,000 – 75,000',
    entryReq: ['IEC 초청장 수령 완료', 'IMM 5707 완료', '바이오메트릭스 등록 완료 (4/17)'],
    fitReason: ['TOEFL 109 영어 즉시 활용', '전기 실무 600+시간 경력 명시', 'Lucy와 함께 이주 가능성'],
    antiReason: ['전기 면허 현지 인증 필요 (IBEW 등)', '초기 단순 직무 가능성', '한국 계전 경력 단절'],
    practitionerQuote: '영어 강점과 기술직 자격증의 조합 – 늦지 않은 출발.',
    practitionerYears: '자체 분석',
    nextStep: '비자 발급 대기 중 – 일본 트랙과 병행 검토',
    tag: 'abroad', status: 'pursuing',
  },
  {
    id: 'kepco', name: '한전 / 공기업 공채', nameEn: 'KEPCO & Public Corp',
    x: 9.0, y: 2.5, growth: 2,
    xNote: '점수표 경쟁. 나이+비선형 경력으로 사실상 최고 난이도.',
    yNote: '안정성은 높으나 비선형 이력 환산 안 됨. 전국 발령 + 가족 분리 상황 악화.',
    salaryRange: '5,000 – 8,000만 (정년)',
    entryReq: ['점수표 경쟁 (NCS/전공/영어/자격)', '나이 제한 사실상 존재', '일반전형 35세 이후 극히 불리'],
    fitReason: ['전기기사 점수표 반영', '물리 전공 일부 가산'],
    antiReason: ['비선형 경력 점수 환산 거의 안 됨', '나이 + 기혼 + 이력 비정형', '가족 분리 상황에서 전국 발령'],
    practitionerQuote: '기혼자도 간혹 들어옵니다. 첫 직장이 매우 중요하다고 생각합니다.',
    practitionerYears: '36년차 (시공기사)',
    nextStep: '현실적 진입 가능성 매우 낮음 – 우선순위 제외',
    tag: 'kr_specialist',
  },
]

const TAG_COLORS: Record<string, string> = {
  kr_field: '#64748b', kr_technical: '#2563eb', kr_specialist: '#7c3aed', abroad: '#059669',
}
const TAG_LABELS: Record<string, string> = {
  kr_field: '국내 현장직', kr_technical: '국내 기술직', kr_specialist: '국내 전문직', abroad: '해외',
}
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pursuing: { label: '추진 중', color: '#16a34a' },
  watching: { label: '검토 중', color: '#2563eb' },
  active: { label: '액티브', color: '#d97706' },
}

function GrowthDots({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: i <= n ? '#3b82f6' : '#1f2937',
          border: '1px solid #374151'
        }} />
      ))}
    </div>
  )
}

// ─── 산정 기준 패널 ───
function CriteriaPanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16,
        padding: 28, maxWidth: 560, width: '92%', maxHeight: '82vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>📐 축 산정 기준</h2>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {([
          {
            axis: 'X축 — 진입 난이도', color: '#f87171',
            desc: '지금 시점에서 이 직무에 첫 취업하기 위해 필요한 실질적 장벽. 자격증·경력·나이·경쟁 강도를 종합.',
            items: [
              { range: '1 – 3', label: '낮음', note: '기능사 있으면 즉시 지원 가능. 경력 불문. (시설관리, 현장공사)' },
              { range: '4 – 6', label: '보통', note: '기사 필요 + 도면해석 능력 or 관련 교육. 미경력자 진입 가능하나 선호 아님. (공무, 태양광, 캐나다)' },
              { range: '7 – 8', label: '높음', note: '기사 + 실무경력 2년+ 사실상 필수. 외국어 요건 추가. (보호계전, 외국계 DC, 일본)' },
              { range: '9 – 10', label: '극한', note: '점수표 경쟁 + 나이제한 사실상 적용. 비선형 이력 환산 거의 불가. (한전/공기업 공채)' },
            ]
          },
          {
            axis: 'Y축 — 나와의 적합도', color: '#34d399',
            desc: '현재 나의 배경(물리학 전공, 기사급 이해도, 영어, 가족 분리 상황, 지적 성향)과 해당 직무의 매칭도.',
            items: [
              { range: '1 – 3', label: '비적합', note: '현장 문화, 야간 교대, 단순 반복 → 가족 분리 악화 or 지적 자극 없음.' },
              { range: '4 – 6', label: '보통', note: '진입 가능하고 성장 여지 있지만 핵심 강점이 충분히 활용 안 됨.' },
              { range: '7 – 8', label: '높음', note: '수리 감각, 도면해석, 영어 or 언어 강점이 실질적 차별화로 작동하는 직무.' },
              { range: '9 – 10', label: '최적', note: '물리학 1원론 계산력 + 비선형 이력 전체가 자산이 되는 직무. (보호계전)' },
            ]
          },
          {
            axis: '원 크기 — 성장가능성', color: '#93c5fd',
            desc: '5–10년 뒤 이 직무에서 연봉·포지션·선택지가 얼마나 확장되는가.',
            items: [
              { range: '●○○○○ (1–2)', label: '낮음', note: '정년까지 비슷한 업무. 이직 레버리지 낮음.' },
              { range: '●●●○○ (3)', label: '보통', note: '경력 쌓이면 관리직 전환 가능. 국내 한정.' },
              { range: '●●●●● (5)', label: '높음', note: '전문성이 글로벌 수요와 연결. 희소성 증가.' },
            ]
          }
        ] as const).map(block => (
          <div key={block.axis} style={{ marginBottom: 22 }}>
            <p style={{ color: block.color, fontWeight: 700, fontSize: 13, margin: '0 0 5px' }}>{block.axis}</p>
            <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 10px', lineHeight: 1.6 }}>{block.desc}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {block.items.map(item => (
                <div key={item.range} style={{ display: 'flex', gap: 10, background: '#1e293b', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ color: block.color, fontSize: 11, fontWeight: 700, minWidth: 80, flexShrink: 0 }}>{item.range}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}><span style={{ color: '#e2e8f0', fontWeight: 600 }}>{item.label} </span>{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: '#172554', borderRadius: 10, padding: '12px 14px', border: '1px solid #1e40af' }}>
          <p style={{ color: '#93c5fd', fontSize: 11, fontWeight: 600, margin: '0 0 4px' }}>⚠ 주관적 기준</p>
          <p style={{ color: '#bfdbfe', fontSize: 11, margin: 0, lineHeight: 1.6 }}>
            이 좌표는 현재 시점의 정보와 판단을 기반으로 책정됨. 새 정보가 추가될 때마다 편집 모드로 수정 권장.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── 편집 폼 ───
function EditPanel({ zone, onSave, onCancel }: {
  zone: JobZone; onSave: (z: JobZone) => void; onCancel: () => void
}) {
  const [d, setD] = useState<JobZone>({ ...zone })
  const set = <K extends keyof JobZone>(k: K, v: JobZone[K]) => setD(p => ({ ...p, [k]: v }))
  const setArr = (k: 'entryReq' | 'fitReason' | 'antiReason', t: string) =>
    setD(p => ({ ...p, [k]: t.split('\n').map(s => s.trim()).filter(Boolean) }))

  const inp: React.CSSProperties = {
    width: '100%', background: '#1e293b', border: '1px solid #334155',
    borderRadius: 8, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, boxSizing: 'border-box',
  }
  const ta: React.CSSProperties = { ...inp, resize: 'vertical' as const, minHeight: 60, fontFamily: 'inherit' }
  const lbl: React.CSSProperties = { color: '#64748b', fontSize: 11, marginBottom: 3, display: 'block' }

  return (
    <div style={{
      background: '#0f172a', borderRadius: 16, border: '1px solid #f59e0b55',
      padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
      overflowY: 'auto', maxHeight: '78vh',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>✏ 편집 중: {d.name}</span>
        <button onClick={onCancel} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* X 슬라이더 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={lbl}>X — 진입 난이도</span>
          <span style={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>{d.x.toFixed(1)}</span>
        </div>
        <input type="range" min={1} max={10} step={0.5} value={d.x}
          onChange={e => set('x', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#f87171' }} />
        <span style={lbl}>산정 근거</span>
        <input style={inp} value={d.xNote || ''} onChange={e => set('xNote', e.target.value)} placeholder="이 점수를 매긴 이유" />
      </div>

      {/* Y 슬라이더 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={lbl}>Y — 나와의 적합도</span>
          <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>{d.y.toFixed(1)}</span>
        </div>
        <input type="range" min={1} max={10} step={0.5} value={d.y}
          onChange={e => set('y', parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#34d399' }} />
        <span style={lbl}>산정 근거</span>
        <input style={inp} value={d.yNote || ''} onChange={e => set('yNote', e.target.value)} placeholder="이 점수를 매긴 이유" />
      </div>

      {/* 성장가능성 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={lbl}>성장가능성 (1–5)</span>
          <span style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700 }}>{d.growth}</span>
        </div>
        <input type="range" min={1} max={5} step={1} value={d.growth}
          onChange={e => set('growth', parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#3b82f6', marginBottom: 4 }} />
        <GrowthDots n={d.growth} />
      </div>

      <div>
        <span style={lbl}>급여 범위</span>
        <input style={inp} value={d.salaryRange} onChange={e => set('salaryRange', e.target.value)} />
      </div>

      <div>
        <span style={lbl}>상태</span>
        <select style={inp} value={d.status || ''}
          onChange={e => set('status', (e.target.value || undefined) as JobZone['status'])}>
          <option value="">없음</option>
          <option value="pursuing">추진 중</option>
          <option value="watching">검토 중</option>
          <option value="active">액티브</option>
        </select>
      </div>

      {(['entryReq', 'fitReason', 'antiReason'] as const).map(k => (
        <div key={k}>
          <span style={lbl}>
            {k === 'entryReq' ? '진입 요건' : k === 'fitReason' ? '나와 맞는 점' : '걸리는 점'}
            {' '}(줄바꿈으로 구분)
          </span>
          <textarea style={ta} value={d[k].join('\n')} onChange={e => setArr(k, e.target.value)} />
        </div>
      ))}

      <div>
        <span style={lbl}>현직자 조언</span>
        <textarea style={{ ...ta, minHeight: 48 }} value={d.practitionerQuote}
          onChange={e => set('practitionerQuote', e.target.value)} />
      </div>
      <div>
        <span style={lbl}>출처</span>
        <input style={inp} value={d.practitionerYears} onChange={e => set('practitionerYears', e.target.value)} />
      </div>
      <div>
        <span style={lbl}>다음 단계</span>
        <textarea style={{ ...ta, minHeight: 40 }} value={d.nextStep} onChange={e => set('nextStep', e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button onClick={() => onSave(d)} style={{
          flex: 1, background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>저장</button>
        <button onClick={onCancel} style={{
          flex: 1, background: '#1e293b', color: '#94a3b8', border: 'none',
          borderRadius: 8, padding: '9px 0', fontSize: 13, cursor: 'pointer',
        }}>취소</button>
      </div>
    </div>
  )
}

// ─── 읽기 패널 ───
function ReadPanel({ zone, onEdit }: { zone: JobZone; onEdit: () => void }) {
  return (
    <div style={{
      background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b',
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto', maxHeight: '78vh',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: TAG_COLORS[zone.tag], display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#64748b', fontSize: 11 }}>{TAG_LABELS[zone.tag]}</span>
          {zone.status && (
            <span style={{
              padding: '1px 8px', borderRadius: 20, fontSize: 10,
              background: STATUS_BADGE[zone.status].color + '22', color: STATUS_BADGE[zone.status].color,
              border: '1px solid ' + STATUS_BADGE[zone.status].color + '44',
            }}>{STATUS_BADGE[zone.status].label}</span>
          )}
          <button onClick={onEdit} style={{
            marginLeft: 'auto', background: '#1e293b', color: '#94a3b8',
            border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
          }}>✏ 편집</button>
        </div>
        <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>{zone.name}</h2>
        <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>{zone.nameEn}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: '진입 난이도', val: zone.x, color: '#f87171', note: zone.xNote },
          { label: '나와의 적합도', val: zone.y, color: '#34d399', note: zone.yNote },
        ].map(item => (
          <div key={item.label} style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 4px' }}>{item.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, background: '#0f172a', borderRadius: 2 }}>
                <div style={{ width: `${item.val * 10}%`, height: '100%', background: item.color, borderRadius: 2 }} />
              </div>
              <span style={{ color: item.color, fontSize: 12, fontWeight: 700 }}>{item.val}/10</span>
            </div>
            {item.note && <p style={{ color: '#475569', fontSize: 10, margin: '5px 0 0', lineHeight: 1.5 }}>{item.note}</p>}
          </div>
        ))}
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 6px' }}>성장가능성</p>
          <GrowthDots n={zone.growth} />
        </div>
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 4px' }}>급여 범위</p>
          <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, margin: 0 }}>{zone.salaryRange}</p>
        </div>
      </div>

      <div>
        <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 6px', fontWeight: 600 }}>진입 요건</p>
        {zone.entryReq.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <span style={{ color: '#3b82f6', fontSize: 10, marginTop: 2 }}>▸</span>
            <span style={{ color: '#cbd5e1', fontSize: 12 }}>{r}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <p style={{ color: '#34d399', fontSize: 11, margin: '0 0 5px', fontWeight: 600 }}>✓ 나와 맞는 점</p>
          {zone.fitReason.map((r, i) => <p key={i} style={{ color: '#6ee7b7', fontSize: 11, margin: '0 0 3px' }}>· {r}</p>)}
        </div>
        <div>
          <p style={{ color: '#f87171', fontSize: 11, margin: '0 0 5px', fontWeight: 600 }}>✗ 걸리는 점</p>
          {zone.antiReason.map((r, i) => <p key={i} style={{ color: '#fca5a5', fontSize: 11, margin: '0 0 3px' }}>· {r}</p>)}
        </div>
      </div>

      <div style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #3b82f6' }}>
        <p style={{ color: '#94a3b8', fontSize: 10, margin: '0 0 6px' }}>현직자 조언 — {zone.practitionerYears}</p>
        <p style={{ color: '#e2e8f0', fontSize: 12, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
          "{zone.practitionerQuote}"
        </p>
      </div>

      <div style={{ background: '#172554', borderRadius: 10, padding: '10px 14px', border: '1px solid #1e40af' }}>
        <p style={{ color: '#93c5fd', fontSize: 10, margin: '0 0 4px', fontWeight: 600 }}>다음 단계</p>
        <p style={{ color: '#dbeafe', fontSize: 12, margin: 0 }}>{zone.nextStep}</p>
      </div>
    </div>
  )
}

// ─── 전략 카드 인라인 편집 ───
function StrategyEditInline({ card, onSave, onCancel }: {
  card: StrategyCard
  onSave: (updated: StrategyCard) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(card.title)
  const [itemsText, setItemsText] = useState(card.items.join('\n'))

  const inp: React.CSSProperties = {
    width: '100%', background: '#0f172a', border: '1px solid #334155',
    borderRadius: 6, padding: '5px 8px', color: '#e2e8f0', fontSize: 12,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <span style={{ color: '#64748b', fontSize: 10, display: 'block', marginBottom: 2 }}>제목</span>
        <input style={inp} value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div>
        <span style={{ color: '#64748b', fontSize: 10, display: 'block', marginBottom: 2 }}>항목 (줄바꿈으로 구분)</span>
        <textarea
          style={{ ...inp, resize: 'vertical' as const, minHeight: 80, fontFamily: 'inherit' }}
          value={itemsText}
          onChange={e => setItemsText(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ ...card, title, items: itemsText.split('\n').map(s => s.trim()).filter(Boolean) })}
          style={{ flex: 1, background: card.color, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          저장
        </button>
        <button onClick={onCancel}
          style={{ flex: 1, background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 12, cursor: 'pointer' }}>
          취소
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
export default function ElecMapView() {
  const [zones, setZones] = useState<JobZone[]>(DEFAULT_ZONES)
  const [strategy, setStrategy] = useState<StrategyCard[]>(DEFAULT_STRATEGY)
  const [editingStratIdx, setEditingStratIdx] = useState<number | null>(null)
  const [selected, setSelected] = useState<JobZone | null>(DEFAULT_ZONES.find(z => z.id === 'relay') || null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [showCriteria, setShowCriteria] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('elec_zones').select('id, data')
      if (!data || data.length === 0) return
      const overrides: Record<string, JobZone> = {}
      data.forEach((row: { id: string; data: JobZone }) => { overrides[row.id] = row.data })
      setZones(prev => prev.map(z => overrides[z.id] ? { ...z, ...overrides[z.id] } : z))
      // 전략 카드 로드
      const stratRow = data.find((r: { id: string }) => r.id === '__strategy__')
      if (stratRow && Array.isArray((stratRow.data as unknown as { cards: StrategyCard[] }).cards)) {
        setStrategy((stratRow.data as unknown as { cards: StrategyCard[] }).cards)
      }
    }
    load()
  }, [])

  async function handleSave(updated: JobZone) {
    setZones(prev => prev.map(z => z.id === updated.id ? updated : z))
    setSelected(updated)
    setEditing(false)
    const { error } = await supabase.from('elec_zones').upsert({ id: updated.id, data: updated })
    setSaveMsg(error ? '저장 실패 ✗' : '저장 완료 ✓')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  async function saveStrategy(updated: StrategyCard[]) {
    setStrategy(updated)
    setEditingStratIdx(null)
    const { error } = await supabase.from('elec_zones').upsert({ id: '__strategy__', data: { cards: updated } })
    setSaveMsg(error ? '저장 실패 ✗' : '저장 완료 ✓')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  const W = 700, H = 420
  const PAD = { l: 64, r: 24, t: 24, b: 52 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const toSVG = (z: JobZone) => ({
    px: PAD.l + ((z.x - 1) / 9) * plotW,
    py: PAD.t + ((10 - z.y) / 9) * plotH,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {showCriteria && <CriteriaPanel onClose={() => setShowCriteria(false)} />}

      {/* 툴바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>필터:</span>
        <button onClick={() => setFilterTag(null)} style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
          background: filterTag === null ? '#3b82f6' : '#1f2937',
          color: filterTag === null ? '#fff' : '#9ca3af',
          border: '1px solid ' + (filterTag === null ? '#3b82f6' : '#374151'),
        }}>전체</button>
        {Object.entries(TAG_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setFilterTag(filterTag === k ? null : k)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: filterTag === k ? TAG_COLORS[k] : '#1f2937',
            color: filterTag === k ? '#fff' : '#9ca3af',
            border: '1px solid ' + (filterTag === k ? TAG_COLORS[k] : '#374151'),
          }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TAG_COLORS[k], marginRight: 6 }} />
            {v}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveMsg && (
            <span style={{ color: saveMsg.includes('실패') ? '#f87171' : '#34d399', fontSize: 12 }}>{saveMsg}</span>
          )}
          <button onClick={() => setShowCriteria(true)} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
          }}>📐 산정 기준</button>
        </div>
      </div>

      {/* 2열 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* SVG 맵 */}
        <div style={{ background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {[...Array(9)].map((_, i) => {
              const x = PAD.l + (i / 8) * plotW, y = PAD.t + (i / 8) * plotH
              return <g key={i}>
                <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + plotH} stroke="#1e293b" strokeWidth={1} />
                <line x1={PAD.l} y1={y} x2={PAD.l + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
              </g>
            })}
            <rect x={PAD.l} y={PAD.t} width={plotW / 2} height={plotH / 2} fill="#16a34a14" />
            <rect x={PAD.l + plotW / 2} y={PAD.t + plotH / 2} width={plotW / 2} height={plotH / 2} fill="#dc26261a" />
            <text x={PAD.l + 8} y={PAD.t + 17} fill="#22c55e" fontSize={9} opacity={0.5}>진입 쉽고 적합도 높음</text>
            <text x={PAD.l + plotW / 2 + 8} y={PAD.t + plotH - 6} fill="#ef4444" fontSize={9} opacity={0.5}>진입 어렵고 적합도 낮음</text>
            {['낮음','','보통','','높음','','매우 높음','','극한'].map((lbl, i) => (
              <text key={i} x={PAD.l + (i / 8) * plotW} y={H - 14} fill="#475569" fontSize={9} textAnchor="middle">{lbl}</text>
            ))}
            {['낮음','','보통','','높음','','매우 높음','','최적'].map((lbl, i) => (
              <text key={i} x={PAD.l - 6} y={PAD.t + ((8 - i) / 8) * plotH + 4} fill="#475569" fontSize={9} textAnchor="end">{lbl}</text>
            ))}
            <text x={PAD.l + plotW / 2} y={H - 2} fill="#64748b" fontSize={10} textAnchor="middle">진입 난이도 →</text>
            <text x={12} y={PAD.t + plotH / 2} fill="#64748b" fontSize={10} textAnchor="middle"
              transform={`rotate(-90, 12, ${PAD.t + plotH / 2})`}>나와의 적합도 →</text>

            {[['substation','relay'],['construction_mgmt','substation'],['substation','foreign_dc']].map(([a, b]) => {
              const za = zones.find(z => z.id === a), zb = zones.find(z => z.id === b)
              if (!za || !zb) return null
              const pa = toSVG(za), pb = toSVG(zb)
              return <line key={a+b} x1={pa.px} y1={pa.py} x2={pb.px} y2={pb.py}
                stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3" opacity={0.3} />
            })}

            {zones.map(z => {
              const { px, py } = toSVG(z)
              const r = 10 + z.growth * 2.5
              const isSel = selected?.id === z.id
              const isHov = hovered === z.id
              const color = TAG_COLORS[z.tag]
              const dimmed = filterTag && z.tag !== filterTag
              return (
                <g key={z.id} style={{ cursor: 'pointer' }}
                  onClick={() => { setSelected(z); setEditing(false) }}
                  onMouseEnter={() => setHovered(z.id)}
                  onMouseLeave={() => setHovered(null)}
                  opacity={dimmed ? 0.12 : 1}
                >
                  {isSel && <circle cx={px} cy={py} r={r + 5} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />}
                  {(isSel || isHov) && <circle cx={px} cy={py} r={r + 3} fill={color} opacity={0.15} />}
                  <circle cx={px} cy={py} r={r} fill={color} opacity={isSel || isHov ? 1 : 0.72}
                    stroke={isSel ? '#fff' : 'transparent'} strokeWidth={1.5} />
                  {z.status && <circle cx={px + r * 0.7} cy={py - r * 0.7} r={4}
                    fill={STATUS_BADGE[z.status].color} stroke="#0f172a" strokeWidth={1.5} />}
                  <text x={px} y={py + r + 12} fill="#e2e8f0" fontSize={9} textAnchor="middle" fontWeight={isSel ? 700 : 400}>
                    {z.name.length > 8 ? z.name.slice(0, 8) + '…' : z.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 오른쪽 패널 */}
        {selected
          ? editing
            ? <EditPanel zone={selected} onSave={handleSave} onCancel={() => setEditing(false)} />
            : <ReadPanel zone={selected} onEdit={() => setEditing(true)} />
          : (
            <div style={{
              background: '#0f172a', borderRadius: 16, border: '1px dashed #1e293b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 300, color: '#475569', fontSize: 13
            }}>
              노드를 클릭하면 상세 정보가 표시됩니다
            </div>
          )
        }
      </div>

      {/* 전략 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {strategy.map((col, idx) => {
          const isEditingThis = editingStratIdx === idx
          return (
            <div key={col.title} style={{
              background: '#0f172a', borderRadius: 14,
              border: isEditingThis ? `1px solid ${col.color}88` : '1px solid #1e293b',
              padding: 16, borderTop: `3px solid ${col.color}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ color: col.color, fontSize: 12, fontWeight: 700, margin: 0 }}>{col.title}</p>
                {isEditingThis ? null : (
                  <button onClick={() => setEditingStratIdx(idx)} style={{
                    background: 'none', border: 'none', color: '#475569',
                    fontSize: 11, cursor: 'pointer', padding: '2px 6px',
                    borderRadius: 4, lineHeight: 1,
                  }}>✏</button>
                )}
              </div>

              {isEditingThis ? (
                <StrategyEditInline
                  card={col}
                  onSave={updated => {
                    const next = strategy.map((c, i) => i === idx ? updated : c)
                    saveStrategy(next)
                  }}
                  onCancel={() => setEditingStratIdx(null)}
                />
              ) : (
                col.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: col.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>▸</span>
                    <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
