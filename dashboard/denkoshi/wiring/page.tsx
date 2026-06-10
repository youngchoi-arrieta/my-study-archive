'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type WiringSession = {
  id: string
  title: string
  description: string | null
  qa_count: number
  image_count: number
  created_at: string
}

const SORT_KEY = 'denkoshi_wiring_sort_order'
function loadOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(SORT_KEY) || '[]') } catch { return [] }
}
function saveOrder(ids: string[]) {
  try { localStorage.setItem(SORT_KEY, JSON.stringify(ids)) } catch {}
}
function applyOrder(sessions: WiringSession[], order: string[]): WiringSession[] {
  if (!order.length) return sessions
  const map = new Map(sessions.map(s => [s.id, s]))
  const ordered = order.filter(id => map.has(id)).map(id => map.get(id)!)
  const rest = sessions.filter(s => !order.includes(s.id))
  return [...ordered, ...rest]
}

export default function WiringList() {
  const router = useRouter()
  const [sessions, setSessions] = useState<WiringSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const dragIdx = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_wiring_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      const order = loadOrder()
      setSessions(applyOrder(data, order))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const addSession = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('denkoshi_wiring_sessions')
      .insert({ title: newTitle.trim(), description: newDesc.trim() || null, qa_count: 0, image_count: 0 })
      .select()
      .single()
    if (data) {
      router.push(`/dashboard/denkoshi/wiring/${data.id}`)
    } else {
      console.error(error)
      setSaving(false)
    }
  }

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('삭제할까요?')) return
    await supabase.from('denkoshi_wiring_sessions').delete().eq('id', id)
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      saveOrder(next.map(s => s.id))
      return next
    })
  }

  const onDragStart = (e: React.DragEvent, idx: number) => {
    dragIdx.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOver(idx)
  }
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    const from = dragIdx.current
    if (from === null || from === idx) { setDragOver(null); return }
    setSessions(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(idx, 0, moved)
      saveOrder(next.map(s => s.id))
      return next
    })
    dragIdx.current = null
    setDragOver(null)
  }
  const onDragEnd = () => { dragIdx.current = null; setDragOver(null) }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-5">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-3 mb-5">
          <Link href="/dashboard/denkoshi" className="text-gray-500 hover:text-white text-sm shrink-0">← 덴켄</Link>
          <h1 className="text-base font-bold">📐 배선도 분석</h1>
          <div className="ml-auto">
            <button
              onClick={() => setShowAdd(p => !p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                showAdd ? 'bg-gray-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {showAdd ? '취소' : '+ 새 세션'}
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="bg-gray-900 rounded-2xl p-4 mb-4 space-y-2.5">
            <input
              autoFocus
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSession()}
              placeholder="세션 제목 * (예: 2025 하기 배선도)"
              className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="text"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="설명 (선택)"
              className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={addSession}
              disabled={saving || !newTitle.trim()}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? '생성 중...' : '만들기 →'}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">📐</p>
            <p className="text-gray-500 text-sm">아직 배선도 분석 세션이 없습니다.</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-gray-700 mb-2 select-none">⠿ 카드를 드래그해서 순서 변경</p>
            <div className="grid grid-cols-2 gap-2">
              {sessions.map((s, idx) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={e => onDragStart(e, idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDrop={e => onDrop(e, idx)}
                  onDragEnd={onDragEnd}
                  onClick={() => router.push(`/dashboard/denkoshi/wiring/${s.id}`)}
                  className={`bg-gray-900 rounded-xl px-4 py-3 flex flex-col group cursor-pointer transition select-none ${
                    dragOver === idx ? 'ring-2 ring-blue-500 bg-gray-800' : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-snug truncate">{s.title}</p>
                      {s.description && (
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{s.description}</p>
                      )}
                    </div>
                    <span className="text-gray-600 text-sm shrink-0 cursor-grab active:cursor-grabbing mt-0.5 select-none">⠿</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {s.image_count > 0 && <span className="text-[10px] text-blue-400">📷 {s.image_count}</span>}
                    {s.qa_count > 0 && <span className="text-[10px] text-purple-400">❓ {s.qa_count}문</span>}
                    <span className="text-[10px] text-gray-700 ml-auto">
                      {new Date(s.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <button
                    onClick={e => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 text-[10px] text-right mt-1.5 transition"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
