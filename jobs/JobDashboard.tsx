'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { Job, TRACK_LABELS } from './types'
import KanbanView from './components/KanbanView'
import TimelineView from './components/TimelineView'
import ListView from './components/ListView'
import JobModal from './components/JobModal'
import JobDetailModal from './components/JobDetailModal'
import ElecMapView from './components/ElecMapView'

export default function JobDashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'kanban' | 'timeline' | 'elecmap' | 'skilltree' | 'interview'>('list')
  const searchParams = useSearchParams()

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && ['list','kanban','timeline','elecmap','skilltree','interview'].includes(t)) {
      setTab(t as typeof tab)
    }
  }, [searchParams])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterTrack, setFilterTrack] = useState<Job['track'] | ''>('')
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
    if (filterTrack && (j.track || 'job') !== filterTrack) return false
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

  // 트랙별 카운트 (전체 jobs 기준, 필터 무관)
  const trackCounts = {
    all: jobs.length,
    job: jobs.filter(j => (j.track || 'job') === 'job').length,
    scholarship: jobs.filter(j => j.track === 'scholarship').length,
    admission: jobs.filter(j => j.track === 'admission').length,
    ra: jobs.filter(j => j.track === 'ra').length,
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-white text-sm transition">← 홈</a>
            <h1 className="text-3xl font-bold">💼 진로 대시보드</h1>
          </div>
          <button
            onClick={() => { setEditJob(null); setModalOpen(true) }}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition"
          >
            + 추가
          </button>
        </div>

        {/* 뷰 탭 */}
        <div className="flex gap-1 border-b border-gray-800 mb-5">
          {([
            { id: 'list', label: '리스트' },
            { id: 'kanban', label: '칸반 보드' },
            { id: 'timeline', label: '마감일 타임라인' },
            { id: 'elecmap', label: '⚡ 전기직 지도' },
            { id: 'skilltree', label: '🗺 스킬트리' },
            { id: 'interview', label: '🎤 면접 대비' },
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

        {/* 트랙 필터 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterTrack('')}
            className={`px-3 py-1 rounded-full text-sm transition ${
              filterTrack === '' ? 'bg-white text-gray-900 font-medium' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            전체 <span className="ml-1 text-gray-500 text-xs">{trackCounts.all}</span>
          </button>
          {(Object.keys(TRACK_LABELS) as Job['track'][]).map(t => (
            <button
              key={t}
              onClick={() => setFilterTrack(filterTrack === t ? '' : t)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                filterTrack === t
                  ? 'bg-gray-200 text-gray-900 font-medium'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {TRACK_LABELS[t]}
              <span className="ml-1 text-gray-500 text-xs">{trackCounts[t]}</span>
            </button>
          ))}
        </div>

        {/* 검색 / 필터 */}
        <div className="flex gap-2 flex-wrap mb-5">
          <input
            className="flex-1 min-w-48 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
            placeholder="🔍 회사명·기관명, 직무·전공 검색..."
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
        ) : tab === 'elecmap' ? (
          <ElecMapView />
        ) : tab === 'interview' ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <p className="text-gray-500 text-sm">면접 대비 데이터베이스</p>
            <a href="/interview"
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition">
              🎤 면접 대비 열기 →
            </a>
            <p className="text-gray-700 text-xs">질문 패턴 · 의도 분석 · 답변 프레임</p>
          </div>
        ) : tab === 'skilltree' ? (
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
            {[
              { type: 'career', icon: '🗺', title: '경력 마일스톤', desc: '한국 · 일본 · 캐나다 · 호주 진출 경로별 자격증 및 비자 마일스톤', color: '#f87171' },
              { type: 'technical', icon: '⚙', title: '기술 스택', desc: '전력전자 · 모터제어 · 전력계통 · 신재생에너지 · 계측제어 역량 트리', color: '#60a5fa' },
            ].map(t => (
              <a key={t.type} href={`/dashboard/career/${t.type}`}
                className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-5 transition group"
                style={{ textDecoration: 'none' }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <p className="font-bold text-sm mb-1" style={{ color: t.color }}>{t.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
                <p className="text-right text-gray-700 group-hover:text-gray-400 text-xs mt-3 transition">열기 →</p>
              </a>
            ))}
          </div>
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
