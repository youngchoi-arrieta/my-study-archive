// 第二種電気工事士 技能試験 — HOZAN「単位作業」 노트
// 단위 메타데이터는 정적(여기 보관). 슬라이드(이미지+캡션)만 Supabase denkoshi_unit_slides 에 저장.
// 제목은 HOZAN 영상 제목과 1:1로 맞춤 (혼동 방지).
// 출처: https://www.hozan.co.jp/corp/denko2/pg/1unit/

export type UnitCategory = 'beginner' | 'strip' | 'kigu' | 'setsuzoku'

export const UNIT_CATEGORIES: { key: UnitCategory; ja: string; ko: string; color: string }[] = [
  { key: 'beginner',  ja: '初心者向け',       ko: '초심자용',     color: '#34d399' },
  { key: 'strip',     ja: '電線のストリップ', ko: '전선 스트립',  color: '#60a5fa' },
  { key: 'kigu',      ja: '器具の結線',       ko: '기구 결선',    color: '#f59e0b' },
  { key: 'setsuzoku', ja: '電線の接続',       ko: '전선 접속',    color: '#a78bfa' },
]

export type DenkoshiUnit = {
  slug: string
  category: UnitCategory
  titleJa: string      // HOZAN 영상 제목 그대로
  titleKo: string      // 동일 제목의 한국어 번역
  youtubeUrl: string
}

export const DENKOSHI_UNITS: DenkoshiUnit[] = [
  // ── 初心者向け ───────────────────────────────────────────
  { slug: 'p958-practice',   category: 'beginner',  titleJa: '作業時間短縮!! P-958の練習方法',          titleKo: '작업시간 단축!! P-958 연습 방법',          youtubeUrl: 'https://youtu.be/1luOtsci7lo' },
  { slug: 'first-challenge', category: 'beginner',  titleJa: '初心者が候補問題に初めて挑戦!',            titleKo: '초보자가 후보문제에 처음 도전!',            youtubeUrl: 'https://youtu.be/8XOx6bIqhoE' },
  { slug: 're-challenge',    category: 'beginner',  titleJa: '初心者が候補問題に再挑戦!',                titleKo: '초보자가 후보문제에 재도전!',               youtubeUrl: 'https://youtu.be/87hf5aQW83M' },
  { slug: 'mistake-fix',     category: 'beginner',  titleJa: 'ミスした時の修正方法',                    titleKo: '실수했을 때 수정 방법',                     youtubeUrl: 'https://youtu.be/9QJ9zYdjN_Y' },
  { slug: 'exam-day',        category: 'beginner',  titleJa: '技能試験当日の流れ',                      titleKo: '기능시험 당일의 흐름',                       youtubeUrl: 'https://youtu.be/l439KH4ZF5A' },

  // ── 電線のストリップ ─────────────────────────────────────
  { slug: 'vvf-strip',       category: 'strip',     titleJa: 'P-958の使い方とVVFケーブルのストリップ',  titleKo: 'P-958 사용법과 VVF 케이블 스트립',          youtubeUrl: 'https://youtu.be/X4iP_5Nfrpw' },
  { slug: 'vvr-strip',       category: 'strip',     titleJa: 'VVRケーブルのストリップ',                titleKo: 'VVR 케이블 스트립',                         youtubeUrl: 'https://youtu.be/2m0G8aTUy0M' },

  // ── 器具の結線 ───────────────────────────────────────────
  { slug: 'ramp-receptacle', category: 'kigu',      titleJa: 'ランプレセプタクルの結線',                titleKo: '램프 레셉터클 결선',                         youtubeUrl: 'https://youtu.be/LsXpO5thANM' },
  { slug: 'exposed-outlet',  category: 'kigu',      titleJa: '露出形コンセントの結線',                  titleKo: '노출형 콘센트 결선',                         youtubeUrl: 'https://youtu.be/n4YEp53oyPQ' },
  { slug: 'ceiling-rose',    category: 'kigu',      titleJa: '引掛シーリングの結線',                    titleKo: '인입 실링(引掛シーリング) 결선',             youtubeUrl: 'https://youtu.be/hU1gZZz51EM' },
  { slug: 'mounting-frame',  category: 'kigu',      titleJa: '連用取付枠 スイッチ・コンセントの結線',   titleKo: '연용 취부틀 + 스위치·콘센트 결선',           youtubeUrl: 'https://youtu.be/xGYxcutk3UY' },
  { slug: 'breaker',         category: 'kigu',      titleJa: '配線用遮断器の結線',                      titleKo: '배선용 차단기 결선',                         youtubeUrl: 'https://youtu.be/BBmg-pV18Tw' },
  { slug: 'terminal-block',  category: 'kigu',      titleJa: '端子台の結線',                            titleKo: '단자대 결선',                               youtubeUrl: 'https://youtu.be/8mzltadaihk' },
  { slug: 'conduit-pf',      category: 'kigu',      titleJa: '金属管 PF管の施工',                       titleKo: '금속관·PF관 시공',                          youtubeUrl: 'https://youtu.be/_KB14IC-x6g' },
  { slug: 'outlet-box',      category: 'kigu',      titleJa: 'アウトレットボックス ゴムブッシングの施工', titleKo: '아웃렛 박스·고무 부싱 시공',                youtubeUrl: 'https://youtu.be/Xl9gxXmyreg' },
  { slug: 'bond-wire',       category: 'kigu',      titleJa: 'ボンド線の結線',                          titleKo: '본드선 결선',                               youtubeUrl: 'https://youtu.be/XDd0XxjYrOI' },
  { slug: 'noji-bend',       category: 'kigu',      titleJa: 'ペンチを使ったのの字曲げ',                titleKo: '펜치를 사용한 の자 굽힘(のの字曲げ)',        youtubeUrl: 'https://youtu.be/cI2Qv5V8BjU' },

  // ── 電線の接続 ───────────────────────────────────────────
  { slug: 'ring-sleeve',      category: 'setsuzoku', titleJa: '圧着工具の使い方とリングスリーブによる圧着接続', titleKo: '압착공구 사용법과 링슬리브 압착 접속',  youtubeUrl: 'https://youtu.be/YaZbKgzhejo' },
  { slug: 'push-connector',   category: 'setsuzoku', titleJa: '差込形コネクタによる接続',                titleKo: '차입형 커넥터에 의한 접속',                 youtubeUrl: 'https://youtu.be/aR8Vv6sTZS0' },
  { slug: 'ring-sleeve-mark', category: 'setsuzoku', titleJa: 'リングスリーブの圧着マークの覚え方',      titleKo: '링슬리브 압착 마크 외우는 법',              youtubeUrl: 'https://youtu.be/On_KDBGAxws' },
]

export const getUnit = (slug: string) => DENKOSHI_UNITS.find(u => u.slug === slug)
export const getCategory = (key?: UnitCategory) => UNIT_CATEGORIES.find(c => c.key === key)
