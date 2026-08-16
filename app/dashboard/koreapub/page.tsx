'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  CertDef, CertKind, ALL_KINDS, KIND_LABELS, CERT_CATALOG, certLabel,
  Company, RuleGroup, COMPANIES,
  SpecRow, SpecMap, toSpecMap, scoreCompany, CompanyResult,
  MockRow, MOCK_PARTS, pct,
} from '@/lib/constants-koreapub'

// ───────────────────────────────────────────────────────────────
//  한국 공기업 채용 준비
//    기업   내 스펙으로 기업별 가점이 몇 점 나오는지 · 뭘 더 따면 오르는지
//    내 스펙 보유 자격증 · 어학 체크
//    모의고사 NCS / 전공 / 법령 성적 로깅
//
//  배점은 lib/constants-koreapub.ts 의 기본값에서 출발하고,
//  공고를 보고 고친 값은 kp_rubrics 에 저장되어 그쪽이 우선한다.
// ───────────────────────────────────────────────────────────────

type Tab = 'companies' | 'spec' | 'mocks'

interface RubricRow { company_id: string; bonus_max: number | null; groups: RuleGroup[]; memo: string | null }

export default function KoreaPubPage() {
  const [tab, setTab] = useState<Tab>('companies')
  const [specs, setSpecs] = useState<SpecRow[]>([])
  const [rubrics, setRubrics] = useState<RubricRow[]>([])
  const [mocks, setMocks] = useState<MockRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: sp }, { data: rb }, { data: mk }] = await Promise.all([
      supabase.from('kp_specs').select('cert_key, has, value'),
      supabase.from('kp_rubrics').select('company_id, bonus_max, groups, memo'),
      supabase.from('kp_mocks').select('*').order('taken_on', { ascending: false }),
    ])
    setSpecs((sp as SpecRow[]) || [])
    setRubrics((rb as RubricRow[]) || [])
    setMocks((mk as MockRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const spec: SpecMap = useMemo(() => toSpecMap(specs), [specs])

  /** 기본 정의 + kp_rubrics 덮어쓰기 */
  const companies: Company[] = useMemo(() => COMPANIES.map(c => {
    const r = rubrics.find(x => x.company_id === c.id)
    return r ? { ...c, bonusMax: r.bonus_max ?? c.bonusMax, groups: r.groups } : c
  }), [rubrics])

  const results: CompanyResult[] = useMemo(
    () => companies.map(c => scoreCompany(c, spec)),
    [companies, spec],
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏛</span>
          <h1 className="text-2xl font-bold">한국 공기업 전기직</h1>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          기업별 가점 구조 · 내 스펙 서류점수 · NCS / 전공 모의고사
        </p>

        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-5">
          {([
            { key: 'companies', label: `🏢 기업 ${companies.length}` },
            { key: 'spec', label: `🎫 내 스펙 ${Object.keys(spec).length}` },
            { key: 'mocks', label: `📊 모의고사 ${mocks.length}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                tab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {loading && <p className="text-gray-500 text-sm">불러오는 중...</p>}

        {!loading && tab === 'companies' && (
          <CompaniesTab results={results} spec={spec} onSaved={fetchAll}
            rubrics={rubrics} />
        )}
        {!loading && tab === 'spec' && <SpecTab specs={specs} onSaved={fetchAll} />}
        {!loading && tab === 'mocks' && <MocksTab mocks={mocks} onSaved={fetchAll} />}

      </div>
    </main>
  )
}

// ═══════════════════════════════════════════════════════════════
//  기업 탭
// ═══════════════════════════════════════════════════════════════
function CompaniesTab({ results, spec, rubrics, onSaved }: {
  results: CompanyResult[]; spec: SpecMap; rubrics: RubricRow[]; onSaved: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const targets = results.filter(r => r.company.target)
  const refs = results.filter(r => !r.company.target)

  const specCount = Object.keys(spec).length

  return (
    <div>
      {specCount === 0 && (
        <div className="bg-amber-950/40 border border-amber-900 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-amber-300 mb-1">먼저 내 스펙을 넣어주세요</p>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            「내 스펙」 탭에서 보유 자격증을 체크하면, 기업마다 서류 가점이 몇 점 나오는지
            자동으로 계산됩니다.
          </p>
        </div>
      )}

      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">🎯 주 타깃</p>
      <div className="space-y-3 mb-8">
        {targets.map(r => (
          <CompanyCard key={r.company.id} r={r} open={openId === r.company.id}
            onToggle={() => setOpenId(openId === r.company.id ? null : r.company.id)}
            spec={spec} rubric={rubrics.find(x => x.company_id === r.company.id)} onSaved={onSaved} />
        ))}
      </div>

      <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">
        📐 레퍼런스 <span className="text-gray-700 normal-case tracking-normal">기준선을 잡기 위한 곳들</span>
      </p>
      <div className="space-y-3">
        {refs.map(r => (
          <CompanyCard key={r.company.id} r={r} open={openId === r.company.id}
            onToggle={() => setOpenId(openId === r.company.id ? null : r.company.id)}
            spec={spec} rubric={rubrics.find(x => x.company_id === r.company.id)} onSaved={onSaved} />
        ))}
      </div>

      <p className="text-[10px] text-gray-700 mt-6 leading-relaxed">
        여기 배점은 과거 공고와 공개 자료를 모은 출발점입니다. 공기업 가점 구조는 회차·직렬마다
        바뀌므로, 실제 지원 전에는 각 기업 카드의 「배점 편집」에서 그 회차 공고 값으로 덮어쓰세요.
      </p>
    </div>
  )
}

function CompanyCard({ r, open, onToggle, spec, rubric, onSaved }: {
  r: CompanyResult; open: boolean; onToggle: () => void
  spec: SpecMap; rubric?: RubricRow; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const c = r.company
  const p = r.max === 0 ? 0 : (r.earned / r.max) * 100

  return (
    <div className={`bg-gray-900 rounded-2xl transition ${open ? 'ring-1 ring-blue-900' : ''}`}>
      <button onClick={onToggle} className="w-full text-left p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-bold text-sm">
              {c.name} <span className="text-gray-600 font-normal">{c.short}</span>
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5">{c.sector} · {c.season}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-blue-400 leading-none">
              {r.earned}<span className="text-xs text-gray-600">/{r.max}</span>
            </p>
            <p className="text-[10px] text-gray-600 mt-1">가점 예상</p>
          </div>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${p}%` }} />
        </div>
        {r.upside.length > 0 && (
          <p className="text-[11px] text-gray-500 mt-2">
            {r.upside.slice(0, 2).map(u => (
              <span key={u.cert} className="mr-3">
                <span className="text-amber-400">+{u.gain}</span> {certLabel(u.cert)}
              </span>
            ))}
          </p>
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4">
          {/* 필기 */}
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">필기</p>
          <div className="space-y-1 mb-3">
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
          <p className="text-[11px] text-gray-500 mb-1">총점 {c.exam.total}</p>
          <p className="text-[11px] text-red-400/80 mb-4">과락 {c.exam.cutoff}</p>

          {/* 자격 요건 */}
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">지원 자격 (문턱)</p>
          <ul className="space-y-1 mb-4">
            {c.eligibility.map((e, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-2">
                <span className="text-gray-700">·</span>{e}
              </li>
            ))}
          </ul>

          {/* 가점표 */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">가점 구조</p>
            <button onClick={() => setEditing(v => !v)}
              className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition">
              {editing ? '편집 닫기' : '✎ 배점 편집'}
            </button>
          </div>

          {editing ? (
            <RubricEditor c={c} rubric={rubric} onSaved={() => { setEditing(false); onSaved() }} />
          ) : (
            <div className="space-y-3">
              {r.groups.map(g => (
                <div key={g.group.id}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-bold text-gray-300">
                      {g.group.label}
                      <span className="text-[10px] text-gray-600 font-normal ml-1.5">
                        최대 {g.group.max} · {g.group.pick}개 인정
                      </span>
                    </span>
                    <span className={`text-xs font-bold ${g.earned > 0 ? 'text-blue-400' : 'text-gray-700'}`}>
                      {g.earned}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.group.options.map(o => {
                      const owned = !!spec[o.cert]
                      const used = g.used.includes(o)
                      return (
                        <span key={o.cert}
                          className={`text-[11px] px-2 py-1 rounded-lg ${
                            used ? 'bg-blue-600/30 text-blue-300 font-bold'
                              : owned ? 'bg-gray-800 text-gray-400'
                                : 'bg-gray-950 text-gray-600'
                          }`}
                          title={o.cond}>
                          {certLabel(o.cert)} <span className="opacity-70">{o.points}</span>
                          {owned && !used && <span className="text-[9px] ml-1 opacity-60">보유·미반영</span>}
                        </span>
                      )
                    })}
                  </div>
                  {g.group.note && (
                    <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">{g.group.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 다음 한 수 */}
          {r.upside.length > 0 && !editing && (
            <div className="mt-4 pt-3 border-t border-gray-800">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">
                지금 더 따면
              </p>
              <div className="space-y-1">
                {r.upside.map(u => (
                  <div key={u.cert} className="flex items-baseline justify-between text-xs">
                    <span className="text-gray-300">{certLabel(u.cert)}</span>
                    <span className="text-amber-400 font-bold">+{u.gain}점</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-700 mt-4 leading-relaxed border-t border-gray-800 pt-3">
            ⚠ {c.verified}
          </p>
          {rubric?.memo && (
            <p className="text-[10px] text-blue-400/70 mt-1">📌 {rubric.memo}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── 배점 편집 ────────────────────────────────────────────────────
function RubricEditor({ c, rubric, onSaved }: {
  c: Company; rubric?: RubricRow; onSaved: () => void
}) {
  const [groups, setGroups] = useState<RuleGroup[]>(() => JSON.parse(JSON.stringify(c.groups)))
  const [bonusMax, setBonusMax] = useState(String(c.bonusMax))
  const [memo, setMemo] = useState(rubric?.memo ?? '')
  const [saving, setSaving] = useState(false)

  const setOpt = (gi: number, oi: number, v: string) => {
    const n = [...groups]
    n[gi] = { ...n[gi], options: n[gi].options.map((o, i) => i === oi ? { ...o, points: Number(v || 0) } : o) }
    setGroups(n)
  }
  const setG = (gi: number, k: 'max' | 'pick', v: string) => {
    const n = [...groups]
    n[gi] = { ...n[gi], [k]: Number(v || 0) }
    setGroups(n)
  }

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('kp_rubrics').upsert({
      company_id: c.id,
      bonus_max: Number(bonusMax || 0),
      groups,
      memo: memo.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' })
    setSaving(false)
    if (error) { alert(`저장하지 못했습니다.\n${error.message}`); return }
    onSaved()
  }

  const reset = async () => {
    if (!confirm('기본 배점으로 되돌릴까요?')) return
    await supabase.from('kp_rubrics').delete().eq('company_id', c.id)
    onSaved()
  }

  const num = 'w-14 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded px-2 py-1 text-xs text-center outline-none transition'

  return (
    <div className="bg-gray-950/60 rounded-xl p-3">
      <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
        공고 원문을 보면서 숫자를 고치세요. 저장하면 이 기업만 여기 값으로 계산됩니다.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-400 flex-1">가점 총 상한</span>
        <input value={bonusMax} onChange={e => setBonusMax(e.target.value.replace(/\D/g, ''))} className={num} />
      </div>

      {groups.map((g, gi) => (
        <div key={g.id} className="mb-3 pb-3 border-b border-gray-900 last:border-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-gray-300 flex-1 truncate">{g.label}</span>
            <span className="text-[10px] text-gray-600">최대</span>
            <input value={String(g.max)} onChange={e => setG(gi, 'max', e.target.value.replace(/\D/g, ''))} className={num} />
            <span className="text-[10px] text-gray-600">개수</span>
            <input value={String(g.pick)} onChange={e => setG(gi, 'pick', e.target.value.replace(/\D/g, ''))} className={num} />
          </div>
          <div className="space-y-1">
            {g.options.map((o, oi) => (
              <div key={o.cert} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 flex-1 truncate">
                  {certLabel(o.cert)}
                  {o.cond && <span className="text-gray-700 ml-1">{o.cond}</span>}
                </span>
                <input value={String(o.points)} onChange={e => setOpt(gi, oi, e.target.value.replace(/\D/g, ''))} className={num} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <input value={memo} onChange={e => setMemo(e.target.value)}
        placeholder="공고 회차 · URL 메모"
        className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-xs outline-none transition mb-3 placeholder:text-gray-700" />

      <div className="flex gap-2">
        <button onClick={reset}
          className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold transition">
          기본값으로
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-xs font-bold transition">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  내 스펙 탭
// ═══════════════════════════════════════════════════════════════
function SpecTab({ specs, onSaved }: { specs: SpecRow[]; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const map = useMemo(() => Object.fromEntries(specs.map(s => [s.cert_key, s])), [specs])

  const toggle = async (c: CertDef) => {
    if (busy) return
    setBusy(true)
    const cur = map[c.key]
    if (cur?.has) await supabase.from('kp_specs').delete().eq('cert_key', c.key)
    else await supabase.from('kp_specs').upsert(
      { cert_key: c.key, has: true, value: cur?.value ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'cert_key' },
    )
    setBusy(false)
    onSaved()
  }

  const setValue = async (c: CertDef, v: string) => {
    await supabase.from('kp_specs').upsert(
      { cert_key: c.key, has: true, value: v || null, updated_at: new Date().toISOString() },
      { onConflict: 'cert_key' },
    )
    onSaved()
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        가진 것만 켜면 됩니다. 기업 탭의 점수가 즉시 다시 계산됩니다.
        어학·한국사처럼 급수가 있는 항목은 값도 적어두면 나중에 공고 요건과 대조하기 쉽습니다.
      </p>
      {ALL_KINDS.map(kind => (
        <div key={kind} className="mb-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-2">
            {KIND_LABELS[kind as CertKind]}
          </p>
          <div className="space-y-1.5">
            {CERT_CATALOG.filter(c => c.kind === kind).map(c => {
              const row = map[c.key]
              const on = !!row?.has
              return (
                <div key={c.key}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${on ? 'bg-blue-950/40 border border-blue-900' : 'bg-gray-900 border border-transparent'}`}>
                  <button onClick={() => toggle(c)} disabled={busy}
                    className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-[11px] font-bold transition ${
                      on ? 'bg-blue-600 text-white' : 'bg-gray-800 text-transparent'
                    }`}>✓</button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] leading-tight truncate ${on ? 'font-semibold' : 'text-gray-400'}`}>
                      {c.label}
                    </p>
                    {c.hint && <p className="text-[10px] text-gray-600 truncate">{c.hint}</p>}
                  </div>
                  {on && c.value !== 'bool' && (
                    <input
                      defaultValue={row?.value ?? ''}
                      onBlur={e => setValue(c, e.target.value.trim())}
                      placeholder={c.value === 'score' ? '점수' : '급수'}
                      className="w-20 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded px-2 py-1 text-xs text-center outline-none transition shrink-0 placeholder:text-gray-700"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  모의고사 탭
// ═══════════════════════════════════════════════════════════════
type Cell = { got: string; total: string }
type Draft = { company_id: string; title: string; taken_on: string; nums: Record<string, Cell> }

const emptyDraft = (): Draft => ({
  company_id: '',
  title: '',
  taken_on: new Date().toISOString().slice(0, 10),
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
      company_id: m.company_id ?? '',
      title: m.title,
      taken_on: m.taken_on,
      nums: Object.fromEntries(MOCK_PARTS.map(p => {
        const got = m[p.key as 'ncs'] as number | null
        const total = m[`${p.key}_total` as 'ncs_total'] as number | null
        return [p.key, { got: got === null ? '' : String(got), total: total === null ? '' : String(total) }]
      })),
    })
  }

  const filled = MOCK_PARTS.filter(p => draft.nums[p.key].got !== '' && Number(draft.nums[p.key].total) > 0)
  const canSave = draft.title.trim().length > 0 && filled.length > 0

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      company_id: draft.company_id || null,
      title: draft.title.trim(),
      taken_on: draft.taken_on,
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

  // 파트별 평균
  const avg = MOCK_PARTS.map(p => {
    const vs = mocks
      .map(m => ({ g: m[p.key as 'ncs'], t: m[`${p.key}_total` as 'ncs_total'] }))
      .filter(v => v.g !== null && v.t)
    return { ...p, avg: vs.length ? vs.reduce((a, v) => a + pct(v.g!, v.t!), 0) / vs.length : null, n: vs.length }
  })

  const inp = 'w-16 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center outline-none transition'

  return (
    <div>
      {mocks.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-5 mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
            {mocks.length}회 · 파트별 평균 정답률
          </p>
          <div className="space-y-2.5">
            {avg.map(a => (
              <div key={a.key} className="flex items-center gap-3">
                <span className="w-24 text-[11px] text-gray-500 shrink-0">{a.label}</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${a.avg ?? 0}%`, backgroundColor: a.color }} />
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
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
            {editingId ? '기록 수정' : '모의고사 결과 추가'}
          </p>
          <div className="flex gap-2 mb-3">
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder="교재명 + 회차 (예: 해커스 NCS 3회)"
              className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700" />
            <input type="date" value={draft.taken_on}
              onChange={e => setDraft(d => ({ ...d, taken_on: e.target.value }))}
              className="bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-2 text-sm outline-none transition shrink-0" />
          </div>

          <select value={draft.company_id} onChange={e => setDraft(d => ({ ...d, company_id: e.target.value }))}
            className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-xs outline-none transition mb-3">
            <option value="">기업 지정 안 함 (일반 교재)</option>
            {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] text-gray-600 font-bold px-1">
              <span>파트</span><span className="w-16 text-center">정답</span>
              <span className="w-16 text-center">문항</span><span className="w-10 text-right">%</span>
            </div>
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
          <p className="text-[10px] text-gray-600 mb-3">안 본 파트는 비워두면 됩니다.</p>

          <div className="flex gap-2">
            <button onClick={close}
              className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">취소</button>
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
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {m.taken_on}{co && ` · ${co.short}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(m)} className="text-[11px] px-1.5 py-0.5 rounded text-gray-600 hover:text-blue-400 transition">수정</button>
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
