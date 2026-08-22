'use client'

// Achievements — /dashboard/achievements
// -------------------------------------------------------------------
// 힘들 때 여는 화면이다. 그래서 설계 원칙이 다른 페이지와 반대다.
//
//   · 진행률·다음 목표·D-day 를 넣지 않는다. 앞으로 할 일을 보여주면
//     "쉬려고 열었다가 더 지치는" 화면이 된다.
//   · 세는 건 남은 날이 아니라 지난 날이다 — "그날로부터 N일".
//   · 기본은 최신순. 가장 최근의 성취가 먼저 보인다.
//
// 위쪽 레일이 연표다. 점을 누르면 아래에 그 성취가 펼쳐지고,
// 증빙 PDF(자격증·성적표)가 그대로 뜬다. 파일은 드라이브에 두고 링크만 건다.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Achievement, KIND_META, KIND_ORDER,
  emptyAchievement, embedUrl, yearOf, longDate, daysSince,
} from '@/lib/constants-achievements'

export default function AchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Achievement> | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('achievements')
      .select('id, happened_on, title, kind, issuer, score, ref_no, pdf_url, note')
      .order('happened_on', { ascending: false })
    if (error) setErr(error.message)
    else { setItems((data ?? []) as Achievement[]); setErr(null) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // 최신순. 레일은 왼쪽이 최근이다.
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.happened_on.localeCompare(a.happened_on)),
    [items])

  const active = sorted.find(x => x.id === activeId) ?? sorted[0] ?? null

  const save = async () => {
    if (!editing?.title?.trim() || !editing.happened_on || busy) return
    setBusy(true)
    const payload = {
      happened_on: editing.happened_on,
      title: editing.title.trim(),
      kind: editing.kind ?? 'cert',
      issuer: editing.issuer || null,
      score: editing.score || null,
      ref_no: editing.ref_no || null,
      pdf_url: editing.pdf_url || null,
      note: editing.note || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = editing.id
      ? await supabase.from('achievements').update(payload).eq('id', editing.id)
      : await supabase.from('achievements').insert(payload)
    setErr(error ? error.message : null)
    setBusy(false)
    if (!error) { setEditing(null); await load() }
  }

  const remove = async (id: string) => {
    if (!confirm('이 기록을 지웁니다. 계속할까요?')) return
    await supabase.from('achievements').delete().eq('id', id)
    if (activeId === id) setActiveId(null)
    await load()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">

        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏅</span>
          <h1 className="text-2xl font-bold">해낸 것들</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          자격증 · 어학 · 학업 · 논문. 점을 누르면 그날의 증빙이 펼쳐집니다.
        </p>

        {err && <p className="text-red-400 text-xs mb-4">{err}</p>}

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : sorted.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-10 text-center">
            <p className="text-gray-400 text-sm mb-1">아직 비어 있습니다.</p>
            <p className="text-gray-600 text-xs mb-5 leading-relaxed">
              가장 최근에 딴 것부터 하나씩 넣어보세요.<br />
              나중에 힘들 때 열어볼 화면입니다.
            </p>
            <button onClick={() => setEditing(emptyAchievement())}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold transition">
              첫 기록 추가
            </button>
          </div>
        ) : (
          <>
            {/* ── 연표 레일 ─────────────────────────────────────── */}
            <div className="bg-gray-900/60 rounded-2xl p-4 mb-5 overflow-x-auto">
              <div className="relative flex items-end gap-0 min-w-max pb-1">
                {/* 가로선 */}
                <div className="absolute left-0 right-0 h-px bg-gray-800" style={{ bottom: '2.6rem' }} />

                {sorted.map((it, i) => {
                  const meta = KIND_META[it.kind] ?? KIND_META.milestone
                  const on = active?.id === it.id
                  const newYear = i === 0 || yearOf(sorted[i - 1].happened_on) !== yearOf(it.happened_on)
                  return (
                    <button key={it.id} onClick={() => setActiveId(it.id)}
                      className="relative flex flex-col items-center px-2 group shrink-0"
                      style={{ width: 132 }}>
                      {/* 이름은 두 줄까지 — 자격증 이름이 길어 한 줄로는 늘 잘렸다 */}
                      <span className={`text-[11px] leading-tight mb-1.5 h-8 flex items-end text-center transition ${
                        on ? 'text-white font-bold' : 'text-gray-400 group-hover:text-gray-200'
                      }`}
                        style={{
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{it.title}</span>
                      <span className={`mb-1 transition ${on ? 'text-base' : 'text-sm opacity-70'}`}>{meta.emoji}</span>
                      <span className={`rounded-full transition ${on ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`}
                        style={{
                          backgroundColor: meta.accent,
                          boxShadow: on ? `0 0 0 4px ${meta.accent}33` : 'none',
                        }} />
                      <span className={`text-[11px] mt-2 tabular-nums transition ${
                        on ? 'text-white font-bold' : 'text-gray-500 group-hover:text-gray-300'
                      }`}>
                        {it.happened_on.slice(5).replace('-', '.')}
                      </span>
                      {newYear && (
                        <span className="text-[10px] font-bold tracking-wider mt-0.5"
                          style={{ color: on ? meta.accent : '#64748b' }}>
                          {yearOf(it.happened_on)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── 펼친 성취 ─────────────────────────────────────── */}
            {active && (
              <div className="bg-gray-900 rounded-2xl p-5 mb-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-[12px] mb-1.5 font-medium" style={{ color: KIND_META[active.kind]?.accent }}>
                      {KIND_META[active.kind]?.emoji} {KIND_META[active.kind]?.label}
                      {active.issuer && <span className="text-gray-600"> · {active.issuer}</span>}
                    </p>
                    <h2 className="text-2xl font-bold mb-1.5 leading-tight">{active.title}</h2>
                    <p className="text-[15px] text-gray-200 font-medium">
                      {longDate(active.happened_on)}
                      <span className="text-gray-500 font-normal text-sm"> · 그날로부터 {daysSince(active.happened_on).toLocaleString()}일</span>
                    </p>
                    {(active.score || active.ref_no) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {active.score && (
                          <span className="text-[12px] font-bold px-2 py-1 rounded-lg"
                            style={{
                              backgroundColor: `${KIND_META[active.kind]?.accent}22`,
                              color: KIND_META[active.kind]?.accent,
                            }}>
                            {active.score}
                          </span>
                        )}
                        {active.ref_no && (
                          <span className="text-[11px] font-mono px-2 py-1 rounded-lg bg-gray-800 text-gray-400">
                            {active.ref_no}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setEditing(active)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
                      수정
                    </button>
                    <button onClick={() => remove(active.id)}
                      className="text-[11px] px-2 py-1.5 rounded-lg bg-gray-800 text-gray-600 hover:text-red-400 transition">
                      ×
                    </button>
                  </div>
                </div>

                {active.note && (
                  <p className="text-[13px] text-gray-300 leading-relaxed whitespace-pre-wrap border-l-2 pl-3 mb-4"
                    style={{ borderColor: KIND_META[active.kind]?.accent }}>
                    {active.note}
                  </p>
                )}

                {active.pdf_url ? (
                  embedUrl(active.pdf_url) ? (
                    <>
                      <iframe src={embedUrl(active.pdf_url)!}
                        className="w-full h-[65vh] rounded-xl bg-gray-950" allow="autoplay" />
                      <a href={active.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-2 text-[11px] text-blue-400 hover:text-blue-300 transition">
                        원본 열기 ↗
                      </a>
                    </>
                  ) : (
                    <a href={active.pdf_url} target="_blank" rel="noopener noreferrer"
                      className="inline-block text-[12px] px-3 py-2 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-800/50 transition">
                      증빙 열기 ↗ (미리보기를 지원하지 않는 주소)
                    </a>
                  )
                ) : (
                  <button onClick={() => setEditing(active)}
                    className="w-full py-8 rounded-xl border border-dashed border-gray-800 text-gray-600 hover:text-gray-400 hover:border-gray-700 text-[12px] transition">
                    + 증빙 PDF 링크 걸기 (구글 드라이브)
                  </button>
                )}
              </div>
            )}

            <button onClick={() => setEditing(emptyAchievement())}
              className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-sm font-bold transition">
              + 기록 추가
            </button>
          </>
        )}

        {/* ── 입력 ──────────────────────────────────────────────── */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setEditing(null)}>
            <div onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
              <p className="text-sm font-bold mb-4">{editing.id ? '기록 수정' : '기록 추가'}</p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {KIND_ORDER.map(k => (
                  <button key={k} onClick={() => setEditing({ ...editing, kind: k })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
                      (editing.kind ?? 'cert') === k ? 'text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                    }`}
                    style={(editing.kind ?? 'cert') === k ? { backgroundColor: KIND_META[k].accent } : {}}>
                    {KIND_META[k].emoji} {KIND_META[k].label}
                  </button>
                ))}
              </div>

              <Field label="이름">
                <input value={editing.title ?? ''} autoFocus
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  placeholder="예: 전기기사" className={INP} />
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="날짜">
                  <input type="date" value={editing.happened_on ?? ''}
                    onChange={e => setEditing({ ...editing, happened_on: e.target.value })}
                    className={INP} />
                </Field>
                <Field label="발급처">
                  <input value={editing.issuer ?? ''}
                    onChange={e => setEditing({ ...editing, issuer: e.target.value })}
                    placeholder="한국산업인력공단" className={INP} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="점수·등급">
                  <input value={editing.score ?? ''}
                    onChange={e => setEditing({ ...editing, score: e.target.value })}
                    placeholder="실기 84점" className={INP} />
                </Field>
                <Field label="자격증 번호">
                  <input value={editing.ref_no ?? ''}
                    onChange={e => setEditing({ ...editing, ref_no: e.target.value })}
                    placeholder="선택" className={INP} />
                </Field>
              </div>

              <Field label="증빙 PDF (구글 드라이브 공유 링크)">
                <input value={editing.pdf_url ?? ''}
                  onChange={e => setEditing({ ...editing, pdf_url: e.target.value })}
                  placeholder="https://drive.google.com/file/d/..." className={INP} />
              </Field>

              <Field label="그날의 기록">
                <textarea value={editing.note ?? ''} rows={3}
                  onChange={e => setEditing({ ...editing, note: e.target.value })}
                  placeholder="나중에 읽을 말. 어떻게 준비했는지, 그때 무슨 생각이었는지."
                  className={`${INP} resize-none`} />
              </Field>

              <div className="flex gap-2 mt-4">
                <button onClick={save} disabled={!editing.title?.trim() || busy}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold transition disabled:opacity-40">
                  저장
                </button>
                <button onClick={() => setEditing(null)}
                  className="px-5 py-2.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-sm font-bold transition">
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

const INP = 'w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] text-gray-400 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
