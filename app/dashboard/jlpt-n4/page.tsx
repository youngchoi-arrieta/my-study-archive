'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── 해커스 N4 한권으로 합격 목차 ─────────────────────────────────
// 목차 사진 업로드 후 실제 챕터로 교체 예정. 현재는 플레이스홀더 구조.
export type N4Chapter = {
  id: string
  part: string        // 파트 (예: "문자·어휘")
  title: string       // 챕터 제목
  pages?: string      // 페이지 범위 (선택)
  total_items: number // 학습 항목 수 (단어·문법 등)
}

// TODO: 목차 사진 업로드 후 여기를 실제 데이터로 채울 것
export const HAKUSU_TOC: N4Chapter[] = [
  // ── 파트 1: 문자·어휘 ──
  { id: 'v-01', part: '문자·어휘', title: '1과 명사 ①', total_items: 30 },
  { id: 'v-02', part: '문자·어휘', title: '2과 명사 ②', total_items: 30 },
  { id: 'v-03', part: '문자·어휘', title: '3과 명사 ③', total_items: 30 },
  { id: 'v-04', part: '문자·어휘', title: '4과 형용사', total_items: 25 },
  { id: 'v-05', part: '문자·어휘', title: '5과 동사 ①', total_items: 30 },
  { id: 'v-06', part: '문자·어휘', title: '6과 동사 ②', total_items: 30 },
  { id: 'v-07', part: '문자·어휘', title: '7과 부사·접속사·기타', total_items: 20 },
  { id: 'v-08', part: '문자·어휘', title: '8과 한자 읽기 ①', total_items: 25 },
  { id: 'v-09', part: '문자·어휘', title: '9과 한자 읽기 ②', total_items: 25 },
  // ── 파트 2: 문법 ──
  { id: 'g-01', part: '문법', title: '1과 조사·조동사', total_items: 20 },
  { id: 'g-02', part: '문법', title: '2과 て형·ない형 활용', total_items: 15 },
  { id: 'g-03', part: '문법', title: '3과 가능·수동·사역 표현', total_items: 15 },
  { id: 'g-04', part: '문법', title: '4과 수수표현 (あげる/もらう/くれる)', total_items: 12 },
  { id: 'g-05', part: '문법', title: '5과 경어 (존경·겸양)', total_items: 18 },
  { id: 'g-06', part: '문법', title: '6과 조건 표현 (と/ば/たら/なら)', total_items: 12 },
  { id: 'g-07', part: '문법', title: '7과 기타 문형', total_items: 20 },
  // ── 파트 3: 독해 ──
  { id: 'r-01', part: '독해', title: '독해 전략 · 단문', total_items: 10 },
  { id: 'r-02', part: '독해', title: '중문·장문', total_items: 10 },
  // ── 파트 4: 청해 ──
  { id: 'l-01', part: '청해', title: '과제이해 · 포인트이해', total_items: 10 },
  { id: 'l-02', part: '청해', title: '개요이해 · 발화표현', total_items: 10 },
]

// ── 타입 ────────────────────────────────────────────────────────
type ProgressRow = {
  chapter_id: string
  status: 'todo' | 'in_progress' | 'done'
  learned_items: number
  memo: string | null
  updated_at: string
}

const STATUS_LABEL: Record<string, string> = {
  todo:        '미학습',
  in_progress: '학습 중',
  done:        '완료',
}

const STATUS_COLOR: Record<string, string> = {
  todo:        'bg-gray-800 text-gray-500',
  in_progress: 'bg-yellow-900/40 text-yellow-400',
  done:        'bg-green-900/40 text-green-400',
}

const PARTS = ['문자·어휘', '문법', '독해', '청해']

const PART_COLORS: Record<string, string> = {
  '문자·어휘': '#2563eb',  // blue
  '문법':       '#7c3aed',  // violet
  '독해':       '#059669',  // emerald
  '청해':       '#b45309',  // amber
}

