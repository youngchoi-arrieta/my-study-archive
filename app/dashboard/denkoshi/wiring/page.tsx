'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function WiringList() {
  const router = useRouter()
  const [sessions, setSessions] = useState<WiringSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_wiring_sessions')
      .select('*')
      .order('created_at', { ascending: false })
    setSessions(data || [])
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
    if (!confirm('이 배선도 분석 세션을 삭제할까요?')) return
    await supabase.from('denkoshi_wiring_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard/denkoshi" className="text-gray-400 hover:text-white text-sm">← 덴켄 대시보드</Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">📐 배선도 분석</h1>
            <p className="text-gray-500 text-xs mt-1">배선도 이미지 + 자문자답 분석 세션</p>
          </div>
          <button
            onClick={() => setShowAdd(p => !p)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              showAdd ? 'bg-gray-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {showAdd ? '취소' : '+ 새 세션'}
          </button>
        </div>

        {showAdd && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-5 space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">세션 제목 *</label>
              <input
                autoFocus
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSession()}
                placeholder="예: 2025 하기 배선도, 분전반 결선도"
                className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">설명 (선택)</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="예: 2025년 하기 시험 배선도 분석"
                className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={addSession}
              disabled={saving || !newTitle.trim()}
              className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? '생성 중...' : '세션 만들기 →'}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-3">📐</p>
            <p className="text-gray-500 text-sm">아직 배선도 분석 세션이 없습니다.</p>
            <p className="text-gray-700 text-xs mt-1">'+ 새 세션'으로 시작해보세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => router.push(`/dashboard/denkoshi/wiring/${s.id}`)}
                className="bg-gray-900 rounded-2xl px-5 py-4 flex items-center justify-between group hover:bg-gray-800 transition cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{s.title}</p>
                  {s.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    {s.image_count > 0 && (
                      <span className="text-[10px] text-blue-400">📷 {s.image_count}장</span>
                    )}
                    {s.qa_count > 0 && (
                      <span className="text-[10px] text-purple-400">❓ {s.qa_count}문</span>
                    )}
                    <span className="text-[10px] text-gray-700">
                      {new Date(s.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs px-2 py-1 rounded transition ml-3"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
