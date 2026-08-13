'use client'

// 공식 과년도 배포 페이지 링크
// -------------------------------------------------------------------
// 허브 상단과 풀이 화면 양쪽에 붙는다.
// 풀이 화면에서는 PDF URL 입력칸 바로 옆에 있어야 의미가 있다 —
// "링크 열기 → 해당 회차 PDF 우클릭 복사 → 입력칸에 붙여넣기" 가 실제 동선이라서다.
//
// coverage 를 반드시 같이 보여준다. 기관마다 공개 범위가 달라서
// (시공관리는 공식이 최근 1~2년치뿐) 링크만 걸면 헛걸음하게 된다.

export type PaperLink = { label: string; url: string; coverage: string; note?: string }

export function PastPaperBar({ links, accent }: { links: PaperLink[]; accent?: string }) {
  if (!links || links.length === 0) return null
  return (
    <div className="space-y-2">
      {links.map(l => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
          className="flex items-start gap-3 bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition group">
          <span className="text-base shrink-0 mt-0.5">📥</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-200 group-hover:text-white leading-tight">
              {l.label}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">{l.coverage}</p>
            {l.note && <p className="text-[10px] text-gray-600 mt-0.5">{l.note}</p>}
          </div>
          <span className="text-gray-600 text-xs shrink-0 mt-0.5" style={accent ? { color: accent } : {}}>↗</span>
        </a>
      ))}
    </div>
  )
}

// 풀이 화면용 — 한 줄짜리 컴팩트 버전
export function PastPaperChip({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition bg-[#0f1c2e] hover:bg-[#1a2e47] text-gray-400 hover:text-white"
      title={`${label} — 새 탭에서 공식 과년도 페이지 열기`}>
      📥 {label} ↗
    </a>
  )
}
