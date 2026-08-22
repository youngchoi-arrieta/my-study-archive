// Achievements — 해낸 것들
// ===================================================================
// 이 화면에는 의도적으로 없는 것들이 있다.
//   · 진행률 막대  · 다음 목표  · D-day  · 달성률
// 그런 건 다른 화면에 이미 다 있다. 여기는 힘들 때 여는 곳이라
// 앞으로 해야 할 일을 보여주면 목적이 반대가 된다.
//
// 남는 건 세 가지뿐이다 — 언제, 무엇을, 그리고 그날의 증빙.

export type AchievementKind = 'cert' | 'language' | 'academic' | 'paper' | 'milestone'

export interface KindMeta {
  label: string
  emoji: string
  accent: string
}

export const KIND_META: Record<AchievementKind, KindMeta> = {
  cert:      { label: '자격증',   emoji: '📜', accent: '#3b82f6' },
  language:  { label: '어학',     emoji: '🗣', accent: '#14b8a6' },
  academic:  { label: '학위·학업', emoji: '🎓', accent: '#a78bfa' },
  paper:     { label: '논문',     emoji: '🔬', accent: '#f59e0b' },
  milestone: { label: '이정표',   emoji: '🚩', accent: '#ec4899' },
}

export const KIND_ORDER: AchievementKind[] = ['cert', 'language', 'academic', 'paper', 'milestone']

export interface Achievement {
  id: string
  happened_on: string     // YYYY-MM-DD
  title: string
  kind: AchievementKind
  issuer: string | null
  score: string | null
  ref_no: string | null
  pdf_url: string | null
  note: string | null
}

export const emptyAchievement = (): Omit<Achievement, 'id'> => ({
  happened_on: new Date().toISOString().slice(0, 10),
  title: '', kind: 'cert', issuer: null, score: null, ref_no: null, pdf_url: null, note: null,
})

/** 구글 드라이브 공유링크 → 미리보기 주소 */
export function embedUrl(url: string): string | null {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  if (/\.pdf($|\?)/i.test(url)) return url
  return null
}

export const yearOf = (d: string) => d.slice(0, 4)

/** '2026-06-12' → '2026년 6월 12일' */
export function longDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${y}년 ${Number(m)}월 ${Number(day)}일`
}

/** 그날로부터 며칠 — 지난 시간을 세는 것뿐, 남은 시간이 아니다 */
export function daysSince(d: string): number {
  const then = new Date(`${d}T00:00:00`)
  return Math.floor((Date.now() - then.getTime()) / 86400000)
}
