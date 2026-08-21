'use client'

// 기출 문항 한 줄 — 눌러서 문제 전문을 펼친다.
// -------------------------------------------------------------------
// 요약문만 보면 "아, 시스유기전압" 하고 넘어가는데, 실제 문항은
// 소문항 구성과 주어진 조건이 답안 골격을 정한다. 그걸 바로 읽을 수 있어야
// 서브노트를 쓸 때 무엇을 채워야 하는지 알 수 있다.
//
// 그림이 딸린 문항은 전문만으로 부족하니 문제지 PDF 링크를 같이 건다.

import { useState } from 'react'
import Link from 'next/link'
import type { GisulsaQuestion } from '@/lib/constants-gisulsa'
import { GISULSA_MAP } from '@/lib/constants-gisulsa'
import { questionText } from '@/lib/data-gisulsa-balsong-text'
import { parseTag, tagLabel, tagTopic, GROUP_META } from '@/lib/constants-topics'

export function QuestionCard({
  q, paperUrl, showTags = false, compact = false,
}: {
  q: GisulsaQuestion
  paperUrl?: string | null
  showTags?: boolean
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const full = questionText(q.exam, q.session, q.no)
  const jong = GISULSA_MAP.get(q.jong)

  return (
    <div className={`rounded-lg transition ${open ? 'bg-gray-950' : 'hover:bg-gray-950/60'}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-2.5 px-2 py-1.5 text-left">
        <span className="shrink-0 w-24 text-[10px] font-mono text-gray-600 pt-0.5 leading-tight">
          {q.exam}회 {q.session}-{q.no}
          <span className="block text-gray-700">
            {q.points}점{!compact && jong && ` · ${jong.short}`}
          </span>
        </span>
        <p className="text-[12.5px] text-gray-300 leading-snug min-w-0 flex-1">{q.title}</p>
        <span className={`shrink-0 text-[10px] pt-0.5 transition ${open ? 'text-blue-400' : 'text-gray-700'}`}>
          {full ? (open ? '접기' : '전문') : '전문 없음'}
        </span>
      </button>

      {open && (
        <div className="px-2 pb-3 pl-[7.25rem]">
          {full ? (
            <>
              <p className="text-[13px] text-gray-200 leading-relaxed whitespace-pre-wrap border-l-2 border-gray-700 pl-3">
                {full.text}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {full.hasFigure && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400">
                    ⚠ 그림·표 있음 — 문제지 확인 필요
                  </span>
                )}
                {paperUrl && (
                  <a href={paperUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 hover:bg-blue-800/50 transition">
                    📄 제{q.exam}회 문제지 ↗
                  </a>
                )}
                <Link href={`/dashboard/gisulsa/${q.jong}/${q.exam}`}
                  className="text-[10px] text-gray-600 hover:text-gray-400 transition">
                  이 회차 전체 보기 →
                </Link>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-gray-600 border-l-2 border-gray-800 pl-3">
              전문이 아직 입력되지 않았습니다. 회차 상세에서 채울 수 있습니다.
            </p>
          )}

          {showTags && q.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {q.topics.map(c => {
                const t = tagTopic(c)
                const a = t ? GROUP_META[t.group].accent : '#9ca3af'
                return (
                  <Link key={c} href={`/dashboard/gisulsa/subnote/${c.split('/').map(encodeURIComponent).join('/')}`}
                    className="text-[10px] px-1.5 py-0.5 rounded font-bold transition hover:brightness-125"
                    style={{ backgroundColor: `${a}35`, color: a }}>
                    {parseTag(c).topic}
                    {parseTag(c).point && <span className="opacity-75"> / {tagLabel(c)}</span>}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
