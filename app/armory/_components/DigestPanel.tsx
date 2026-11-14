'use client'

import { useState } from 'react'
import { DIGEST_CHECKS, RELEASE_FORMS } from '@/lib/constants-armory'
import {
  addRelease, deleteRelease, digestState, setDigest, stageOf, today, STAGE_META, type Revision,
} from '@/lib/armory'

// 소화 → 출고
// -------------------------------------------------------------------
//   [소화 체크 7칸] ── 다 채우면 ──▶ [출고 버튼 열림] ──▶ 출고 대장에 한 줄
//   체크는 '내가 이걸 내 말로 설명할 수 있고, 내보내도 탈이 없다'는 자기 확인.
//   📐 노트 칸은 파일이 올라가 있으면 자동으로 켜진다.

export default function DigestPanel({ rev }: { rev: Revision }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ releasedOn: today(), target: '', form: RELEASE_FORMS[0], memo: '' })

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(String((e as { message?: string })?.message ?? e)) } finally { setBusy(false) }
  }

  if (rev.keep === 'company') {
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
        🏢 회사 보관 리비전 — 이미 회사 쪽 물건이라 소화·출고 줄에 서지 않아요.
        <p className="text-[11px] text-gray-600 mt-1">공개 자료·예시값으로 다시 만든 집 원본이 생기면, 그걸 새 리비전으로 입고하세요.</p>
      </div>
    )
  }

  const d = digestState(rev)
  const st = STAGE_META[stageOf(rev)]

  return (
    <div className="space-y-5">
      {/* 소화 체크 */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-sm font-bold flex-1">🍽 소화 체크</p>
          <span className="text-[11px] font-semibold" style={{ color: st.color }}>{st.label}</span>
          <span className="text-[11px] text-gray-500 tabular-nums">{d.done}/{d.total}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-800 mb-3 overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(d.done / d.total) * 100}%` }} />
        </div>
        <ul className="space-y-2">
          {DIGEST_CHECKS.map(c => {
            const on = c.auto === 'note' ? !!rev.note_path : !!rev.digest?.[c.key]
            return (
              <li key={c.key}>
                <label className={`flex gap-2.5 items-start ${c.auto ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={on} disabled={busy || !!c.auto}
                    onChange={e => run(() => setDigest(rev, c.key, e.target.checked))}
                    className="mt-0.5 accent-emerald-500 w-4 h-4 shrink-0" />
                  <span>
                    <span className={`text-[13px] ${on ? 'text-gray-200' : 'text-gray-400'}`}>{c.label}</span>
                    {c.auto && <span className="text-[10px] text-gray-600"> (자동)</span>}
                    <span className="block text-[11px] text-gray-600 leading-snug">{c.hint}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 출고 */}
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-bold flex-1">🚚 출고</p>
          <button onClick={() => setOpen(v => !v)} disabled={!d.all || busy}
            title={d.all ? '' : '소화 체크를 다 채우면 열려요'}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg px-3 py-1.5 font-semibold">
            {d.all ? (open ? '접기' : '+ 출고 기록') : `🔒 소화 ${d.done}/${d.total}`}
          </button>
        </div>
        {open && d.all && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="text-[11px] text-gray-500">날짜
              <input type="date" value={form.releasedOn} onChange={e => setForm(f => ({ ...f, releasedOn: e.target.value }))}
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white" />
            </label>
            <label className="text-[11px] text-gray-500">형태
              <input value={form.form} list="arm-release-forms" onChange={e => setForm(f => ({ ...f, form: e.target.value }))}
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white" />
              <datalist id="arm-release-forms">{RELEASE_FORMS.map(x => <option key={x} value={x} />)}</datalist>
            </label>
            <label className="col-span-2 text-[11px] text-gray-500">받는 곳
              <input value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                placeholder="예) 동욱 님 / 에너지기술부 공유드라이브 / 주간회의 시연"
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white" />
            </label>
            <label className="col-span-2 text-[11px] text-gray-500">메모
              <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="예) 설명 모드만 시연, 소스는 안 넘김"
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white" />
            </label>
            <div className="col-span-2 flex justify-end">
              <button disabled={busy || !form.target.trim() || !form.form.trim()}
                onClick={() => run(async () => { await addRelease(rev, form); setOpen(false); setForm(f => ({ ...f, target: '', memo: '' })) })}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg px-3 py-1.5 font-semibold">
                출고 대장에 기록
              </button>
            </div>
          </div>
        )}
        {rev.releases.length === 0 ? (
          <p className="text-[11px] text-gray-600">{d.all ? '아직 내보낸 적 없어요. 출고 대기 중.' : '소화가 끝나면 출고할 수 있어요.'}</p>
        ) : (
          <ul className="space-y-1">
            {rev.releases.map(r => (
              <li key={r.id} className="flex items-baseline gap-2 text-xs text-gray-300">
                <span className="text-gray-500 tabular-nums shrink-0">{r.released_on}</span>
                <span className="truncate">→ {r.target}</span>
                <span className="text-gray-500 shrink-0">· {r.form}</span>
                {r.memo && <span className="text-gray-600 truncate">· {r.memo}</span>}
                <button onClick={() => { if (confirm('이 출고 기록을 지울까요?')) run(() => deleteRelease(r.id)) }}
                  className="ml-auto text-gray-600 hover:text-red-400 shrink-0">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}
