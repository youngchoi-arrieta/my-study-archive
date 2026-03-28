'use client'
import { useState, useEffect } from 'react'
import { Job, CAT_LABELS, STAGES } from '../types'

type Props = {
  job: Job | null
  defaultStage?: Job['stage']
  onSave: (data: Partial<Job>) => Promise<void>
  onClose: () => void
}

export default function JobModal({ job, defaultStage = 'watch', onSave, onClose }: Props) {
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [cat, setCat] = useState<Job['cat']>('top')
  const [priority, setPriority] = useState<Job['priority']>('mid')
  const [stage, setStage] = useState<Job['stage']>(defaultStage)
  const [deadline, setDeadline] = useState('')
  const [url, setUrl] = useState('')
  const [memo, setMemo] = useState('')
  const [jpScore, setJpScore] = useState('')
  const [blindScore, setBlindScore] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (job) {
      setCompany(job.company)
      setRole(job.role || '')
      setCat(job.cat)
      setPriority(job.priority)
      setStage(job.stage)
      setDeadline(job.deadline || '')
      setUrl(job.url || '')
      setMemo(job.memo || '')
      setJpScore(job.jp_score?.toString() || '')
      setBlindScore(job.blind_score?.toString() || '')
    }
  }, [job])

  async function handleSave() {
    if (!company.trim()) return alert('회사명을 입력해주세요')
    setSaving(true)
    await onSave({
      company: company.trim(),
      role: role.trim(),
      cat,
      priority,
      stage,
      deadline: deadline || null,
      url: url.trim(),
      memo: memo.trim(),
      jp_score: jpScore ? parseFloat(jpScore) : null,
      blind_score: blindScore ? parseFloat(blindScore) : null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{job ? '공고 수정' : '채용공고 추가'}</h2>

        {/* URL */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">공고 URL</label>
          <input
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
            placeholder="https://..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        {/* 회사명 / 직무 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">회사명 *</label>
            <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              placeholder="예: LS electric" value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">직무</label>
            <input className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              placeholder="예: 전기설계" value={role} onChange={e => setRole(e.target.value)} />
          </div>
        </div>

        {/* 카테고리 / 우선순위 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">카테고리</label>
            <select className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              value={cat} onChange={e => setCat(e.target.value as Job['cat'])}>
              {(Object.keys(CAT_LABELS) as Job['cat'][]).map(k => (
                <option key={k} value={k}>{CAT_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">우선순위</label>
            <select className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white"
              value={priority} onChange={e => setPriority(e.target.value as Job['priority'])}>
              <option value="high">높음</option>
              <option value="mid">보통</option>
              <option value="low">낮음</option>
            </select>
          </div>
        </div>

        {/* 단계 */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">진행 단계</label>
          <select className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white"
            value={stage} onChange={e => setStage(e.target.value as Job['stage'])}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* 마감일 */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">마감일</label>
          <input type="date" className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white"
            value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>

        {/* 잡플래닛 / 블라인드 평점 */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">잡플래닛 평점</label>
            <input type="number" min="0" max="5" step="0.1"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              placeholder="예: 3.8" value={jpScore} onChange={e => setJpScore(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">블라인드 평점</label>
            <input type="number" min="0" max="5" step="0.1"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
              placeholder="예: 4.1" value={blindScore} onChange={e => setBlindScore(e.target.value)} />
          </div>
        </div>

        {/* 메모 */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-1">메모</label>
          <textarea
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 h-24 resize-none"
            placeholder="리뷰 요약, 연봉 정보, 면접 준비 사항 등..."
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">취소</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm px-5 py-2 rounded-lg transition"
          >
            {saving ? '저장중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
