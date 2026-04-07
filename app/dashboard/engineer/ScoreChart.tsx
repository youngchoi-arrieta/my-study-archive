'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export type ChartItem = { name: string; score: number; type: string; fullName: string }

const CHART_TABS = [
  { key: 'all', label: '전체' },
  { key: '10y', label: '10개년' },
  { key: '15y', label: '15개년' },
  { key: 'custom', label: '사설' },
]

function barColor(score: number, type: string) {
  if (score >= 60) return type === '사설' ? '#6ee7b7' : '#34d399'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartItem }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm">
      <p className="font-bold text-base" style={{ color: barColor(d.score, d.type) }}>{d.score}점</p>
      <p className="text-gray-400 text-xs mt-0.5">{d.fullName}</p>
      {d.type === '사설' && <p className="text-purple-400 text-xs">사설 모의고사</p>}
    </div>
  )
}

export function ScoreChart({ data }: { data: ChartItem[] }) {
  const [tab, setTab] = useState('all')
  const now = new Date().getFullYear()

  const filtered = (() => {
    if (tab === '10y') return data.filter(d => d.type !== '사설' && parseInt(d.name) >= now - 10)
    if (tab === '15y') return data.filter(d => d.type !== '사설' && parseInt(d.name) >= now - 15)
    if (tab === 'custom') return data.filter(d => d.type === '사설')
    return data
  })()

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {CHART_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-8">풀이 기록이 없습니다</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={filtered} margin={{ top: 10, right: 16, left: -20, bottom: 24 }}>
            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#6b7280' }} interval={0} angle={-40} textAnchor="end" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#4b5563' }} ticks={[0, 20, 40, 60, 80, 100]} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <ReferenceLine y={60} stroke="#dc2626" strokeDasharray="4 3" strokeOpacity={0.7}
              label={{ value: '합격선', position: 'right', fontSize: 9, fill: '#dc2626' }} />
            <Bar dataKey="score" radius={[4, 4, 2, 2]} maxBarSize={44}>
              {filtered.map((d, i) => (
                <Cell key={i} fill={barColor(d.score, d.type)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="flex gap-3 justify-center flex-wrap mt-2">
        {[
          { color: '#34d399', label: '합격권 기출' },
          { color: '#6ee7b7', label: '합격권 사설' },
          { color: '#fbbf24', label: '50~59점' },
          { color: '#f87171', label: '50점 미만' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
