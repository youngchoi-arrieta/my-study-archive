'use client'
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export type ChartItem = { name: string; score: number; fullName: string }

function barColor(score: number) {
  if (score >= 60) return '#34d399'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartItem }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm">
      <p className="font-bold text-base" style={{ color: barColor(d.score) }}>{d.score}점</p>
      <p className="text-gray-400 text-xs mt-0.5">{d.fullName}</p>
    </div>
  )
}

export function DenkoshiChart({ data }: { data: ChartItem[] }) {
  if (data.length === 0) return (
    <p className="text-gray-600 text-sm text-center py-8">풀이 기록이 없습니다</p>
  )
  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 28 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6b7280' }} interval={0} angle={-40} textAnchor="end" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#4b5563' }} ticks={[0, 20, 40, 60, 80, 100]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <ReferenceLine y={60} stroke="#dc2626" strokeDasharray="4 3" strokeOpacity={0.7}
            label={{ value: '합격선', position: 'right', fontSize: 9, fill: '#dc2626' }} />
          <Bar dataKey="score" radius={[4, 4, 2, 2]} maxBarSize={48}>
            {data.map((d, i) => <Cell key={i} fill={barColor(d.score)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 justify-center mt-1">
        {[
          { color: '#34d399', label: '합격(60+)' },
          { color: '#fbbf24', label: '50~59점' },
          { color: '#f87171', label: '50점 미만' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span className="text-xs text-gray-500">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
