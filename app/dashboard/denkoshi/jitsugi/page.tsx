import Link from 'next/link'
import { KOUHO_MONDAI, DIFF_LABEL, JITSUGI_EXAM } from '@/lib/constants-denkoshi-jitsugi'

export default function DenkoshiJitsugiHub() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🔌</span>
          <h1 className="text-2xl font-bold">第二種電気工事士 실기</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">{JITSUGI_EXAM.label} · 7/18·7/19 · 작업시간 40분</p>

        {/* 단위작업 진입 */}
        <Link
          href="/dashboard/denkoshi/jitsugi/units"
          className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-2xl px-5 py-4 mb-6 transition"
        >
          <div>
            <p className="text-sm font-semibold">🧰 단위작업</p>
            <p className="text-xs text-gray-500 mt-0.5">HOZAN 単位作業 20개 · 캡쳐 이미지 + 캡션 정리</p>
          </div>
          <span className="text-gray-600 text-xs">→</span>
        </Link>

        {/* 후보문제 */}
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">候補問題 No.1~13</p>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {KOUHO_MONDAI.map(p => {
            const d = DIFF_LABEL[p.difficulty]
            return (
              <Link
                key={p.no}
                href={`/dashboard/denkoshi/jitsugi/${p.no}`}
                className="block bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-blue-400">No.{p.no}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${d.color}22`, color: d.color }}>{d.ko}</span>
                </div>
                <p className="text-sm text-gray-200 leading-snug">{p.feature}</p>
                <p className="text-xs text-gray-600 mt-1">{p.featureJa}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
