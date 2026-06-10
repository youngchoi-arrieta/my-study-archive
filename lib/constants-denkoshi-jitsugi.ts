// 第二種電気工事士 技能試験(실기) 트레이너 상수
// - 候補問題: 令和8年度(2026) 公表本. 시험 7/18·7/19, 작업시간 40분.
// - 欠陥の判断基準: 一般財団法人 電気技術者試験セン터 公式 분류 풀버전(12 카테고리).
//   채점은 기본 전부 "이상 없음", 발생한 결함만 체크 → 0개=합격 / 1개+=불합격.

export type Difficulty = 'easy' | 'mid' | 'hard'

export type KouhoMondai = {
  no: number
  feature: string
  featureJa: string
  tags: string[]
  difficulty: Difficulty
}

// ── 令和8年度(2026) 候補問題 No.1〜13 ──────────────────────────────
export const KOUHO_MONDAI: KouhoMondai[] = [
  { no: 1,  feature: '스위치 3개로 기구 3개 ON/OFF',        featureJa: '3個のスイッチで3個の器具をON/OFF', tags: ['단극SW×3', '연용취부틀'],            difficulty: 'easy' },
  { no: 2,  feature: '상시점등 확인표시등(파일럿램프)',       featureJa: '常時点灯の確認表示灯(PL)',          tags: ['PL 상시점등', '병렬결선'],            difficulty: 'mid'  },
  { no: 3,  feature: '타임스위치 + 접지극부 콘센트',         featureJa: 'タイムスイッチ・接地極付コンセント', tags: ['타임SW(단자대대용)', '접지극부콘센트'], difficulty: 'mid'  },
  { no: 4,  feature: '단상100V + 삼상200V 2회로',          featureJa: '単相100V回路と三相200V回路',      tags: ['삼상200V', '단자대', '색지정'],       difficulty: 'hard' },
  { no: 5,  feature: '100V + 200V 2회로',                featureJa: '100V回路と200V回路の2回路',       tags: ['200V', '단자대대용'],                difficulty: 'mid'  },
  { no: 6,  feature: '3로스위치 + 노출형 콘센트',           featureJa: '3路スイッチと露出形コンセント',     tags: ['3로SW', '노출콘센트', '輪づくり'],     difficulty: 'mid'  },
  { no: 7,  feature: '3로스위치 + 4로스위치',             featureJa: '3路スイッチと4路スイッチ',         tags: ['3로SW', '4로SW', '복선도주의'],       difficulty: 'hard' },
  { no: 8,  feature: '자동점멸기(광센서)',                featureJa: '自動点滅器',                     tags: ['자동점멸기', '단자대대용'],            difficulty: 'mid'  },
  { no: 9,  feature: '접지극부 접지단자부 콘센트(EET)',     featureJa: '接地極付接地端子付コンセント(EET)', tags: ['EET콘센트', '녹색접지선'],            difficulty: 'mid'  },
  { no: 10, feature: '배선용차단기 + 이시점멸 PL',         featureJa: '配線用遮断器と異時点滅PL',         tags: ['MCB(단자대대용)', '이시점멸'],         difficulty: 'mid'  },
  { no: 11, feature: '나사없는 전선관(E19) 금속관공사',     featureJa: 'ねじなし電線管(E19)',             tags: ['금속관E19', '止めねじ', '본드공사'],   difficulty: 'hard' },
  { no: 12, feature: '합성수지제 가요전선관(PF관)',         featureJa: '合成樹脂製可とう電線管(PF管)',     tags: ['PF관', '커넥터접속'],                difficulty: 'mid'  },
  { no: 13, feature: '단자대가 얽힌 회로',                featureJa: '端子台が絡む問題',                tags: ['단자대', '결선주의'],                difficulty: 'mid'  },
]

// ── 欠陥の判断基準 公式 12 카테고리 (풀버전) ─────────────────────
export type KekkanItem = { code: string; ja: string; ko: string }
export type KekkanCategory = {
  code: string
  ja: string
  ko: string
  color: string
  items: KekkanItem[]
}

