'use client'

import { useRef, useState } from 'react'

// 새 태그 입력칸 — 한글 입력기에서도 Enter 한 번으로 들어가게
// -------------------------------------------------------------------
// 윈도우 크롬에서는 한글 조합 중에 누른 Enter 가 isComposing=true 로만 오고,
// 조합이 끝난 뒤 Enter 가 다시 오지 않는다. 그래서 "조합 중 Enter" 를 기억해 두었다가
// compositionend 에서 마저 넣는다. 쉼표·포커스 이탈·＋ 버튼으로도 넣을 수 있다.

export default function TagInput({
  onAdd, placeholder = '+ 새 태그', disabled = false, className = '',
}: {
  onAdd: (label: string) => void | Promise<void>
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [v, setV] = useState('')
  const pendingEnter = useRef(false)

  const commit = (raw: string) => {
    const parts = raw.split(/[,，]/).map(s => s.trim().replace(/^#/, '')).filter(Boolean)
    setV('')
    parts.forEach(p => onAdd(p))
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        value={v}
        disabled={disabled}
        onChange={e => {
          const next = e.target.value
          if (/[,，]/.test(next)) commit(next); else setV(next)
        }}
        onKeyDown={e => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (e.nativeEvent.isComposing) { pendingEnter.current = true; return }
          commit(e.currentTarget.value)
        }}
        onCompositionEnd={e => {
          if (!pendingEnter.current) return
          pendingEnter.current = false
          commit(e.currentTarget.value)
        }}
        onBlur={e => { if (e.currentTarget.value.trim()) commit(e.currentTarget.value) }}
        placeholder={placeholder}
        className="w-28 bg-transparent border-b border-gray-800 focus:border-gray-500 px-1 py-0.5 text-[11px] outline-none placeholder:text-gray-600 disabled:opacity-40"
      />
      {v.trim() && (
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => commit(v)}
          className="text-[11px] text-blue-300 hover:text-blue-200 px-1" aria-label="태그 넣기">＋</button>
      )}
    </span>
  )
}
