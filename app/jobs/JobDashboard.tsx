'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Job } from './types'
import KanbanView from './components/KanbanView'
import TimelineView from './components/TimelineView'
import ListView from './components/ListView'
import JobModal from './components/JobModal'
import JobDetailModal from './components/JobDetailModal'

export default function JobDashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'kanban' | 'timeline'>('list')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editJob, setEditJob] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)

  useEffect(() => { fetchJobs() }, [])

  async function fetchJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  async function saveJob(payload: Partial<Job>) {
    if (editJob) {
      await supabase.from('jobs').update(payload).eq('id', editJob.id)
    } else {
      await supabase.from('jobs').insert({ ...payload, stage: 'watch' })
    }
    await fetchJobs()
    setModalOpen(false)
    setEditJob(null)
  }

  async function deleteJob(id: string) {
    await supabase.from('jobs').delete().eq('id', id)
    await fetchJobs()
    setDetailJob(null)
  }

  async function updateStage(id: string, stage: Job['stage']) {
    await supabase.from('jobs').update({ stage }).eq('id', id)
    setJobs(prev => prev.map(j => j.id === id ? { ...j, stage } : j))
    setDetailJob(prev => prev?.id === id ? { ...prev, stage } : prev)
  }

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    if (q && !j.company.toLowerCase().includes(q) && !(j.role || '').toLowerCase().includes(q)) return false
    if (filterCat && j.cat !== filterCat) return false
    return true
  })

  const stats = {
    total: filtered.length,
    active: filtered.filter(j => j.stage !== 'pass' && j.stage !== 'offer').length,
    interview: filtered.filter(j => j.stage === 'interview').length,
    offer: filtered.filter(j => j.stage === 'offer').length,
    urgent: filtered.filter(j => {
      if (!j.deadline) return false
      const d = Math.ceil((new Date(j.deadline).getTime() - new Date().getTime()) / 86400000)
      return d >= 0 && d <= 7
    }).length,
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-white text-sm transition">← 홈</a>
            <h1 className="text-3xl font-bold">💼 구직 대시보드</h1>
          </div>
          <button
            onClick={() => { setEditJob(null); setModalOpen(true) }}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition"
          >
            + 공고 추가
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-800 mb-5">
          {([
            { id: 'list', label: '리스트' },
            { id: 'kanban', label: '칸반 보드' },
            { id: 'timeline', label: '마감일 타임라인' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-white text-white font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 검색 / 필터 */}
        <div className="flex gap-2 flex-wrap mb-5">
          <input
            className="flex-1 min-w-48 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
            placeholder="🔍 회사명, 직무 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-white"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
          >
            <option value="">전체 카테고리</option>
            <option value="top">Top company</option>
            <option value="foreign">외국계</option>
            <option value="sme">중소기업</option>
            <option value="dc">데이터센터</option>
          </select>
        </div>

        {/* 스탯 */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            ['전체', stats.total, ''],
            ['진행중', stats.active, ''],
            ['면접', stats.interview, ''],
            ['오퍼', stats.offer, ''],
            ['마감 임박', stats.urgent, stats.urgent > 0 ? 'text-red-400' : ''],
          ].map(([label, val, cls]) => (
            <div key={label as string} className="bg-gray-900 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${cls}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* 본문 */}
        {loading ? (
          <p className="text-gray-500 text-center py-20">불러오는 중...</p>
        ) : tab === 'list' ? (
          <ListView
            jobs={filtered}
            onCard={setDetailJob}
            onStageChange={updateStage}
          />
        ) : tab === 'kanban' ? (
          <KanbanView
            jobs={filtered}
            onCard={setDetailJob}
          />
        ) : (
          <TimelineView jobs={filtered} onCard={setDetailJob} />
        )}
      </div>

      {modalOpen && (
        <JobModal
          job={editJob}
          defaultStage="watch"
          onSave={saveJob}
          onClose={() => { setModalOpen(false); setEditJob(null) }}
        />
      )}

      {detailJob && (
        <JobDetailModal
          job={detailJob}
          onClose={() => setDetailJob(null)}
          onEdit={(j) => { setDetailJob(null); setEditJob(j); setModalOpen(true) }}
          onDelete={deleteJob}
          onStageChange={updateStage}
        />
      )}
    </main>
  )
}