export default function JlptN4Hub() {
  const [activeTab, setActiveTab] = useState<'progress' | 'tools'>('progress')
  const [progressMap, setProgressMap] = useState<Map<string, ProgressRow>>(new Map())
  const [loading, setLoading]         = useState(true)
  const [editId, setEditId]           = useState<string | null>(null)
  const [editStatus, setEditStatus]   = useState<ProgressRow['status']>('todo')
  const [editLearned, setEditLearned] = useState('')
  const [editMemo, setEditMemo]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [filterPart, setFilterPart]   = useState<string | null>(null)

  const fetchProgress = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('jlpt_n4_progress')
      .select('chapter_id, status, learned_items, memo, updated_at')
    const map = new Map<string, ProgressRow>()
    ;(data || []).forEach((r: ProgressRow) => map.set(r.chapter_id, r))
    setProgressMap(map)
    setLoading(false)
  }, [])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  const startEdit = (ch: N4Chapter) => {
    const row = progressMap.get(ch.id)
    setEditId(ch.id)
    setEditStatus(row?.status || 'todo')
    setEditLearned(String(row?.learned_items ?? 0))
    setEditMemo(row?.memo || '')
  }

  const handleSave = async () => {
    if (!editId) return
    setSaving(true)
    const payload = {
      chapter_id:    editId,
      status:        editStatus,
      learned_items: parseInt(editLearned) || 0,
      memo:          editMemo.trim() || null,
      updated_at:    new Date().toISOString(),
    }
    await supabase.from('jlpt_n4_progress').upsert(payload, { onConflict: 'chapter_id' })
    await fetchProgress()
    setEditId(null)
    setSaving(false)
  }

  // ── 통계 계산 ─────────────────────────────────────────────────
  const total      = HAKUSU_TOC.length
  const doneCount  = [...progressMap.values()].filter(r => r.status === 'done').length
  const inProgCount= [...progressMap.values()].filter(r => r.status === 'in_progress').length
  const pct        = Math.round((doneCount / total) * 100)

  // 파트별 완료율
  const partStats = PARTS.map(part => {
    const chs  = HAKUSU_TOC.filter(c => c.part === part)
    const done = chs.filter(c => progressMap.get(c.id)?.status === 'done').length
    return { part, total: chs.length, done }
  })

  const visibleChapters = filterPart
    ? HAKUSU_TOC.filter(c => c.part === filterPart)
    : HAKUSU_TOC

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗣</span>
          <h1 className="text-2xl font-bold">JLPT N4</h1>
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          일본어능력시험 · 2026.7.5 시험 (불광중학교) · 해커스 N4 한권으로 합격
        </p>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { key: 'progress', label: '📋 진도 대시보드' },
            { key: 'tools',    label: '🔧 학습 도구' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 진도 대시보드 탭 ── */}
        {activeTab === 'progress' && (
          <div>
            {/* 상단 요약 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">전체 완료</p>
                <p className="text-2xl font-bold">
                  {doneCount}
                  <span className="text-sm text-gray-500 ml-1">/ {total}</span>
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">학습 중</p>
                <p className="text-2xl font-bold text-yellow-400">{inProgCount}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">진도율</p>
                <p className={`text-2xl font-bold ${pct >= 80 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {pct}%
                </p>
              </div>
            </div>

            {/* 전체 진도 바 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">전체 진도</p>
                <p className="text-xs text-gray-600">{doneCount} / {total} 챕터 완료</p>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* 파트별 완료율 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest">파트별 진도</p>
              {partStats.map(({ part, total: t, done }) => {
                const p = t === 0 ? 0 : Math.round((done / t) * 100)
                const color = PART_COLORS[part] || '#2563eb'
                return (
                  <div key={part}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">{part}</span>
                      <span className="text-xs text-gray-500">{done}/{t}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{ width: `${p}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 파트 필터 */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              <button
                onClick={() => setFilterPart(null)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterPart === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                전체
              </button>
              {PARTS.map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPart(filterPart === p ? null : p)}
                  style={filterPart === p ? { backgroundColor: PART_COLORS[p] } : undefined}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterPart === p ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* 챕터 목록 */}
            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div className="space-y-1.5">
                {visibleChapters.map(ch => {
                  const row     = progressMap.get(ch.id)
                  const status  = row?.status || 'todo'
                  const learned = row?.learned_items ?? 0
                  const isEdit  = editId === ch.id
                  const pctCh   = ch.total_items > 0 ? Math.round((learned / ch.total_items) * 100) : 0

                  return (
                    <div key={ch.id} className="bg-gray-900 rounded-xl overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800 transition"
                        onClick={() => setEditId(isEdit ? null : ch.id)}
                      >
                        {/* 파트 색 인디케이터 */}
                        <div
                          className="w-1.5 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: PART_COLORS[ch.part] || '#2563eb' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 mb-0.5">{ch.part}</p>
                          <p className="text-sm font-medium leading-snug">{ch.title}</p>
                          {/* 미니 진도 바 */}
                          {learned > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-800 rounded-full h-1">
                                <div
                                  className="h-1 rounded-full bg-blue-500"
                                  style={{ width: `${Math.min(pctCh, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-600">{learned}/{ch.total_items}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {row?.memo && (
                            <span className="text-[10px] text-blue-500">메모</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status]}`}>
                            {STATUS_LABEL[status]}
                          </span>
                          <span className="text-gray-700 text-xs">{isEdit ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* 편집 패널 */}
                      {isEdit && (
                        <div className="border-t border-gray-800 p-4 space-y-3">
                          {/* 상태 선택 */}
                          <div className="flex gap-1.5">
                            {(['todo', 'in_progress', 'done'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => setEditStatus(s)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                                  editStatus === s
                                    ? s === 'done' ? 'bg-green-600 text-white'
                                      : s === 'in_progress' ? 'bg-yellow-600 text-white'
                                      : 'bg-gray-600 text-white'
                                    : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                {STATUS_LABEL[s]}
                              </button>
                            ))}
                          </div>
                          {/* 학습 항목 수 */}
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">
                              학습 완료 항목 수 / {ch.total_items}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={ch.total_items}
                              value={editLearned}
                              onChange={e => setEditLearned(e.target.value)}
                              className="bg-gray-800 rounded-lg px-3 py-2 text-white w-28 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          {/* 메모 */}
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">메모 (약점·헷갈린 포인트)</label>
                            <textarea
                              rows={2}
                              value={editMemo}
                              onChange={e => setEditMemo(e.target.value)}
                              placeholder="예: て형 만드는 규칙 헷갈림"
                              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSave}
                              disabled={saving}
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                            >
                              {saving ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition"
                            >
                              닫기
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-gray-700 text-xs mt-4">
              ※ 목차는 해커스 N4 한권으로 합격 기준 플레이스홀더입니다.
              실물 책 목차 사진을 올려주시면 정확한 챕터로 업데이트됩니다.
            </p>
          </div>
        )}

        {/* ── 학습 도구 탭 ── */}
        {activeTab === 'tools' && (
          <div className="space-y-2">
            <Link
              href="/flashcard?exam=jlpt-n4"
              className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-4 transition"
            >
              <div>
                <p className="text-sm font-semibold">🃏 N4 단어·문형 플래시카드</p>
                <p className="text-xs text-gray-500 mt-0.5">필수 어휘 · 문법 패턴 인출 훈련</p>
              </div>
              <span className="text-gray-600 text-xs">→</span>
            </Link>
            <div className="bg-gray-900 rounded-xl px-4 py-4 opacity-50 cursor-not-allowed">
              <p className="text-sm font-semibold">📝 모의시험 채점 기록</p>
              <p className="text-xs text-gray-500 mt-0.5">준비 중</p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
