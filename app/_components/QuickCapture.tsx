'use client'
import { useEffect, useRef, useState } from 'react'
import { addInbox } from '../../lib/inbox'

// 어느 화면에서든 오른쪽 아래 ✏️ → 한 줄 적고 엔터 → 기록함.
// 규칙 없음. 분류는 나중에.

export default function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (open) ref.current?.focus() }, [open])

  async function save() {
    if (busy || !text.trim()) return
    setBusy(true)
    const ok = await addInbox(text)
    setBusy(false)
    if (!ok) { alert('저장 실패 — 인터넷 연결이나 로그인을 확인하세요.'); return }
    setText(''); setOpen(false)
    setToast(true); setTimeout(() => setToast(false), 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 shadow-lg text-xl transition"
        aria-label="기록함에 한 줄 적기" title="기록함에 한 줄 적기"
      >✏️</button>

      {toast && (
        <div className="fixed bottom-20 right-4 z-50 text-xs bg-gray-800 text-gray-200 rounded-lg px-3 py-1.5">
          기록함에 저장됨
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-gray-900 rounded-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <textarea
              ref={ref} rows={2} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save() }
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="아무거나 한 줄"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-600 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-xs text-gray-500 px-3 py-1.5">닫기</button>
              <button onClick={save} disabled={busy || !text.trim()}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-4 py-1.5">
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