export const KEKKAN_CATEGORIES: KekkanCategory[] = [
  {
    code: 'A', ja: '未完成のもの', ko: '미완성', color: '#be123c',
    items: [
      { code: 'A-1', ja: '作業が完了していない', ko: '작업 미완료' },
      { code: 'A-2', ja: '接続・結線すべき電線が未接続', ko: '접속해야 할 전선 미접속' },
      { code: 'A-3', ja: '取付枠が未設置/指定箇所違い', ko: '취부틀 미설치·지정위치 오류' },
    ],
  },
  {
    code: 'B', ja: '配置・寸法・接続方法等の相違', ko: '배치·치수·접속방법 상이', color: '#c2410c',
    items: [
      { code: 'B-1', ja: '配置が配線図と相違', ko: '배치가 배선도와 다름' },
      { code: 'B-2', ja: '寸法が施工寸法の50%以下', ko: '치수가 시공치수 50% 이하' },
      { code: 'B-3', ja: '電線の種類が配線図と相違', ko: '전선 종류 상이' },
      { code: 'B-4', ja: '接続方法が施工条件と相違', ko: '접속방법이 시공조건과 다름' },
    ],
  },
  {
    code: 'C', ja: '誤接続・誤結線', ko: '오접속·오결선', color: '#b45309',
    items: [
      { code: 'C-1', ja: 'スリーブ/コネクタで誤った電線を接続', ko: '슬리브·커넥터 오접속' },
      { code: 'C-2', ja: '器具・端子台への誤結線', ko: '기구·단자대 오결선' },
      { code: 'C-3', ja: '複線図ミスによる誤り', ko: '복선도 오작성 오류' },
    ],
  },
  {
    code: 'D', ja: '電線の色別・極性が施工条件に相違', ko: '전선 색별·극성 상이', color: '#a16207',
    items: [
      { code: 'D-1', ja: '接地側に白色以外', ko: '접지측에 백색 외' },
      { code: 'D-2', ja: '非接地側(点滅器/コンセント)に黒色以外', ko: '비접지측에 흑색 외' },
      { code: 'D-3', ja: 'レセプタクル受金ねじ部に白色以外', ko: '레셉터클 수금나사부 백색 외' },
      { code: 'D-4', ja: 'コンセント接地側極端子に白色以外', ko: '콘센트 접지측 단자 백색 외' },
      { code: 'D-5', ja: '引掛シーリング接地側極に白色以外', ko: '인입실링 접지측 백색 외' },
      { code: 'D-6', ja: '配線用遮断器N端子に白色以外', ko: '차단기 N단자 백색 외' },
      { code: 'D-7', ja: '接地線に緑色以外', ko: '접지선 녹색 외' },
      { code: 'D-8', ja: '三相200V回路の色が施工条件と相違', ko: '삼상200V 색지정 위반' },
    ],
  },
  {
    code: 'E', ja: '電線の損傷', ko: '전선 손상', color: '#65a30d',
    items: [
      { code: 'E-1', ja: '折曲げで絶縁被覆が露出', ko: '굽힘 시 절연피복 노출' },
      { code: 'E-2', ja: '外装の縦割れ20mm以上', ko: '외장 세로균열 20mm 이상' },
      { code: 'E-3', ja: '折曲げで心線が露出', ko: '굽힘 시 심선 노출' },
      { code: 'E-4', ja: '心線の傷/VVR介在物の抜け', ko: '심선 손상·VVR 개재물 탈락' },
    ],
  },
  {
    code: 'F', ja: 'リングスリーブ(E形)圧着部', ko: '링슬리브 압착부', color: '#16a34a',
    items: [
      { code: 'F-1', ja: 'スリーブ選択を誤った', ko: '슬리브 종류 선택 오류' },
      { code: 'F-2', ja: '圧着マークが不適正', ko: '압착마크 부적정' },
      { code: 'F-3', ja: '上端から心線5mm以上露出', ko: '상단 심선 5mm 이상 노출' },
      { code: 'F-4', ja: '下端から心線10mm以上露出', ko: '하단 심선 10mm 이상 노출' },
      { code: 'F-5', ja: '絶縁被覆の上から圧着', ko: '절연피복 위 압착' },
      { code: 'F-6', ja: '破損/二重圧着/2個使用/心線見えない 等', ko: '파손·이중압착·심선미시인 등' },
    ],
  },
  {
    code: 'G', ja: '差込形コネクタ接続部', ko: '꽂음형 커넥터부', color: '#0d9488',
    items: [
      { code: 'G-1', ja: '先端から心線が見えない(差込不足)', ko: '선단 심선 미시인(삽입부족)' },
      { code: 'G-2', ja: '下端から心線がはみ出し', ko: '하단 심선 노출' },
    ],
  },
  {
    code: 'H', ja: 'ねじ締め端子結線(レセプタクル/端子台/MCB/露出コンセント)', ko: '나사조임 단자 결선', color: '#0891b2',
    items: [
      { code: 'H-1', ja: '引っ張ると外れる/ねじ締め不足', ko: '당기면 빠짐·조임 부족' },
      { code: 'H-2', ja: '端から心線5mm以上露出', ko: '끝단 심선 5mm 이상 노출' },
      { code: 'H-3', ja: 'ねじで絶縁被覆を締付け', ko: '절연피복 나사조임' },
      { code: 'H-4', ja: '台座の上から結線/外装が台座内未挿入', ko: '대좌 위 결선·외장 미삽입' },
      { code: 'H-5', ja: '「の」の字が不適切', ko: '"の"자 부적절' },
      { code: 'H-6', ja: 'カバーが締まらない', ko: '커버 안 닫힘' },
    ],
  },
  {
    code: 'I', ja: 'ねじなし端子結線(SW/コンセント/PL/引掛シーリング)', ko: '나사없는 단자 결선', color: '#2563eb',
    items: [
      { code: 'I-1', ja: '引っ張ると外れる', ko: '당기면 빠짐' },
      { code: 'I-2', ja: 'SW/コンセント差込口から心線2mm以上露出', ko: 'SW·콘센트 심선 2mm 이상 노출' },
      { code: 'I-3', ja: '引掛シーリング差込口から心線1mm以上露出', ko: '인입실링 심선 1mm 이상 노출' },
      { code: 'I-4', ja: '引掛シーリング台座から絶縁被覆5mm以上露出', ko: '실링 대좌 피복 5mm 이상 노출' },
    ],
  },
  {
    code: 'J', ja: '金属管工事部分', ko: '금속관 공사', color: '#7c3aed',
    items: [
      { code: 'J-1', ja: '構成部品が正しい位置にない', ko: '구성부품 위치 오류' },
      { code: 'J-2', ja: 'ねじなしコネクタの止めねじを切っていない', ko: '止めねじ 미절단' },
      { code: 'J-3', ja: 'ボンド工事をしていない/不適切', ko: '본드공사 누락·부적절' },
      { code: 'J-4', ja: '管を引くと外れる/ブッシング外れ/隙間', ko: '관 빠짐·부싱 탈락·틈' },
    ],
  },
  {
    code: 'K', ja: '合成樹脂製可とう電線管(PF管)', ko: 'PF관 공사', color: '#9333ea',
    items: [
      { code: 'K-1', ja: '構成部品が正しい位置にない', ko: '구성부품 위치 오류' },
      { code: 'K-2', ja: '管とボックス接続が緩い/隙間', ko: '관·박스 접속 헐거움·틈' },
      { code: 'K-3', ja: '管を引くと外れる', ko: '관 빠짐' },
    ],
  },
  {
    code: 'L', ja: '取付枠・その他', ko: '취부틀·기타', color: '#db2777',
    items: [
      { code: 'L-1', ja: '取付枠を裏返し/指定外/中央位置誤り', ko: '취부틀 뒤집힘·위치 오류' },
      { code: 'L-2', ja: '配線器具が緩く外れる', ko: '배선기구 헐거움' },
      { code: 'L-3', ja: '支給品以外の材料/不要工事', ko: '비지급재·불필요공사' },
      { code: 'L-4', ja: 'ゴムブッシング不適切/未使用', ko: '고무부싱 부적절·미사용' },
      { code: 'L-5', ja: '器具を破損(台座の欠けは除く)', ko: '기구 파손(대좌 결손 제외)' },
    ],
  },
]

