'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  CertDef, CertKind, ALL_KINDS, KIND_LABELS, CERT_CATALOG, MY_CERTS,
  Company, RuleGroup, RuleTier, COMPANIES,
  CompanyRow, mergeCompanies, blankCompany, SUGGESTIONS, SUGGEST_TAGS, SuggestTag,
  SpecRow, SpecMap, toSpecMap, langSources, bestToeic,
  scoreCompany, CompanyResult, tierMet,
  MockRow, MOCK_PARTS, EssayRow, pct,
} from '@/lib/constants-koreapub'

// ───────────────────────────────────────────────────────────────
//  한국 공기업 전기직
//    기업    서류 표준배점표를 그대로 놓고 내가 몇 점인지
//    내 스펙  현실적으로 딸 수 있는 것만
//    자소서   기업별 문항 + 답안
//    모의고사 NCS / 전공 / 법령
// ───────────────────────────────────────────────────────────────

type Tab = 'companies' | 'spec' | 'essay' | 'mocks'

interface RubricRow { company_id: string; groups: RuleGroup[]; memo: string | null }

export default function KoreaPubPage() {
  const [tab, setTab] = useState<Tab>('companies')
  const [specs, setSpecs] = useState<SpecRow[]>([])
  const [rubrics, setRubrics] = useState<RubricRow[]>([])
  const [mocks, setMocks] = useState<MockRow[]>([])
  const [essays, setEssays] = useState<EssayRow[]>([])
  const [coRows, setCoRows] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: sp }, { data: rb }, { data: mk }, { data: es }, { data: co }] = await Promise.all([
      supabase.from('kp_specs').select('cert_key, has, value'),
      supabase.from('kp_rubrics').select('company_id, groups, memo'),
      supabase.from('kp_mocks').select('*').order('taken_on', { ascending: false }),
      supabase.from('kp_essays').select('*').order('idx', { ascending: true }),
      supabase.from('kp_companies').select('id, hidden, data, sort_order'),
    ])
    setSpecs((sp as SpecRow[]) || [])
    setRubrics((rb as RubricRow[]) || [])
    setMocks((mk as MockRow[]) || [])
    setEssays((es as EssayRow[]) || [])
    setCoRows((co as CompanyRow[]) || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const spec: SpecMap = useMemo(() => toSpecMap(specs), [specs])

  const companies: Company[] = useMemo(() => mergeCompanies(coRows).map(c => {
    const r = rubrics.find(x => x.company_id === c.id)
    return r?.groups?.length ? { ...c, groups: r.groups } : c
  }), [coRows, rubrics])

  const results = useMemo(() => companies.map(c => scoreCompany(c, spec)), [companies, spec])

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛</span>
            <h1 className="text-2xl font-bold">한국 공기업 전기직</h1>
          </div>
          <Link href="/dashboard/timeline"
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition shrink-0">
            🗓 일정
          </Link>
        </div>
        <p className="text-gray-500 text-sm mb-5">서류 배점표 · 내 점수 · 자소서 · NCS/전공 모의고사</p>

        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-5">
          {([
            { key: 'companies', label: `🏢 기업 ${companies.length}` },
            { key: 'spec', label: `🎫 내 스펙 ${Object.keys(spec).length}` },
            { key: 'essay', label: '✍️ 자소서' },
            { key: 'mocks', label: `📊 모의 ${mocks.length}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                tab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>{label}</button>
          ))}
        </div>

        {loading && <p className="text-gray-500 text-sm">불러오는 중...</p>}
        {!loading && tab === 'companies' && <CompaniesTab results={results} spec={spec} rubrics={rubrics} coRows={coRows} onSaved={fetchAll} />}
        {!loading && tab === 'spec' && <SpecTab specs={specs} spec={spec} onSaved={fetchAll} />}
        {!loading && tab === 'essay' && <EssayTab essays={essays} companies={companies} onSaved={fetchAll} />}
        {!loading && tab === 'mocks' && <MocksTab mocks={mocks} onSaved={fetchAll} />}
      </div>
    </main>
  )
}

// ═══════════════════════════════════════════════════════════════
//  기업
// ═══════════════════════════════════════════════════════════════
function CompaniesTab({ results, spec, rubrics, coRows, onSaved }: {
  results: CompanyResult[]; spec: SpecMap; rubrics: RubricRow[]
  coRows: CompanyRow[]; onSaved: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [manage, setManage] = useState(false)
  const targets = results.filter(r => r.company.target)
  const refs = results.filter(r => !r.company.target)

  const render = (list: CompanyResult[]) => list.map(r => (
    <CompanyCard key={r.company.id} r={r} spec={spec}
      open={openId === r.company.id}
      onToggle={() => setOpenId(openId === r.company.id ? null : r.company.id)}
      rubric={rubrics.find(x => x.company_id === r.company.id)}
      custom={!!coRows.find(x => x.id === r.company.id)?.data}
      onSaved={onSaved} />
  ))

  return (
    <div>
      {Object.keys(spec).length === 0 && (
        <div className="bg-amber-950/40 border border-amber-900 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-amber-300 mb-1">먼저 「내 스펙」을 채워주세요</p>
          <p className="text-xs text-amber-200/70">체크하는 즉시 기업별 서류점수가 계산됩니다.</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">🎯 주 타깃</p>
        <button onClick={() => setManage(v => !v)}
          className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition ${
            manage ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
          }`}>
          {manage ? '완료' : '✎ 기업 관리'}
        </button>
      </div>

      {manage ? (
        <CompanyManager coRows={coRows} onSaved={onSaved} />
      ) : (
        <>
          <div className="space-y-3 mb-8">
            {targets.length ? render(targets)
              : <p className="text-gray-600 text-sm py-4">주 타깃으로 표시된 기업이 없습니다.</p>}
          </div>
          {refs.length > 0 && (
            <>
              <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">📐 레퍼런스</p>
              <div className="space-y-3">{render(refs)}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── 기업 추가 · 숨김 ─────────────────────────────────────────────
function CompanyManager({ coRows, onSaved }: { coRows: CompanyRow[]; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [busy, setBusy] = useState(false)
  const [tag, setTag] = useState<SuggestTag | 'all'>('all')

  const rowOf = (id: string) => coRows.find(r => r.id === id)
  const custom = coRows.filter(r => r.data)

  const setHidden = async (id: string, hidden: boolean, data: Company | null = null) => {
    if (busy) return
    setBusy(true)
    await supabase.from('kp_companies').upsert(
      { id, hidden, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setBusy(false); onSaved()
  }

  const add = async (n: string, sec: string, target = true) => {
    if (!n.trim() || busy) return
    setBusy(true)
    const id = `u-${Date.now().toString(36)}`
    const c = blankCompany(id, n.trim())
    c.sector = sec
    c.target = target
    await supabase.from('kp_companies').insert({
      id, hidden: false, data: c, sort_order: custom.length,
    })
    setBusy(false); setName(''); setSector(''); onSaved()
  }

  const removeCustom = async (id: string, label: string) => {
    if (!confirm(`"${label}" 을(를) 목록에서 지울까요?`)) return
    await supabase.from('kp_companies').delete().eq('id', id)
    onSaved()
  }

  const setTargetFlag = async (r: CompanyRow, target: boolean) => {
    if (!r.data) return
    await supabase.from('kp_companies')
      .update({ data: { ...r.data, target }, updated_at: new Date().toISOString() })
      .eq('id', r.id)
    onSaved()
  }

  const inp = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700'
  const shown = tag === 'all' ? SUGGESTIONS : SUGGESTIONS.filter(s => s.tag === tag)

  return (
    <div className="space-y-5">
      {/* 내장 기업 표시 여부 */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-3">기본 제공 기업 — 끄면 목록에서 사라집니다</p>
        <div className="space-y-1.5">
          {COMPANIES.map(c => {
            const hidden = !!rowOf(c.id)?.hidden
            return (
              <div key={c.id} className="flex items-center gap-3">
                <button onClick={() => setHidden(c.id, !hidden)} disabled={busy}
                  className={`w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 transition ${hidden ? 'bg-gray-700 justify-start' : 'bg-blue-600 justify-end'}`}>
                  <span className="w-4 h-4 bg-white rounded-full block" />
                </button>
                <span className={`text-[13px] flex-1 truncate ${hidden ? 'text-gray-600 line-through' : ''}`}>{c.name}</span>
                <span className="text-[10px] text-gray-700 shrink-0">{c.sector}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 직접 추가한 기업 */}
      {custom.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-3">직접 추가한 기업</p>
          <div className="space-y-1.5">
            {custom.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <button onClick={() => setTargetFlag(r, !r.data!.target)}
                  className={`text-[10px] px-2 py-1 rounded shrink-0 font-bold ${r.data!.target ? 'bg-blue-600/30 text-blue-300' : 'bg-gray-800 text-gray-500'}`}>
                  {r.data!.target ? '주 타깃' : '레퍼런스'}
                </button>
                <span className="text-[13px] flex-1 truncate">{r.data!.name}</span>
                <button onClick={() => removeCustom(r.id, r.data!.name)}
                  className="text-[11px] text-gray-700 hover:text-red-400 px-1 shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 직접 입력 */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-3">기업 추가</p>
        <div className="flex gap-2 mb-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="기업명"
            className={`${inp} flex-1 min-w-0`} />
          <input value={sector} onChange={e => setSector(e.target.value)} placeholder="분야"
            className={`${inp} w-28 shrink-0`} />
          <button onClick={() => add(name, sector)} disabled={!name.trim() || busy}
            className="px-4 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition shrink-0">
            추가
          </button>
        </div>
        <p className="text-[10px] text-gray-600">
          추가하면 빈 배점표로 들어갑니다. 카드를 열고 「배점 편집」에서 공고 표를 옮겨 넣으세요.
        </p>
      </div>

      {/* 후보 */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-xs text-gray-500 mb-2">후보 — 탭하면 바로 추가됩니다</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setTag('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${tag === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}>전체</button>
          {(Object.keys(SUGGEST_TAGS) as SuggestTag[]).map(t => (
            <button key={t} onClick={() => setTag(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${tag === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {SUGGEST_TAGS[t].label}
            </button>
          ))}
        </div>
        {tag !== 'all' && (
          <p className="text-[10px] text-gray-600 mb-2">{SUGGEST_TAGS[tag].desc}</p>
        )}
        <div className="space-y-2">
          {shown.map(sg => {
            const already = custom.some(r => r.data?.name === sg.name)
            return (
              <div key={sg.name} className="flex items-start gap-3 py-2 border-b border-gray-800 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">
                    {sg.name}
                    <span className="text-[10px] text-gray-600 font-normal ml-2">{sg.sector}</span>
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{sg.why}</p>
                </div>
                <button onClick={() => add(sg.name, sg.sector)} disabled={already || busy}
                  className={`text-[11px] px-2.5 py-1 rounded-lg shrink-0 font-bold transition ${
                    already ? 'bg-gray-800 text-gray-600' : 'bg-blue-700 hover:bg-blue-600 text-white'
                  }`}>
                  {already ? '추가됨' : '추가'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CompanyCard({ r, spec, open, onToggle, rubric, custom, onSaved }: {
  r: CompanyResult; spec: SpecMap; open: boolean; onToggle: () => void
  rubric?: RubricRow; custom?: boolean; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const c = r.company
  const toeic = bestToeic(spec)
  const p = r.max === 0 ? 0 : (r.earned / r.max) * 100

  return (
    <div className={`bg-gray-900 rounded-2xl transition ${open ? 'ring-1 ring-blue-900' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-bold text-sm flex items-center gap-2">
              {c.name}
              {c.confirmed
                ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/60 text-green-400 font-bold">공고 확인</span>
                : <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 font-bold">미확인</span>}
              {custom && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 font-bold">직접 추가</span>}
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5">{c.sector} · {c.season}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-blue-400 leading-none">
              {r.earned}<span className="text-xs text-gray-600">/{r.max}</span>
            </p>
            <p className="text-[10px] text-gray-600 mt-1">
              서류{r.extraEarned > 0 && ` +별도 ${r.extraEarned}`}
            </p>
          </div>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${p}%` }} />
        </div>
        {r.upside.length > 0 && (
          <p className="text-[11px] text-gray-500 mt-2 truncate">
            {r.upside.slice(0, 2).map(u => (
              <span key={u.label} className="mr-3">
                <span className="text-amber-400">+{u.gain}</span> {u.label}
              </span>
            ))}
          </p>
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">필기</p>
          <div className="space-y-1 mb-2">
            {c.exam.parts.map(pt => (
              <div key={pt.name} className="flex items-baseline justify-between text-xs">
                <span className="text-gray-300">{pt.name}</span>
                <span className="text-gray-600">
                  {pt.q ? `${pt.q}문항` : ''}{pt.q && pt.pt ? ' · ' : ''}{pt.pt ? `${pt.pt}점` : ''}
                  {!pt.q && !pt.pt ? '공고별' : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">총점 {c.exam.total}</p>
          <p className="text-[11px] text-red-400/80 mb-4">과락 {c.exam.cutoff}</p>

          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">지원 자격</p>
          <ul className="space-y-1 mb-4">
            {c.eligibility.map((e, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-2"><span className="text-gray-700">·</span>{e}</li>
            ))}
          </ul>

          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
              서류 배점표 <span className="text-gray-700 normal-case">합계 {c.docTotal}점</span>
            </p>
            <button onClick={() => setEditing(v => !v)}
              className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition">
              {editing ? '편집 닫기' : '✎ 배점 편집'}
            </button>
          </div>

          {editing ? (
            <RubricEditor c={c} rubric={rubric} onSaved={() => { setEditing(false); onSaved() }} />
          ) : (
            <div className="space-y-4">
              {r.groups.map(g => (
                <div key={g.group.id}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-200">
                      {g.group.label}
                      <span className="text-[10px] text-gray-600 font-normal ml-1.5">
                        {g.group.max}점 · {g.group.mode === 'top1' ? '최상위 1개' : '합산'}
                      </span>
                    </span>
                    <span className={`text-sm font-bold ${g.earned > 0 ? 'text-blue-400' : 'text-gray-700'}`}>
                      {g.earned}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {g.group.tiers.map((t, i) => {
                      const met = tierMet(t, spec, toeic)
                      const hit = g.hitTier === t || (g.group.mode === 'sum' && met)
                      return (
                        <div key={i}
                          className={`flex items-baseline gap-2 text-[11px] px-2 py-1 rounded ${
                            hit ? 'bg-blue-600/25' : met ? 'bg-gray-800/60' : ''
                          }`}>
                          <span className={`w-8 text-right font-bold shrink-0 ${hit ? 'text-blue-300' : 'text-gray-600'}`}>
                            {t.points}
                          </span>
                          <span className={hit ? 'text-white' : met ? 'text-gray-400' : 'text-gray-600'}>
                            {t.label}
                          </span>
                          {hit && <span className="ml-auto text-[9px] text-blue-300 shrink-0">←내 등급</span>}
                        </div>
                      )
                    })}
                  </div>
                  {g.group.note && <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">{g.group.note}</p>}
                </div>
              ))}

              {r.extra && (
                <div className="pt-3 border-t border-gray-800">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-bold text-gray-400">
                      {r.extra.group.label}
                      <span className="text-[10px] text-gray-600 font-normal ml-1.5">최대 {r.extra.group.max}점 · 합계 밖</span>
                    </span>
                    <span className="text-sm font-bold text-gray-500">{r.extra.earned}</span>
                  </div>
                  {r.extra.group.tiers.map((t, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[11px] px-2 py-0.5">
                      <span className="w-8 text-right text-gray-600 font-bold shrink-0">{t.points}</span>
                      <span className="text-gray-600">{t.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {r.upside.length > 0 && !editing && (
            <div className="mt-4 pt-3 border-t border-gray-800">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">다음 한 수</p>
              <div className="space-y-1">
                {r.upside.map(u => (
                  <div key={u.label} className="flex items-baseline gap-2 text-xs">
                    <span className="text-amber-400 font-bold w-9 shrink-0">+{u.gain}</span>
                    <span className="text-gray-400 truncate">{u.how}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.tiebreak && (
            <p className="text-[10px] text-gray-600 mt-3">
              동점자 처리: {c.tiebreak.map((t, i) => `${i + 1}. ${t}`).join('  ')}
            </p>
          )}
          <p className="text-[10px] text-gray-700 mt-3 leading-relaxed border-t border-gray-800 pt-3">
            {c.confirmed ? '✓ ' : '⚠ '}{c.verified}
          </p>
          {rubric?.memo && <p className="text-[10px] text-blue-400/70 mt-1">📌 {rubric.memo}</p>}
        </div>
      )}
    </div>
  )
}

// ── 배점 편집 ────────────────────────────────────────────────────
function RubricEditor({ c, rubric, onSaved }: { c: Company; rubric?: RubricRow; onSaved: () => void }) {
  const [groups, setGroups] = useState<RuleGroup[]>(() => JSON.parse(JSON.stringify(c.groups)))
  const [memo, setMemo] = useState(rubric?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [pickFor, setPickFor] = useState<string | null>(null)

  const upd = (gi: number, patch: Partial<RuleGroup>) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, ...patch } : g))
  const updTier = (gi: number, ti: number, patch: Partial<RuleTier>) =>
    setGroups(gs => gs.map((g, i) => i === gi
      ? { ...g, tiers: g.tiers.map((t, j) => j === ti ? { ...t, ...patch } : t) } : g))
  const addTier = (gi: number) =>
    setGroups(gs => gs.map((g, i) => i === gi
      ? { ...g, tiers: [...g.tiers, { points: 0, label: '새 등급', certs: [] }] } : g))
  const delTier = (gi: number, ti: number) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, tiers: g.tiers.filter((_, j) => j !== ti) } : g))
  const addGroup = () =>
    setGroups(gs => [...gs, {
      id: `g${Date.now()}`, label: '새 분야', max: 10, mode: 'top1',
      tiers: [{ points: 10, label: '', certs: [] }],
    }])
  const delGroup = (gi: number) => setGroups(gs => gs.filter((_, i) => i !== gi))

  const toggleCert = (gi: number, ti: number, key: string) => {
    const cur = groups[gi].tiers[ti].certs ?? []
    updTier(gi, ti, { certs: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] })
  }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('kp_rubrics').upsert({
      company_id: c.id, groups, memo: memo.trim() || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' })
    setSaving(false)
    if (error) { alert(`저장하지 못했습니다.\n${error.message}`); return }
    onSaved()
  }
  const reset = async () => {
    if (!confirm('기본 배점표로 되돌릴까요?')) return
    await supabase.from('kp_rubrics').delete().eq('company_id', c.id)
    onSaved()
  }

  const num = 'w-12 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded px-1.5 py-1 text-xs text-center outline-none'
  const txt = 'flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded px-2 py-1 text-xs outline-none'

  return (
    <div className="bg-gray-950/60 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
        공고 붙임의 「서류심사 표준배점표」를 보면서 그대로 옮기세요. 분야 · 등급 · 점수를 자유롭게 더하고 뺄 수 있고,
        각 등급에 어떤 자격증이 해당하는지는 <span className="text-gray-400">자격</span> 버튼으로 연결합니다.
        어학 등급은 <span className="text-gray-400">TOEIC 하한</span>만 넣으면 OPIc·TOEFL이 자동 환산돼 매칭됩니다.
      </p>

      {groups.map((g, gi) => (
        <div key={g.id} className="mb-3 pb-3 border-b border-gray-900 last:border-0">
          <div className="flex items-center gap-1.5 mb-2">
            <input value={g.label} onChange={e => upd(gi, { label: e.target.value })} className={txt} />
            <input value={String(g.max)} onChange={e => upd(gi, { max: Number(e.target.value.replace(/\D/g, '') || 0) })} className={num} />
            <button onClick={() => upd(gi, { mode: g.mode === 'top1' ? 'sum' : 'top1' })}
              className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 shrink-0">
              {g.mode === 'top1' ? '최상위1' : '합산'}
            </button>
            <button onClick={() => delGroup(gi)} className="text-[10px] text-gray-700 hover:text-red-400 px-1 shrink-0">✕</button>
          </div>

          {g.tiers.map((t, ti) => {
            const pid = `${gi}-${ti}`
            return (
              <div key={ti} className="mb-1.5">
                <div className="flex items-center gap-1.5">
                  <input value={String(t.points)} onChange={e => updTier(gi, ti, { points: Number(e.target.value.replace(/\D/g, '') || 0) })} className={num} />
                  <input value={t.label} onChange={e => updTier(gi, ti, { label: e.target.value })}
                    placeholder="공고 원문 그대로" className={`${txt} placeholder:text-gray-700`} />
                  <input value={t.toeicMin === undefined ? '' : String(t.toeicMin)}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '')
                      updTier(gi, ti, { toeicMin: v === '' ? undefined : Number(v) })
                    }}
                    placeholder="TOEIC" className={`${num} w-16 placeholder:text-gray-700 text-amber-300`} />
                  <button onClick={() => setPickFor(pickFor === pid ? null : pid)}
                    className={`text-[10px] px-2 py-1 rounded shrink-0 ${(t.certs?.length ?? 0) > 0 ? 'bg-blue-900/60 text-blue-300' : 'bg-gray-800 text-gray-500'}`}>
                    자격 {t.certs?.length ?? 0}
                  </button>
                  <button onClick={() => delTier(gi, ti)} className="text-[10px] text-gray-700 hover:text-red-400 px-1 shrink-0">✕</button>
                </div>
                {pickFor === pid && (
                  <div className="flex flex-wrap gap-1 mt-1.5 p-2 bg-gray-900 rounded-lg">
                    {CERT_CATALOG.filter(x => x.value === 'bool').map(x => (
                      <button key={x.key} onClick={() => toggleCert(gi, ti, x.key)}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          (t.certs ?? []).includes(x.key) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
                        }`}>{x.label}</button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => addTier(gi)}
            className="text-[10px] text-gray-600 hover:text-gray-300 mt-1">+ 등급 추가</button>
        </div>
      ))}

      <button onClick={addGroup}
        className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-600 hover:text-gray-300 rounded-lg py-2 text-[11px] mb-3 transition">
        + 분야 추가
      </button>

      <input value={memo} onChange={e => setMemo(e.target.value)}
        placeholder="공고 회차 · URL 메모"
        className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-xs outline-none mb-3 placeholder:text-gray-700" />

      <div className="flex gap-2">
        <button onClick={reset} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold transition">기본값으로</button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-xs font-bold transition">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  내 스펙
// ═══════════════════════════════════════════════════════════════
function SpecTab({ specs, spec, onSaved }: { specs: SpecRow[]; spec: SpecMap; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const map = useMemo(() => Object.fromEntries(specs.map(s => [s.cert_key, s])), [specs])
  const langs = langSources(spec)

  const toggle = async (c: CertDef) => {
    if (busy) return
    setBusy(true)
    if (map[c.key]?.has) await supabase.from('kp_specs').delete().eq('cert_key', c.key)
    else await supabase.from('kp_specs').upsert(
      { cert_key: c.key, has: true, value: map[c.key]?.value ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'cert_key' })
    setBusy(false); onSaved()
  }
  const setValue = async (c: CertDef, v: string) => {
    await supabase.from('kp_specs').upsert(
      { cert_key: c.key, has: true, value: v || null, updated_at: new Date().toISOString() },
      { onConflict: 'cert_key' })
    onSaved()
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        현실적으로 취득 가능한 것만 남겼습니다. 배점표에만 이름이 나오는 자격증(기술사·기능장 등)은
        기업 탭의 표에는 그대로 보이되 여기서는 체크 대상이 아닙니다.
      </p>

      {langs.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4 mb-5">
          <p className="text-xs text-gray-500 mb-2">외국어 TOEIC 환산 — 가장 높은 것이 반영됩니다</p>
          <div className="space-y-1">
            {langs.map((l, i) => (
              <div key={l.key} className="flex items-baseline gap-2 text-xs">
                <span className={i === 0 ? 'text-white font-bold' : 'text-gray-500'}>{l.label}</span>
                <span className="text-gray-700">→</span>
                <span className={i === 0 ? 'text-blue-400 font-bold' : 'text-gray-600'}>
                  TOEIC {Math.round(l.toeic)}
                </span>
                {!l.official && <span className="text-[9px] text-amber-600">비공식 환산</span>}
                {i === 0 && <span className="ml-auto text-[10px] text-blue-400">반영</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {ALL_KINDS.map(kind => {
        const items = MY_CERTS.filter(c => c.kind === kind)
        if (!items.length) return null
        return (
          <div key={kind} className="mb-5">
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-2">
              {KIND_LABELS[kind as CertKind]}
            </p>
            <div className="space-y-1.5">
              {items.map(c => {
                const row = map[c.key]
                const on = !!row?.has
                return (
                  <div key={c.key}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${on ? 'bg-blue-950/40 border border-blue-900' : 'bg-gray-900 border border-transparent'}`}>
                    <button onClick={() => toggle(c)} disabled={busy}
                      className={`w-5 h-5 rounded shrink-0 text-[11px] font-bold transition ${on ? 'bg-blue-600 text-white' : 'bg-gray-800 text-transparent'}`}>✓</button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] leading-tight truncate ${on ? 'font-semibold' : 'text-gray-400'}`}>{c.label}</p>
                      {c.hint && <p className="text-[10px] text-gray-600 truncate">{c.hint}</p>}
                    </div>
                    {on && c.value === 'score' && (
                      <input inputMode="numeric" defaultValue={row?.value ?? ''}
                        onBlur={e => setValue(c, e.target.value.replace(/\D/g, ''))}
                        placeholder="점수"
                        className="w-20 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded px-2 py-1 text-xs text-center outline-none shrink-0 placeholder:text-gray-700" />
                    )}
                    {c.value === 'grade' && (
                      <select value={row?.value ?? ''} onChange={e => setValue(c, e.target.value)}
                        className={`w-28 bg-gray-950 border rounded px-1 py-1 text-xs outline-none shrink-0 transition ${
                          on && row?.value ? 'border-blue-800 text-white' : 'border-gray-800 text-gray-500'
                        }`}>
                        <option value="">급수 선택</option>
                        {(c.grades ?? []).map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  자기소개서
// ═══════════════════════════════════════════════════════════════
function EssayTab({ essays, companies, onSaved }: { essays: EssayRow[]; companies: Company[]; onSaved: () => void }) {
  const [cid, setCid] = useState(companies[0]?.id ?? '')
  const rows = essays.filter(e => e.company_id === cid)
  const c = companies.find(x => x.id === cid)
  if (!c) return <p className="text-gray-600 text-sm text-center py-10">기업을 먼저 추가하세요.</p>

  const seed = async () => {
    const prompts = c.essayPrompts ?? []
    if (!prompts.length) return
    await supabase.from('kp_essays').insert(prompts.map((p, i) => ({
      company_id: cid, idx: i + 1, prompt: p, min_chars: 500, max_chars: 1000,
    })))
    onSaved()
  }
  const addBlank = async () => {
    await supabase.from('kp_essays').insert({
      company_id: cid, idx: rows.length + 1, prompt: '', min_chars: 500, max_chars: 1000,
    })
    onSaved()
  }

  return (
    <div>
      <select value={cid} onChange={e => setCid(e.target.value)}
        className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-xl px-3 py-2.5 text-sm outline-none transition mb-4">
        {companies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>

      {rows.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-600 text-sm mb-4">{c.short} 문항이 아직 없습니다.</p>
          <div className="flex gap-2 justify-center">
            {(c.essayPrompts?.length ?? 0) > 0 && (
              <button onClick={seed}
                className="px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-sm font-bold transition">
                공고 문항 {c.essayPrompts!.length}개 불러오기
              </button>
            )}
            <button onClick={addBlank}
              className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">
              빈 문항 추가
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {rows.map(e => <EssayCard key={e.id} row={e} onSaved={onSaved} />)}
          </div>
          <button onClick={addBlank}
            className="w-full mt-4 border border-dashed border-gray-800 hover:border-gray-600 text-gray-600 hover:text-gray-300 rounded-xl py-3 text-sm transition">
            + 문항 추가
          </button>
        </>
      )}
    </div>
  )
}

function EssayCard({ row, onSaved }: { row: EssayRow; onSaved: () => void }) {
  const [prompt, setPrompt] = useState(row.prompt)
  const [body, setBody] = useState(row.body ?? '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const min = row.min_chars ?? 0, max = row.max_chars ?? 0
  const len = body.length
  const ok = len >= min && (max === 0 || len <= max)

  const save = async () => {
    setSaving(true)
    await supabase.from('kp_essays')
      .update({ prompt, body, updated_at: new Date().toISOString() }).eq('id', row.id)
    setSaving(false); setDirty(false); onSaved()
  }
  const remove = async () => {
    if (!confirm('이 문항을 지울까요?')) return
    await supabase.from('kp_essays').delete().eq('id', row.id)
    onSaved()
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs font-bold text-blue-400 shrink-0 mt-2">{row.idx}</span>
        <textarea value={prompt} rows={2}
          onChange={e => { setPrompt(e.target.value); setDirty(true) }}
          placeholder="문항 원문을 붙여넣으세요"
          className="flex-1 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-xs leading-relaxed outline-none transition resize-y placeholder:text-gray-700" />
        <button onClick={remove} className="text-[11px] text-gray-700 hover:text-red-400 px-1 shrink-0 mt-2">✕</button>
      </div>

      <textarea value={body} rows={8}
        onChange={e => { setBody(e.target.value); setDirty(true) }}
        placeholder="답안"
        className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm leading-relaxed outline-none transition resize-y placeholder:text-gray-700 mb-2" />

      <div className="flex items-center gap-3">
        <span className={`text-[11px] ${ok ? 'text-green-400' : len === 0 ? 'text-gray-600' : 'text-amber-400'}`}>
          {len}자 {min > 0 && `· ${min}~${max}자`}
        </span>
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${ok ? 'bg-green-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min((len / (max || 1000)) * 100, 100)}%` }} />
        </div>
        {dirty && (
          <button onClick={save} disabled={saving}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 font-bold transition shrink-0">
            {saving ? '저장 중' : '저장'}
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  모의고사
// ═══════════════════════════════════════════════════════════════
type Cell = { got: string; total: string }
type Draft = { company_id: string; title: string; taken_on: string; nums: Record<string, Cell> }

const emptyDraft = (): Draft => ({
  company_id: '', title: '', taken_on: new Date().toISOString().slice(0, 10),
  nums: Object.fromEntries(MOCK_PARTS.map(p => [p.key, { got: '', total: '' }])),
})

function MocksTab({ mocks, onSaved }: { mocks: MockRow[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)

  const setNum = (k: string, f: keyof Cell, v: string) =>
    setDraft(d => ({ ...d, nums: { ...d.nums, [k]: { ...d.nums[k], [f]: v.replace(/\D/g, '') } } }))
  const close = () => { setOpen(false); setEditingId(null); setDraft(emptyDraft()) }

  const startEdit = (m: MockRow) => {
    setEditingId(m.id); setOpen(true)
    setDraft({
      company_id: m.company_id ?? '', title: m.title, taken_on: m.taken_on,
      nums: Object.fromEntries(MOCK_PARTS.map(p => {
        const g = m[p.key as 'ncs'] as number | null
        const t = m[`${p.key}_total` as 'ncs_total'] as number | null
        return [p.key, { got: g === null ? '' : String(g), total: t === null ? '' : String(t) }]
      })),
    })
  }

  const canSave = draft.title.trim().length > 0 &&
    MOCK_PARTS.some(p => draft.nums[p.key].got !== '' && Number(draft.nums[p.key].total) > 0)

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      company_id: draft.company_id || null, title: draft.title.trim(), taken_on: draft.taken_on,
    }
    MOCK_PARTS.forEach(p => {
      const c = draft.nums[p.key]
      payload[p.key] = c.got === '' ? null : Number(c.got)
      payload[`${p.key}_total`] = c.total === '' ? null : Number(c.total)
    })
    const { error } = editingId
      ? await supabase.from('kp_mocks').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      : await supabase.from('kp_mocks').insert(payload)
    setSaving(false)
    if (error) { alert(`저장하지 못했습니다.\n${error.message}`); return }
    close(); onSaved()
  }

  const remove = async (m: MockRow) => {
    if (!confirm(`"${m.title}" 기록을 지울까요?`)) return
    await supabase.from('kp_mocks').delete().eq('id', m.id)
    if (editingId === m.id) close()
    onSaved()
  }

  const avg = MOCK_PARTS.map(p => {
    const vs = mocks.map(m => ({ g: m[p.key as 'ncs'], t: m[`${p.key}_total` as 'ncs_total'] }))
      .filter(v => v.g !== null && v.t)
    return { ...p, avg: vs.length ? vs.reduce((a, v) => a + pct(v.g!, v.t!), 0) / vs.length : null, n: vs.length }
  })

  const inp = 'w-16 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center outline-none transition'

  return (
    <div>
      {mocks.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-5 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{mocks.length}회 · 파트별 평균</p>
          <div className="space-y-2.5">
            {avg.map(a => (
              <div key={a.key} className="flex items-center gap-3">
                <span className="w-24 text-[11px] text-gray-500 shrink-0">{a.label}</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.avg ?? 0}%`, backgroundColor: a.color }} />
                </div>
                <span className="w-16 text-right text-[11px] text-gray-400 shrink-0">
                  {a.avg === null ? '—' : `${Math.round(a.avg)}% (${a.n})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3.5 text-sm font-semibold transition mb-5">
          + 모의고사 결과 추가
        </button>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-5 mb-5 border border-gray-800">
          <div className="flex gap-2 mb-3">
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="교재명 + 회차"
              className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700" />
            <input type="date" value={draft.taken_on}
              onChange={e => setDraft(d => ({ ...d, taken_on: e.target.value }))}
              className="bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-2 text-sm outline-none transition shrink-0" />
          </div>
          <select value={draft.company_id} onChange={e => setDraft(d => ({ ...d, company_id: e.target.value }))}
            className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-xs outline-none transition mb-3">
            <option value="">기업 지정 안 함</option>
            {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="space-y-2 mb-4">
            {MOCK_PARTS.map(p => {
              const c = draft.nums[p.key]
              const g = Number(c.got || 0), t = Number(c.total || 0)
              return (
                <div key={p.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <span className="text-xs" style={{ color: p.color }}>{p.label}</span>
                  <input inputMode="numeric" value={c.got} placeholder="—"
                    onChange={e => setNum(p.key, 'got', e.target.value)} className={inp} />
                  <input inputMode="numeric" value={c.total} placeholder="—"
                    onChange={e => setNum(p.key, 'total', e.target.value)} className={`${inp} text-gray-400`} />
                  <span className="w-10 text-right text-xs text-gray-500">
                    {t > 0 && c.got !== '' ? `${Math.round(pct(g, t))}%` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={close} className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">취소</button>
            <button onClick={save} disabled={!canSave || saving}
              className="flex-1 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
              {saving ? '저장 중...' : editingId ? '수정 저장' : '저장'}
            </button>
          </div>
        </div>
      )}

      {mocks.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-10">아직 기록이 없어요.</p>
      ) : (
        <div className="space-y-3">
          {mocks.map(m => {
            const co = COMPANIES.find(c => c.id === m.company_id)
            return (
              <div key={m.id} className={`bg-gray-900 rounded-2xl p-5 ${editingId === m.id ? 'ring-1 ring-blue-700' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{m.title}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">{m.taken_on}{co && ` · ${co.short}`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(m)} className="text-[11px] text-gray-600 hover:text-blue-400 transition">수정</button>
                    <button onClick={() => remove(m)} className="text-[11px] px-1.5 py-0.5 rounded text-gray-600 hover:text-white hover:bg-red-800 transition">삭제</button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {MOCK_PARTS.map(p => {
                    const got = m[p.key as 'ncs'] as number | null
                    const total = m[`${p.key}_total` as 'ncs_total'] as number | null
                    if (got === null || !total) return null
                    const v = pct(got, total)
                    return (
                      <div key={p.key} className="flex items-center gap-2">
                        <span className="w-20 text-[10px] text-gray-500 shrink-0">{p.label}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: p.color }} />
                        </div>
                        <span className="w-20 text-right text-[10px] text-gray-500 shrink-0">
                          {got}/{total} · {Math.round(v)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
