import { supabase } from './supabase'

// 기록함 공용 — 저장하면 'inbox:changed' 이벤트를 쏴서
// 홈의 오늘 화면 같은 곳이 알아서 새로 불러오게 한다.
export const INBOX_EVENT = 'inbox:changed'

export async function addInbox(body: string): Promise<boolean> {
  const text = body.trim()
  if (!text) return false
  const { error } = await supabase.from('inbox').insert({ body: text })
  if (error) { console.error(error); return false }
  window.dispatchEvent(new Event(INBOX_EVENT))
  return true
}
