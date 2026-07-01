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
  { no: 1,  feature: 'イ·ロ·ハ 3부하 + 레셉터클 + 인입실링',  featureJa: '3個の点滅器・ランプレセプタクル・引掛シーリング', tags: ['레셉터클R', '引掛실링', 'EM-EEF2.0'],   difficulty: 'mid'  },
  { no: 2,  feature: '확인표시등 상시점등(파일럿램프)',        featureJa: '確認表示灯=常時点灯',              tags: ['PL 상시점등', '레셉터클R×2'],          difficulty: 'mid'  },
  { no: 3,  feature: '타임스위치(TS) + 레셉터클',           featureJa: 'タイムスイッチ(TS)',              tags: ['TS(단자대대용)', '施工省略'],          difficulty: 'mid'  },
  { no: 4,  feature: '단상100V + 삼상200V 전동기(M)',       featureJa: '単相100V + 三相200V電動機',       tags: ['3φ3W 200V', '전원표시등ED', '단자대'], difficulty: 'hard' },
  { no: 5,  feature: '100V + 200V 2회로',                featureJa: '100V回路と200V回路',             tags: ['200V', 'ED', 'VVF2.0-3C'],          difficulty: 'mid'  },
  { no: 6,  feature: '3로스위치 + 노출형 콘센트',           featureJa: '3路スイッチ + 露出形コンセント',   tags: ['3로SW', '노출콘센트', '輪づくり'],     difficulty: 'mid'  },
  { no: 7,  feature: '3로스위치 (단독)',                  featureJa: '3路スイッチ',                    tags: ['3로SW', '施工省略'],                difficulty: 'mid'  },
  { no: 8,  feature: '3로 + 4로 스위치',                 featureJa: '3路 + 4路スイッチ',              tags: ['3로SW', '4로SW', '복선도주의'],       difficulty: 'hard' },
  { no: 9,  feature: '접지극부 접지단자부 콘센트(EET)',     featureJa: '接地極付接地端子付コンセント(EET)', tags: ['EET콘센트', '녹색접지선E1.6'],        difficulty: 'mid'  },
  { no: 10, feature: '확인표시등 동시점멸',               featureJa: '確認表示灯=同時点滅',              tags: ['PL 동시점멸', '레셉터클R'],            difficulty: 'mid'  },
  { no: 11, feature: '금속관공사 IV1.6(E19)',           featureJa: '金属管工事 IV1.6(E19)',          tags: ['금속관E19', '止めねじ', '본드공사'],   difficulty: 'hard' },
  { no: 12, feature: 'PF관공사 IV1.6(PF16)',           featureJa: '合成樹脂製可とう電線管 IV1.6(PF16)', tags: ['PF관', '커넥터접속'],               difficulty: 'mid'  },
  { no: 13, feature: '배선용차단기 A(3A) + VVR',          featureJa: '配線用遮断器 A(3A) + VVR',        tags: ['차단기A', 'VVR1.6-2C', '施工省略'],   difficulty: 'mid'  },
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
    code: '1', ja: '未完成のもの', ko: '미완성', color: '#be123c',
    items: [
      { code: '1', ja: '未完成のもの', ko: '작품 미완성(작업 미완료)' },
    ],
  },
  {
    code: '2', ja: '配置・寸法・接続方法等の相違', ko: '배치·치수·접속방법 상이', color: '#c2410c',
    items: [
      { code: '2-1', ja: '配線・器具の配置が配線図と相違', ko: '배치가 배선도와 다름' },
      { code: '2-2', ja: '寸法が配線図の50%以下', ko: '치수가 시공치수 50% 이하' },
      { code: '2-3', ja: '電線の種類が配線図と相違', ko: '전선 종류 상이' },
      { code: '2-4', ja: '接続方法が施工条件と相違', ko: '접속방법이 시공조건과 다름' },
    ],
  },
  {
    code: '3', ja: '誤接続・誤結線のもの', ko: '오접속·오결선', color: '#b45309',
    items: [
      { code: '3', ja: '誤接続・誤結線', ko: '오접속·오결선' },
    ],
  },
  {
    code: '4', ja: '電線の色別・極性が施工条件に相違', ko: '전선 색별·극성 상이', color: '#a16207',
    items: [
      { code: '4', ja: '電線の色別・配線器具の極性が施工条件に相違', ko: '색별·극성이 시공조건과 다름' },
    ],
  },
  {
    code: '5', ja: '電線の損傷', ko: '전선 손상', color: '#65a30d',
    items: [
      { code: '5-1イ', ja: '折曲げで絶縁被覆が露出', ko: '굽힘 시 절연피복 노출' },
      { code: '5-1ロ', ja: '外装縦割れ20mm以上', ko: '외장 세로균열 20mm 이상' },
      { code: '5-1ハ', ja: 'VVR・CVVの介在物が抜けた', ko: 'VVR·CVV 개재물 탈락' },
      { code: '5-2', ja: '折曲げで心線が露出', ko: '굽힘 시 심선 노출' },
      { code: '5-3', ja: '折曲げで折れる程度の心線の傷', ko: '심선이 꺾일 정도의 손상' },
      { code: '5-4', ja: 'より線を減線したもの', ko: '연선 소선 감선' },
    ],
  },
  {
    code: '6', ja: 'リングスリーブ(E形)圧着接続', ko: '링슬리브 압착', color: '#16a34a',
    items: [
      { code: '6-1イ', ja: 'スリーブの選択を誤った', ko: '슬리브 종류 선택 오류' },
      { code: '6-1ロ', ja: '圧着マークが不適正', ko: '압착마크 부적정' },
      { code: '6-1ハ', ja: 'スリーブを破損した', ko: '슬리브 파손' },
      { code: '6-1ニ', ja: '圧着マークの一部が欠けた', ko: '압착마크 일부 결손' },
      { code: '6-1ホ', ja: '1スリーブに2つ以上の圧着マーク', ko: '1슬리브 압착 2회 이상' },
      { code: '6-1ヘ', ja: '1箇所に2個以上のスリーブ使用', ko: '1개소 슬리브 2개 이상' },
      { code: '6-2イ', ja: '心線の先端が1本でも見えない', ko: '심선 선단 미시인(1본이라도)' },
      { code: '6-2ロ', ja: '上端から心線5mm以上露出', ko: '상단 심선 5mm 이상 노출' },
      { code: '6-2ハ', ja: '下端から心線10mm以上露出', ko: '하단 심선 10mm 이상 노출' },
      { code: '6-2ニ', ja: 'はぎ取り不足で絶縁被覆20mm以下', ko: '피복 박리부족(20mm 이하)' },
      { code: '6-2ホ', ja: '絶縁被覆の上から圧着', ko: '절연피복 위 압착' },
      { code: '6-2ヘ', ja: 'より線素線の一部が未挿入', ko: '연선 소선 일부 미삽입' },
    ],
  },
  {
    code: '7', ja: '差込形コネクタによる差込接続', ko: '꽂음형 커넥터 접속', color: '#0d9488',
    items: [
      { code: '7-1', ja: '先端から心線が見えない(差込不足)', ko: '선단 심선 미시인(삽입부족)' },
      { code: '7-2', ja: '下端から心線が見える(はみ出し)', ko: '하단 심선 노출(과삽입)' },
    ],
  },
  {
    code: '8', ja: '器具への結線部分', ko: '기구 결선부', color: '#0891b2',
    items: [
      { code: '8-1', ja: '心線をねじで締め付けていない/引張で外れる', ko: '나사조임 부족·당기면 빠짐' },
      { code: '8-2', ja: 'より線素線の一部が端子に未挿入', ko: '연선 소선 일부 단자 미삽입' },
      { code: '8-3', ja: '被覆むき過ぎ(端から心線5mm以上等)', ko: '피복 과박리(끝단 5mm 이상 등)' },
      { code: '8-4', ja: '絶縁被覆を締め付けた', ko: '절연피복 나사조임' },
      { code: '8-5', ja: 'レセプタクル等で引込口を通さず結線', ko: '레셉터클 引込口 미통과 결선' },
      { code: '8-6', ja: 'ケーブル外装が台座内に入っていない', ko: '외장이 대좌 내 미삽입' },
      { code: '8-7イ', ja: '巻き付け不足(3/4周以下)・重ね巻き', ko: '"の"자 권부족·중복권' },
      { code: '8-7ロ', ja: '心線を左巻きにした', ko: '"の"자 좌권' },
      { code: '8-7ハ', ja: 'ねじ端から心線5mm以上はみ出し', ko: '나사끝 심선 5mm 이상 돌출' },
      { code: '8-7ニ', ja: 'カバーが締まらない', ko: '커버 안 닫힘' },
      { code: '8-8', ja: 'ねじなし端子: 電線を引張ると外れる', ko: '나사없는단자 당기면 빠짐' },
      { code: '8-9', ja: '差込口から心線2mm以上露出(引掛は1mm)', ko: '꽂음구 심선 2mm 이상(실링 1mm)' },
      { code: '8-10', ja: '引掛シーリング台座から被覆5mm以上露出', ko: '실링 대좌 피복 5mm 이상 노출' },
    ],
  },
  {
    code: '9', ja: '金属管工事部分', ko: '금속관 공사', color: '#7c3aed',
    items: [
      { code: '9-1', ja: '構成部品が正しい位置にない', ko: '구성부품 위치 오류' },
      { code: '9-2', ja: '構成部品間の接続が不適切(管外れ/隙間等)', ko: '부품간 접속 불량(관빠짐·틈)' },
      { code: '9-3', ja: '止めねじをねじ切っていない', ko: '止めねじ 미절단' },
      { code: '9-4', ja: 'ボンド工事未施工/誤った電線で結線', ko: '본드공사 누락·오결선' },
      { code: '9-5', ja: 'ボンド線のボックス取付が不適切', ko: '본드선 박스 취부 불량' },
      { code: '9-6', ja: 'ボンド線のコネクタ接地端子取付が不適切', ko: '본드선 커넥터 접지단자 취부 불량' },
    ],
  },
  {
    code: '10', ja: '合成樹脂製可とう電線管工事部分', ko: 'PF관 공사', color: '#9333ea',
    items: [
      { code: '10-1', ja: '構成部品が正しい位置にない', ko: '구성부품 위치 오류' },
      { code: '10-2', ja: '構成部品間の接続が不適切(管外れ/隙間)', ko: '부품간 접속 불량(관빠짐·틈)' },
    ],
  },
  {
    code: '11', ja: '取付枠部分', ko: '취부틀', color: '#db2777',
    items: [
      { code: '11-1', ja: '取付枠を指定箇所以外で使用', ko: '취부틀 지정외 사용' },
      { code: '11-2', ja: '取付枠を裏返しにして取付け', ko: '취부틀 뒤집어 취부' },
      { code: '11-3', ja: '取付けがゆるく引張ると外れる', ko: '취부 헐거움·당기면 빠짐' },
      { code: '11-4', ja: '配線器具の位置を誤って取付け', ko: '기구 위치 오류(중앙 등)' },
    ],
  },
  {
    code: '12', ja: 'その他', ko: '기타', color: '#e11d48',
    items: [
      { code: '12-1', ja: '支給品以外の材料を使用', ko: '비지급재 사용' },
      { code: '12-2', ja: '不要・余分・用途外の工事', ko: '불필요·용도외 공사' },
      { code: '12-3', ja: '支給品の既設配線を変更/取り除いた', ko: '지급품 기설배선 변경·제거' },
      { code: '12-4', ja: 'ゴムブッシングの使用が不適切/未使用', ko: '고무부싱 부적절·미사용' },
      { code: '12-5', ja: '器具を破損(台座の欠けは除く)', ko: '기구 파손(대좌 결손 제외)' },
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
  result_images?: string[] | null
  reference_images?: string[] | null
  felt_difficulty?: Difficulty | null   // 연습하며 느낀 체감 난이도(내가 태깅). KOUHO_MONDAI.difficulty(기준값)와 별개.
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

// 시공 리스크 항목(Risk item) — 치수 · 시공 유의사항 · 해당 候補問題 태깅
export type JitsugiRisk = {
  id: string
  item: string            // Risk item (예: '引掛シーリング 각형')
  dimension: string       // 치수 (피복/심선 길이 등)
  caution: string         // 시공상 유의사항 및 주의할 결함
  problem_nos: number[]   // 해당 候補問題 (1~13)
  sort_order: number
  created_at?: string
  updated_at?: string | null
}

// 전선 종류별 소요량 매트릭스 — 행=전선 종류, 열=候補問題(1~13), 셀=소요량
export type JitsugiWire = {
  id: string
  wire_type: string                // 전선 종류 (행 라벨, 예: 'VVF 1.6mm 2심')
  amounts: Record<string, string>  // { [問題no]: 소요량 }  예: { '1': '2', '4': '1' }
  sort_order: number
  created_at?: string
  updated_at?: string | null
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
