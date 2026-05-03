'use client'
import { useState } from 'react'

type JobZone = {
  id: string
  name: string
  nameEn: string
  x: number  // 진입난이도 1-10
  y: number  // 나와의 적합도 1-10
  growth: number  // 1-5
  salaryRange: string
  entryReq: string[]
  fitReason: string[]
  antiReason: string[]
  practitionerQuote: string
  practitionerYears: string
  nextStep: string
  tag: 'kr_field' | 'kr_technical' | 'kr_specialist' | 'abroad' | 'current'
  status?: 'active' | 'watching' | 'pursuing'
}

const ZONES: JobZone[] = [
  {
    id: 'field',
    name: '현장 전기공사',
    nameEn: 'Field Electrical Construction',
    x: 2.5, y: 2.0,
    growth: 2,
    salaryRange: '3,000 – 4,500만',
    entryReq: ['전기기능사 or 기사', '체력 및 현장 적응'],
    fitReason: ['자격증 이미 보유', '빠른 진입 가능'],
    antiReason: ['현장 문화 맞지 않음', '가족 분리 상황 악화', '지적 자극 적음'],
    practitionerQuote: '40대 초반 입문해서 20년. 직접 부딪혀서 경험하라.',
    practitionerYears: '20년차 (전기기사)',
    nextStep: '진입 불필요 – 명백한 비적합',
    tag: 'kr_field',
    status: 'watching',
  },
  {
    id: 'facility',
    name: '시설관리',
    nameEn: 'Building Facility Management',
    x: 2.0, y: 2.5,
    growth: 2,
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
    id: 'solar',
    name: '태양광 / 신재생',
    nameEn: 'Solar & Renewable Energy',
    x: 3.5, y: 4.0,
    growth: 3,
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
    id: 'construction_mgmt',
    name: '공무 / 시공관리',
    nameEn: 'Construction Management',
    x: 4.5, y: 5.5,
    growth: 3,
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
    id: 'substation',
    name: '변전설비 유지보수',
    nameEn: 'Substation Maintenance',
    x: 6.0, y: 7.5,
    growth: 4,
    salaryRange: '4,500 – 7,500만',
    entryReq: ['전기기사', '도면해석 + 계전 세팅 경험', '한전 협력사 or 변전 전문업체'],
    fitReason: ['수리 감각 + 기사 수준 이해도 이미 보유', '보호계전 진입 전 최적 브릿지', 'Δ-Y 차동보호 재구성 경험'],
    antiReason: ['초기 경력 증명 필요', '야간 점검 포함 가능'],
    practitionerQuote: '수리 감각과 기사 수준 이해도가 이미 있기 때문에 현장 단순 업무로 시작하기엔 아깝습니다.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '→ 보호계전 전문업체로 이동하는 흐름이 가장 좋습니다',
    tag: 'kr_technical',
    status: 'watching',
  },
  {
    id: 'relay',
    name: '보호계전 엔지니어링',
    nameEn: 'Protection Relay Engineering',
    x: 8.0, y: 9.5,
    growth: 5,
    salaryRange: '5,500 – 1억+',
    entryReq: ['변전 실무 경력 2년+', '계전 세팅 실전 경험', '릴레이 도면 해석', '전기기사 필수'],
    fitReason: ['물리학 배경 → 1원론적 계산 강점', 'Δ-Y 차동보호 CT 결선 독립 재구성', '수리 감각과 기사급 이해도 확인', 'Blackburn & Domin 참고 수준'],
    antiReason: ['진입 장벽 높음 – 경력 필수', '국내 전문업체 소수', '한국 진입 루트 좁음'],
    practitionerQuote: '계전 전문 업체나 발전사 협력사로 이동하는 흐름이 가장 좋습니다.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '← 변전설비 유지보수 경력 2년 후 타겟',
    tag: 'kr_specialist',
    status: 'watching',
  },
  {
    id: 'foreign_dc',
    name: '외국계 FM / 데이터센터',
    nameEn: 'Foreign FM / Data Center',
    x: 7.0, y: 8.5,
    growth: 5,
    salaryRange: '5,500 – 1억+',
    entryReq: ['전기기사 + 실무 경력', '영어 실무 가능 (TOEFL 109 ✓)', '외국계 채용: CBRE / JLL / Equinix / NTT'],
    fitReason: ['TOEFL 109 – 영어 차별화 확실', '외국계 문화 적응력 (콜롬비아 1.5년)', '배우자 Lucy와 장기 합류 가능성'],
    antiReason: ['국내 전기 실무 경력 아직 없음', '초기 진입은 경력직 우선'],
    practitionerQuote: '영어 강점도 있기 때문에 외국계 설비사나 장비사까지 확장 가능성이 있습니다.',
    practitionerYears: '5년차 (전기·전자엔지니어)',
    nextStep: '변전/계전 경력 1-2년 후 LinkedIn cold outreach 타겟',
    tag: 'kr_specialist',
    status: 'watching',
  },
  {
    id: 'japan',
    name: '일본 전기직 (특정기능→기인국)',
    nameEn: 'Japan: 特定技能 → 技人国',
    x: 6.5, y: 8.0,
    growth: 5,
    salaryRange: '¥350 – 600만/년',
    entryReq: ['전기공사사 2종 (5/28 시험)', 'JLPT N4 (특정기능 최소)', 'JLPT N2 → 高度専門職 80점 목표', '건設분야 특정기능 평가시험'],
    fitReason: ['KAIST → 法務省 지정대학 +10점', 'Nano Letters → 研究実績 +20점', 'JLPT N2 취득 시 +10점 = 高度専門職 80점', '電験3種 → 技人国 기술 직무 피벗'],
    antiReason: ['특정기능1호: 가족 동반 불가 (5년)', '기인국: 회사 스폰서 필요', 'Lucy와 재결합 최소 5년+'],
    practitionerQuote: '方向さえ正せば遅くない出発です。（방향만 잡으면 늦지 않은 출발）',
    practitionerYears: '5년차 조언 + 直接 비자 리서치',
    nextStep: '5/28 電気工事士2種 → JLPT N4(7월) → 특정기능 → 電験3種 병행',
    tag: 'abroad',
    status: 'pursuing',
  },
  {
    id: 'canada',
    name: '캐나다 워홀',
    nameEn: 'Canada Working Holiday',
    x: 4.0, y: 6.5,
    growth: 4,
    salaryRange: 'CAD 50,000 – 75,000',
    entryReq: ['IEC 초청장 수령 완료', 'IMM 5707 완료', '바이오메트릭스 등록 완료 (4/17)'],
    fitReason: ['TOEFL 109 영어 즉시 활용', '전기 실무 600+시간 경력 명시', 'Lucy와 함께 이주 가능성'],
    antiReason: ['전기 면허 현지 인증 필요 (IBEW 등)', '초기 단순 직무 가능성', '한국 계전 경력 단절'],
    practitionerQuote: '영어 강점과 기술직 자격증의 조합 – 늦지 않은 출발.',
    practitionerYears: '자체 분석',
    nextStep: '비자 발급 대기 중 – 일본 트랙과 병행 검토',
    tag: 'abroad',
    status: 'pursuing',
  },
  {
    id: 'kepco',
    name: '한전 / 공기업 공채',
    nameEn: 'KEPCO & Public Corp',
    x: 9.0, y: 2.5,
    growth: 2,
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
  kr_field: '#64748b',
  kr_technical: '#2563eb',
  kr_specialist: '#7c3aed',
  abroad: '#059669',
  current: '#d97706',
}

const TAG_LABELS: Record<string, string> = {
  kr_field: '국내 현장직',
  kr_technical: '국내 기술직',
  kr_specialist: '국내 전문직',
  abroad: '해외',
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pursuing: { label: '추진 중', color: '#16a34a' },
  watching: { label: '검토 중', color: '#2563eb' },
}

function GrowthDots({ n }: { n: number }) {
  return (
    <div className="flex gap-1">
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

export default function ElecMapView() {
  const [selected, setSelected] = useState<JobZone | null>(ZONES.find(z => z.id === 'relay') || null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string | null>(null)

  const filtered = filterTag ? ZONES.filter(z => z.tag === filterTag) : ZONES

  // Map dimensions
  const W = 700, H = 420
  const PAD = { l: 64, r: 24, t: 24, b: 56 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  function toSVG(z: JobZone) {
    const px = PAD.l + ((z.x - 1) / 9) * plotW
    const py = PAD.t + ((10 - z.y) / 9) * plotH
    return { px, py }
  }

  const xLabels = ['낮음', '', '보통', '', '높음', '', '매우 높음', '', '극한']
  const yLabels = ['낮음', '', '보통', '', '높음', '', '매우 높음', '', '최적']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* 범례 + 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>필터:</span>
        <button
          onClick={() => setFilterTag(null)}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: filterTag === null ? '#3b82f6' : '#1f2937',
            color: filterTag === null ? '#fff' : '#9ca3af',
            border: '1px solid ' + (filterTag === null ? '#3b82f6' : '#374151'),
          }}
        >전체</button>
        {Object.entries(TAG_LABELS).map(([k, v]) => (
          <button key={k}
            onClick={() => setFilterTag(filterTag === k ? null : k)}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              background: filterTag === k ? TAG_COLORS[k] : '#1f2937',
              color: filterTag === k ? '#fff' : '#9ca3af',
              border: '1px solid ' + (filterTag === k ? TAG_COLORS[k] : '#374151'),
            }}
          >
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: TAG_COLORS[k], marginRight: 6 }} />
            {v}
          </button>
        ))}
      </div>

      {/* 2열 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* SVG 지도 */}
        <div style={{ background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
            {/* 배경 그리드 */}
            {[...Array(9)].map((_, i) => {
              const x = PAD.l + (i / 8) * plotW
              const y = PAD.t + (i / 8) * plotH
              return (
                <g key={i}>
                  <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + plotH} stroke="#1e293b" strokeWidth={1} />
                  <line x1={PAD.l} y1={y} x2={PAD.l + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                </g>
              )
            })}

            {/* 사분면 배경 힌트 */}
            <rect x={PAD.l} y={PAD.t} width={plotW/2} height={plotH/2} fill="#dc26261a" />
            <rect x={PAD.l + plotW/2} y={PAD.t + plotH/2} width={plotW/2} height={plotH/2} fill="#16a34a14" />
            <text x={PAD.l + 10} y={PAD.t + 20} fill="#ef4444" fontSize={10} opacity={0.6}>진입 어렵고 적합도 낮음</text>
            <text x={PAD.l + plotW/2 + 10} y={PAD.t + plotH - 10} fill="#22c55e" fontSize={10} opacity={0.6}>진입 쉽고 적합도 높음</text>

            {/* 축 레이블 */}
            {xLabels.map((label, i) => (
              <text key={i} x={PAD.l + (i / 8) * plotW} y={H - 16}
                fill="#475569" fontSize={9} textAnchor="middle">{label}</text>
            ))}
            {yLabels.map((label, i) => (
              <text key={i} x={PAD.l - 8} y={PAD.t + ((8 - i) / 8) * plotH + 4}
                fill="#475569" fontSize={9} textAnchor="end">{label}</text>
            ))}

            {/* 축 제목 */}
            <text x={PAD.l + plotW / 2} y={H - 2} fill="#64748b" fontSize={10} textAnchor="middle">
              진입 난이도 →
            </text>
            <text x={12} y={PAD.t + plotH / 2} fill="#64748b" fontSize={10} textAnchor="middle"
              transform={`rotate(-90, 12, ${PAD.t + plotH / 2})`}>
              나와의 적합도 →
            </text>

            {/* 연결선 (추천 경로) */}
            {[
              ['substation', 'relay'],
              ['construction_mgmt', 'substation'],
              ['substation', 'foreign_dc'],
            ].map(([a, b]) => {
              const za = ZONES.find(z => z.id === a)!
              const zb = ZONES.find(z => z.id === b)!
              const pa = toSVG(za), pb = toSVG(zb)
              return (
                <line key={a+b}
                  x1={pa.px} y1={pa.py} x2={pb.px} y2={pb.py}
                  stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3" opacity={0.35}
                />
              )
            })}

            {/* 노드 */}
            {ZONES.map(z => {
              const { px, py } = toSVG(z)
              const r = 10 + z.growth * 2.5
              const isSelected = selected?.id === z.id
              const isHovered = hovered === z.id
              const dimmed = filterTag && z.tag !== filterTag
              const color = TAG_COLORS[z.tag]

              return (
                <g key={z.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(z)}
                  onMouseEnter={() => setHovered(z.id)}
                  onMouseLeave={() => setHovered(null)}
                  opacity={dimmed ? 0.2 : 1}
                >
                  {/* 선택 링 */}
                  {isSelected && (
                    <circle cx={px} cy={py} r={r + 5} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                  )}
                  {/* 글로우 */}
                  {(isSelected || isHovered) && (
                    <circle cx={px} cy={py} r={r + 3} fill={color} opacity={0.15} />
                  )}
                  {/* 메인 원 */}
                  <circle cx={px} cy={py} r={r}
                    fill={color} opacity={isSelected || isHovered ? 1 : 0.75}
                    stroke={isSelected ? '#fff' : 'transparent'} strokeWidth={1.5}
                  />
                  {/* 상태 뱃지 */}
                  {z.status && (
                    <circle cx={px + r * 0.7} cy={py - r * 0.7} r={4}
                      fill={STATUS_BADGE[z.status].color} stroke="#0f172a" strokeWidth={1.5} />
                  )}
                  {/* 텍스트 */}
                  <text x={px} y={py + r + 12} fill="#e2e8f0"
                    fontSize={9} textAnchor="middle" fontWeight={isSelected ? 700 : 400}>
                    {z.name.length > 8 ? z.name.substring(0, 8) + '…' : z.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 상세 패널 */}
        {selected ? (
          <div style={{
            background: '#0f172a', borderRadius: 16, border: '1px solid #1e293b',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: 16
          }}>
            {/* 헤더 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: TAG_COLORS[selected.tag], display: 'inline-block', flexShrink: 0
                }} />
                <span style={{ color: '#64748b', fontSize: 11 }}>{TAG_LABELS[selected.tag]}</span>
                {selected.status && (
                  <span style={{
                    padding: '1px 8px', borderRadius: 20, fontSize: 10,
                    background: STATUS_BADGE[selected.status].color + '22',
                    color: STATUS_BADGE[selected.status].color,
                    border: '1px solid ' + STATUS_BADGE[selected.status].color + '44',
                  }}>{STATUS_BADGE[selected.status].label}</span>
                )}
              </div>
              <h2 style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.name}</h2>
              <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>{selected.nameEn}</p>
            </div>

            {/* 지표 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 4px' }}>진입 난이도</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: '#0f172a', borderRadius: 2 }}>
                    <div style={{ width: `${selected.x * 10}%`, height: '100%', background: '#f87171', borderRadius: 2 }} />
                  </div>
                  <span style={{ color: '#f87171', fontSize: 12, fontWeight: 700 }}>{selected.x}/10</span>
                </div>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 4px' }}>나와의 적합도</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: '#0f172a', borderRadius: 2 }}>
                    <div style={{ width: `${selected.y * 10}%`, height: '100%', background: '#34d399', borderRadius: 2 }} />
                  </div>
                  <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>{selected.y}/10</span>
                </div>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 6px' }}>성장가능성</p>
                <GrowthDots n={selected.growth} />
              </div>
              <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ color: '#64748b', fontSize: 10, margin: '0 0 4px' }}>급여 범위</p>
                <p style={{ color: '#f1f5f9', fontSize: 12, fontWeight: 600, margin: 0 }}>{selected.salaryRange}</p>
              </div>
            </div>

            {/* 진입 요건 */}
            <div>
              <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 6px', fontWeight: 600 }}>진입 요건</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selected.entryReq.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: '#3b82f6', fontSize: 10, marginTop: 2 }}>▸</span>
                    <span style={{ color: '#cbd5e1', fontSize: 12 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* fit / anti */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <p style={{ color: '#34d399', fontSize: 11, margin: '0 0 5px', fontWeight: 600 }}>✓ 나와 맞는 점</p>
                {selected.fitReason.map((r, i) => (
                  <p key={i} style={{ color: '#6ee7b7', fontSize: 11, margin: '0 0 3px' }}>· {r}</p>
                ))}
              </div>
              <div>
                <p style={{ color: '#f87171', fontSize: 11, margin: '0 0 5px', fontWeight: 600 }}>✗ 걸리는 점</p>
                {selected.antiReason.map((r, i) => (
                  <p key={i} style={{ color: '#fca5a5', fontSize: 11, margin: '0 0 3px' }}>· {r}</p>
                ))}
              </div>
            </div>

            {/* 현직자 조언 */}
            <div style={{
              background: '#1e293b', borderRadius: 10, padding: '12px 14px',
              borderLeft: '3px solid #3b82f6'
            }}>
              <p style={{ color: '#94a3b8', fontSize: 10, margin: '0 0 6px' }}>현직자 조언 — {selected.practitionerYears}</p>
              <p style={{ color: '#e2e8f0', fontSize: 12, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                "{selected.practitionerQuote}"
              </p>
            </div>

            {/* 다음 단계 */}
            <div style={{
              background: '#172554', borderRadius: 10, padding: '10px 14px',
              border: '1px solid #1e40af'
            }}>
              <p style={{ color: '#93c5fd', fontSize: 10, margin: '0 0 4px', fontWeight: 600 }}>다음 단계</p>
              <p style={{ color: '#dbeafe', fontSize: 12, margin: 0 }}>{selected.nextStep}</p>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#0f172a', borderRadius: 16, border: '1px dashed #1e293b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 300, color: '#475569', fontSize: 13
          }}>
            노드를 클릭하면 상세 정보가 표시됩니다
          </div>
        )}
      </div>

      {/* 하단: 전략 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          {
            title: '즉시 액션 가능',
            color: '#16a34a',
            items: [
              '5/28 電気工事士2種 CBT (후쿠오카)',
              '전기기사 실기 결과 6/12 확인',
              '다산에듀 결과 대기',
            ]
          },
          {
            title: '6개월 내 타겟',
            color: '#2563eb',
            items: [
              '변전설비 유지보수 업체 지원 (서류 준비)',
              'JLPT N4 (7월 시험)',
              'LinkedIn 외국계 FM 한국 직원 cold outreach',
            ]
          },
          {
            title: '2년 후 목표',
            color: '#7c3aed',
            items: [
              '보호계전 전문업체 경력직 이동',
              '電験3種 취득 (일본 기인국 피벗)',
              'CBRE/Equinix 전기 엔지니어 지원',
            ]
          }
        ].map(col => (
          <div key={col.title} style={{
            background: '#0f172a', borderRadius: 14,
            border: '1px solid #1e293b', padding: '16px',
            borderTop: `3px solid ${col.color}`
          }}>
            <p style={{ color: col.color, fontSize: 12, fontWeight: 700, margin: '0 0 10px' }}>{col.title}</p>
            {col.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <span style={{ color: col.color, fontSize: 10, marginTop: 2, flexShrink: 0 }}>▸</span>
                <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
