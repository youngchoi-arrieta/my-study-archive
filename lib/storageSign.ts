import { supabase } from './supabase'

// 비공개 버킷의 사진을 화면에 띄우기 위한 서명 URL 변환.
// -------------------------------------------------------------------
// DB(photo_url)에는 예전처럼 공개 URL 모양의 주소가 그대로 저장돼 있다.
// 버킷을 비공개로 바꾸면 그 주소로는 안 열리므로, 화면에 올리기 직전에만
// 일정 시간 유효한 서명 URL로 바꿔 끼운다. DB 값은 건드리지 않는다.

const EXPIRES_SEC = 60 * 60 * 6 // 6시간

export async function signBucketUrls<T extends { photo_url: string | null }>(
  bucket: string, items: T[],
): Promise<T[]> {
  const marker = `/storage/v1/object/public/${bucket}/`
  const paths = Array.from(new Set(
    items.map(i => i.photo_url).filter((u): u is string => !!u && u.includes(marker))
      .map(u => decodeURIComponent(u.split(marker)[1].split('?')[0])),
  ))
  if (paths.length === 0) return items
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, EXPIRES_SEC)
  if (error || !data) { console.error(error); return items }
  const map = new Map<string, string>()
  data.forEach(d => { if (d.path && d.signedUrl) map.set(d.path, d.signedUrl) })
  return items.map(i => {
    if (!i.photo_url || !i.photo_url.includes(marker)) return i
    const p = decodeURIComponent(i.photo_url.split(marker)[1].split('?')[0])
    const s = map.get(p)
    return s ? { ...i, photo_url: s } : i
  })
}