export const KEKKAN_ITEM_MAP = new Map<string, KekkanItem & { catCode: string; catColor: string }>(
  KEKKAN_CATEGORIES.flatMap(c => c.items.map(i => [i.code, { ...i, catCode: c.code, catColor: c.color }]))
)

export const DIFF_LABEL: Record<Difficulty, { ko: string; color: string }> = {
  easy: { ko: '쉬움', color: '#16a34a' },
  mid:  { ko: '보통', color: '#d97706' },
  hard: { ko: '어려움', color: '#dc2626' },
}

export const JITSUGI_EXAM = {
  year: 2026,
  label: '令和8年度 技能試験',
  dates: ['2026-07-18', '2026-07-19'],
  durationSec: 2400, // 40분
}

// ── 타입 (Supabase) ──────────────────────────────────────────────
export type JitsugiProblem = {
  no: number
  q_drive_url: string | null
  a_drive_url: string | null
  updated_at?: string | null
}

export type JitsugiAttempt = {
  id: string
  problem_no: number
  duration_sec: number | null
  completed: boolean
  passed_self: boolean
  defect_codes: string[]
  notes: string | null
  created_at: string
}

// ── 헬퍼 ─────────────────────────────────────────────────────────
export function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^/]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

export const fmtDur = (sec: number | null | undefined): string => {
  if (sec == null) return '–'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
