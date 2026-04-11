'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDiagramConfig, type TopicTree } from '../../../lib/useDiagramConfig'

const COLORS = [
  { label: '파랑', value: 'bg-blue-700' },
  { label: '인디고', value: 'bg-indigo-700' },
  { label: '초록', value: 'bg-green-700' },
  { label: '노랑', value: 'bg-yellow-700' },
  { label: '주황', value: 'bg-orange-700' },
  { label: '청록', value: 'bg-teal-700' },
  { label: '보라', value: 'bg-purple-700' },
  { label: '빨강', value: 'bg-red-700' },
  { label: '핑크', value: 'bg-pink-700' },
]

export default function DiagramSettingsPage() {
  const { config, loading, save } = useDiagramConfig()
  const [topicTree, setTopicTree] = useState<TopicTree[]>([])
  const [natureTags, setNatureTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // config 로드 후 로컬 상태로 복사 (한 번만)
  if (!loading && !initialized) {
    setTopicTree(JSON.parse(JSON.stringify(config.topicTree)))
    setNatureTags([...config.natureTags])
    setInitialized(true)
  }

  // ── 대분류 조작 ─────────────────────────────────────
  const addTopic = () => {
    setTopicTree(prev => [...prev, { label: '', color: 'bg-blue-700', subs: [] }])
  }

  const updateTopic = (i: number, field: keyof TopicTree, value: string | string[]) => {
    setTopicTree(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  const removeTopic = (i: number) => {
    if (!confirm('대분류와 모든 소분류를 삭제할까요?')) return
    setTopicTree(prev => prev.filter((_, idx) => idx !== i))
  }

  const moveTopic = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= topicTree.length) return
    setTopicTree(prev => {
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // ── 소분류 조작 ─────────────────────────────────────
  const addSub = (topicIdx: number) => {
    setTopicTree(prev => prev.map((t, i) =>
      i === topicIdx ? { ...t, subs: [...t.subs, ''] } : t
    ))
  }

  const updateSub = (topicIdx: number, subIdx: number, value: string) => {
    setTopicTree(prev => prev.map((t, i) =>
      i === topicIdx
        ? { ...t, subs: t.subs.map((s, j) => j === subIdx ? value : s) }
        : t
    ))
  }

  const removeSub = (topicIdx: number, subIdx: number) => {
    setTopicTree(prev => prev.map((t, i) =>
      i === topicIdx ? { ...t, subs: t.subs.filter((_, j) => j !== subIdx) } : t
    ))
  }

  // ── 성격 태그 조작 ─────────────────────────────────
  const addNature = () => setNatureTags(prev => [...prev, ''])
  const updateNature = (i: number, v: string) =>
    setNatureTags(prev => prev.map((t, idx) => idx === i ? v : t))
  const removeNature = (i: number) =>
    setNatureTags(prev => prev.filter((_, idx) => idx !== i))

  // ── 저장 ─────────────────────────────────────────
  const handleSave = async () => {
    // 빈 label 검증
    const emptyTopic = topicTree.some(t => !t.label.trim())
    if (emptyTopic) { alert('대분류 이름이 비어있어요.'); return }
    const emptyNature = natureTags.some(t => !t.trim())
    if (emptyNature) { alert('성격 태그 이름이 비어있어요.'); return }

    // 빈 소분류 제거
    const cleaned = topicTree.map(t => ({ ...t, subs: t.subs.filter(s => s.trim()) }))

    setSaving(true)
    await save({ topicTree: cleaned, natureTags })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading || !initialized) {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">불러오는 중...</div>
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/diagram" className="text-gray-400 hover:text-white text-sm">← 오답노트</Link>
        </div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">⚙️ 분류 편집</h1>
            <p className="text-gray-500 text-sm">대분류·소분류·성격 태그를 자유롭게 수정하세요</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition ${
              saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'
            } disabled:opacity-50`}
          >
            {saved ? '✓ 저장됨' : saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>

        {/* ── 대분류 & 소분류 ─────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">📂 대분류 / 소분류</h2>
            <button onClick={addTopic}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition">
              + 대분류 추가
            </button>
          </div>

          <div className="space-y-4">
            {topicTree.map((topic, i) => (
              <div key={i} className="bg-gray-900 rounded-2xl p-5 border border-gray-700">
                {/* 대분류 헤더 */}
                <div className="flex items-center gap-2 mb-4">
                  {/* 순서 이동 */}
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveTopic(i, -1)} disabled={i === 0}
                      className="text-gray-500 hover:text-white disabled:opacity-20 text-xs px-1">▲</button>
                    <button onClick={() => moveTopic(i, 1)} disabled={i === topicTree.length - 1}
                      className="text-gray-500 hover:text-white disabled:opacity-20 text-xs px-1">▼</button>
                  </div>

                  {/* 이름 입력 */}
                  <input
                    className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-white font-semibold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="대분류 이름"
                    value={topic.label}
                    onChange={e => updateTopic(i, 'label', e.target.value)}
                  />

                  {/* 색상 선택 */}
                  <select
                    className="bg-gray-800 rounded-lg px-2 py-2 text-sm text-white outline-none"
                    value={topic.color}
                    onChange={e => updateTopic(i, 'color', e.target.value)}
                  >
                    {COLORS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>

                  {/* 미리보기 */}
                  <span className={`text-xs px-2 py-1 rounded-full ${topic.color} shrink-0`}>
                    {topic.label || '미리보기'}
                  </span>

                  {/* 삭제 */}
                  <button onClick={() => removeTopic(i)}
                    className="text-gray-600 hover:text-red-400 px-2 transition text-lg">✕</button>
                </div>

                {/* 소분류 */}
                <div className="space-y-2 pl-8">
                  {topic.subs.map((sub, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <input
                        className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="소분류 이름"
                        value={sub}
                        onChange={e => updateSub(i, j, e.target.value)}
                      />
                      <button onClick={() => removeSub(i, j)}
                        className="text-gray-600 hover:text-red-400 px-2 transition">✕</button>
                    </div>
                  ))}
                  <button onClick={() => addSub(i)}
                    className="text-gray-500 hover:text-blue-400 text-sm transition mt-1">
                    + 소분류 추가
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 성격 태그 ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">🏷️ 문제 성격 태그</h2>
            <button onClick={addNature}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm transition">
              + 태그 추가
            </button>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-700 space-y-2">
            {natureTags.map((tag, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="성격 태그 이름"
                  value={tag}
                  onChange={e => updateNature(i, e.target.value)}
                />
                <button onClick={() => removeNature(i)}
                  className="text-gray-600 hover:text-red-400 px-2 transition">✕</button>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-2">* 성격 태그 색상은 constants.ts의 NATURE_COLORS에서 관리됩니다</p>
        </section>

        {/* 하단 저장 */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-500'
            } disabled:opacity-50`}
          >
            {saved ? '✓ 저장됨' : saving ? '저장 중...' : '💾 변경사항 저장'}
          </button>
        </div>
      </div>
    </main>
  )
}
