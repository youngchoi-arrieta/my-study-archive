'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── 해커스 JLPT N4 한권으로 합격 — 실제 목차 ────────────────────
// 파트 구분: 기초학습 / 문자어휘 / 문법 / 독해 / 청해
// 진도 단위: 각 문제유형(문제1~) 및 문법 소항목(01~11)

export type N4Section = {
  id: string
  part: '기초' | '문자·어휘' | '문법' | '독해' | '청해'
  title: string
  page: number
}

export const N4_TOC: N4Section[] = [
  // 기초 학습
  { id: 'b-1', part: '기초', title: '일본어 문자 익히기', page: 24 },
  { id: 'b-2', part: '기초', title: '기초 단어 익히기',   page: 28 },
  { id: 'b-3', part: '기초', title: '기초 문법 익히기',   page: 30 },

  // 언어지식 문자·어휘
  { id: 'v-1', part: '문자·어휘', title: '문제1 한자 읽기', page: 38 },
  { id: 'v-2', part: '문자·어휘', title: '문제2 표기',       page: 60 },
  { id: 'v-3', part: '문자·어휘', title: '문제3 문맥 규정', page: 80 },
  { id: 'v-4', part: '문자·어휘', title: '문제4 유의 표현', page: 102 },
  { id: 'v-5', part: '문자·어휘', title: '문제5 용법',       page: 118 },

  // 언어지식 문법 — N4 필수 문법 소항목
  { id: 'g-01', part: '문법', title: '01 조사',                   page: 139 },
  { id: 'g-02', part: '문법', title: '02 부사',                   page: 139 },
  { id: 'g-03', part: '문법', title: '03 접속사',                 page: 139 },
  { id: 'g-04', part: '문법', title: '04 추측·전언 표현',         page: 139 },
  { id: 'g-05', part: '문법', title: '05 수수 표현',              page: 139 },
  { id: 'g-06', part: '문법', title: '06 수동·사역·사역수동 표현', page: 139 },
  { id: 'g-07', part: '문법', title: '07 가능 표현',              page: 139 },
  { id: 'g-08', part: '문법', title: '08 경어 표현',              page: 139 },
  { id: 'g-09', part: '문법', title: '09 명사 뒤에 접속하는 문형', page: 139 },
  { id: 'g-10', part: '문법', title: '10 동사 뒤에 접속하는 문형', page: 139 },
  { id: 'g-11', part: '문법', title: '11 여러 품사 뒤에 접속하는 문형', page: 139 },
  // 문법 문제유형
  { id: 'g-q1', part: '문법', title: '문제1 문법형식 판단', page: 186 },
  { id: 'g-q2', part: '문법', title: '문제2 문장 만들기', page: 200 },
  { id: 'g-q3', part: '문법', title: '문제3 글의 문법',   page: 210 },

  // 독해
  { id: 'r-4', part: '독해', title: '문제4 내용이해(단문)', page: 228 },
  { id: 'r-5', part: '독해', title: '문제5 내용이해(중문)', page: 246 },
  { id: 'r-6', part: '독해', title: '문제6 정보 검색',     page: 260 },

  // 청해
  { id: 'l-1', part: '청해', title: '문제1 과제 이해',   page: 276 },
  { id: 'l-2', part: '청해', title: '문제2 포인트 이해', page: 298 },
  { id: 'l-3', part: '청해', title: '문제3 발화 표현',   page: 310 },
  { id: 'l-4', part: '청해', title: '문제4 즉시 응답',   page: 326 },
]

// ── 파트 메타 ────────────────────────────────────────────────────
const PARTS = ['기초', '문자·어휘', '문법', '독해', '청해'] as const
type Part = typeof PARTS[number]

const PART_COLOR: Record<Part, string> = {
  '기초':      '#6b7280',
  '문자·어휘': '#2563eb',
  '문법':      '#7c3aed',
  '독해':      '#059669',
  '청해':      '#b45309',
}

// 매일 반복 파트 (스트릭 대상)
const DAILY_PARTS: Part[] = ['청해', '문자·어휘']

// ── 쓰면서 익히는 일본어 동사활용 쓰기노트 (시원스쿨) ──────────────
export type VerbSection = { id: string; part: 'PART1' | 'PART2'; title: string; page: number }

export const VERB_TOC: VerbSection[] = [
  { id: 'v-p1-01', part: 'PART1', title: '01 일본어 동사의 특징',         page: 8   },
  { id: 'v-p1-02', part: 'PART1', title: '02 주요 동사 활용 미리보기 ①', page: 12  },
  { id: 'v-p1-03', part: 'PART1', title: '03 주요 동사 활용 미리보기 ②', page: 16  },
  { id: 'v-p2-04', part: 'PART2', title: '04 ます형 ①',                   page: 22  },
  { id: 'v-p2-05', part: 'PART2', title: '05 ます형 ②',                   page: 30  },
  { id: 'v-p2-06', part: 'PART2', title: '06 ない형',                     page: 38  },
  { id: 'v-p2-07', part: 'PART2', title: '07 て형 (1그룹)',               page: 46  },
  { id: 'v-p2-08', part: 'PART2', title: '08 て형 (2·3그룹)',             page: 54  },
  { id: 'v-p2-09', part: 'PART2', title: '09 た형 (1그룹)',               page: 62  },
  { id: 'v-p2-10', part: 'PART2', title: '10 た형 (2·3그룹)',             page: 70  },
  { id: 'v-p2-11', part: 'PART2', title: '11 동사의 명사화 ①',           page: 78  },
  { id: 'v-p2-12', part: 'PART2', title: '12 동사의 명사화 ②',           page: 86  },
  { id: 'v-p2-13', part: 'PART2', title: '13 의지형 · 권유형',           page: 94  },
  { id: 'v-p2-14', part: 'PART2', title: '14 가능형 ①',                  page: 102 },
  { id: 'v-p2-15', part: 'PART2', title: '15 가능형 ②',                  page: 110 },
  { id: 'v-p2-16', part: 'PART2', title: '16 금지형',                    page: 118 },
  { id: 'v-p2-17', part: 'PART2', title: '17 명령형',                    page: 126 },
  { id: 'v-p2-18', part: 'PART2', title: '18 사역형',                    page: 134 },
  { id: 'v-p2-19', part: 'PART2', title: '19 수동형',                    page: 142 },
  { id: 'v-p2-20', part: 'PART2', title: '20 사역수동형',                page: 150 },
]

const VERB_COLOR: Record<'PART1' | 'PART2', string> = {
  PART1: '#16a34a',  // green-600
  PART2: '#15803d',  // green-700
}



// ── 진도 상태 ────────────────────────────────────────────────────
type ReadStatus = 0 | 1 | 2   // 0=미완, 1=1회독, 2=2회독
const NEXT_STATUS: Record<ReadStatus, ReadStatus> = { 0: 1, 1: 2, 2: 0 }

const STATUS_BG: Record<ReadStatus, string> = {
  0: 'bg-gray-800',
  1: 'bg-blue-700/60',
  2: 'bg-blue-500',
}
const STATUS_LABEL: Record<ReadStatus, string> = {
  0: '미완',
  1: '1회독',
  2: '2회독',
}

type ProgressRow = {
  section_id: string
  status: ReadStatus
  memo: string | null
  updated_at: string
}

// ── 매일 스트릭 타입 ─────────────────────────────────────────────
type DailyRow = {
  date: string  // 'YYYY-MM-DD'
  part: Part
  done: boolean
}

function toDateStr(d: Date) {
  // UTC가 아닌 로컬 날짜 기준으로 YYYY-MM-DD 반환
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 오늘 기준 최근 30일 날짜 배열 (오래된 순)
function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return toDateStr(d)
  })
}

// ── 메인 ────────────────────────────────────────────────────────
export default function JlptN4Hub() {
  const [activeTab, setActiveTab] = useState<'progress' | 'daily' | 'tools'>('progress')
  const [progressMap, setProgressMap] = useState<Map<string, ProgressRow>>(new Map())
  const [dailyRows, setDailyRows]     = useState<DailyRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [editId, setEditId]           = useState<string | null>(null)
  const [editMemo, setEditMemo]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [filterPart, setFilterPart]   = useState<Part | null>(null)
  const [verbMap, setVerbMap]         = useState<Map<string, boolean>>(new Map())

  // ── 데이터 로드 ────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: prog }, { data: daily }, { data: verb }] = await Promise.all([
      supabase.from('jlpt_n4_progress').select('section_id, status, memo, updated_at'),
      supabase.from('jlpt_n4_daily').select('date, part, done'),
      supabase.from('jlpt_verb_progress').select('section_id, done'),
    ])
    const map = new Map<string, ProgressRow>()
    ;(prog || []).forEach((r: ProgressRow) => map.set(r.section_id, r))
    setProgressMap(map)
    setDailyRows((daily || []) as DailyRow[])
    const vmap = new Map<string, boolean>()
    ;(verb || []).forEach((r: { section_id: string; done: boolean }) => vmap.set(r.section_id, r.done))
    setVerbMap(vmap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── 섹션 상태 토글 ─────────────────────────────────────────────
  const toggleStatus = async (sec: N4Section) => {
    const current = (progressMap.get(sec.id)?.status ?? 0) as ReadStatus
    const next    = NEXT_STATUS[current]
    const payload = {
      section_id: sec.id,
      status:     next,
      memo:       progressMap.get(sec.id)?.memo ?? null,
      updated_at: new Date().toISOString(),
    }
    // 낙관적 업데이트
    setProgressMap(prev => {
      const m = new Map(prev)
      m.set(sec.id, payload as ProgressRow)
      return m
    })
    await supabase.from('jlpt_n4_progress').upsert(payload, { onConflict: 'section_id' })
  }

  // ── 메모 저장 ──────────────────────────────────────────────────
  const saveMemo = async (sec: N4Section) => {
    setSaving(true)
    const current = progressMap.get(sec.id)
    await supabase.from('jlpt_n4_progress').upsert({
      section_id: sec.id,
      status:     current?.status ?? 0,
      memo:       editMemo.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'section_id' })
    await fetchAll()
    setEditId(null)
    setSaving(false)
  }

  // ── 매일 스트릭 토글 ───────────────────────────────────────────
  const toggleDaily = async (date: string, part: Part) => {
    const key  = `${date}__${part}`
    const existing = dailyRows.find(r => r.date === date && r.part === part)
    const newDone  = !(existing?.done ?? false)
    // 낙관적 업데이트
    setDailyRows(prev => {
      const filtered = prev.filter(r => !(r.date === date && r.part === part))
      return [...filtered, { date, part, done: newDone }]
    })
    await supabase.from('jlpt_n4_daily').upsert(
      { date, part, done: newDone },
      { onConflict: 'date,part' }
    )
  }

  // ── 동사활용 토글 ───────────────────────────────────────────────
  const toggleVerb = async (id: string) => {
    const newDone = !(verbMap.get(id) ?? false)
    setVerbMap(prev => { const m = new Map(prev); m.set(id, newDone); return m })
    await supabase.from('jlpt_verb_progress').upsert(
      { section_id: id, done: newDone },
      { onConflict: 'section_id' }
    )
  }

  // ── 통계 ──────────────────────────────────────────────────────
  const allSections = N4_TOC
  const doneCount   = [...progressMap.values()].filter(r => r.status === 2).length
  const read1Count  = [...progressMap.values()].filter(r => r.status === 1).length
  const totalCount  = allSections.length

  const partStats = useMemo(() => PARTS.map(part => {
    const secs  = allSections.filter(s => s.part === part)
    const done  = secs.filter(s => (progressMap.get(s.id)?.status ?? 0) === 2).length
    const read1 = secs.filter(s => (progressMap.get(s.id)?.status ?? 0) === 1).length
    return { part, total: secs.length, done, read1 }
  }), [progressMap, allSections])

  const days = last30Days()
  const today = toDateStr(new Date())

  // 스트릭 맵
  const dailyMap = useMemo(() => {
    const m = new Map<string, boolean>()
    dailyRows.forEach(r => m.set(`${r.date}__${r.part}`, r.done))
    return m
  }, [dailyRows])

  const visibleSections = filterPart
    ? allSections.filter(s => s.part === filterPart)
    : allSections

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗣</span>
          <h1 className="text-2xl font-bold">JLPT N4</h1>
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          일본어능력시험 · 2026.7.5 (서울선린인터넷고등학교) · 해커스 N4 한권으로 합격 · 30일 2회독
        </p>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { key: 'progress', label: '📚 진도' },
            { key: 'daily',    label: '🔥 매일 루틴' },
            { key: 'tools',    label: '🃏 플래시카드' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 진도 탭 ── */}
        {activeTab === 'progress' && (
          <div>
            {/* 요약 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">2회독 완료</p>
                <p className="text-2xl font-bold text-blue-400">
                  {doneCount}<span className="text-sm text-gray-500 ml-1">/{totalCount}</span>
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">1회독 중</p>
                <p className="text-2xl font-bold text-blue-300/60">{read1Count}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">진도율</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round(((doneCount + read1Count * 0.5) / totalCount) * 100)}%
                </p>
              </div>
            </div>

            {/* 파트별 세그먼트 바 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-5 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest">파트별 진도</p>
              {partStats.map(({ part, total, done, read1 }) => {
                const color = PART_COLOR[part]
                const donePct  = total === 0 ? 0 : (done / total) * 100
                const read1Pct = total === 0 ? 0 : (read1 / total) * 100
                const sections = allSections.filter(s => s.part === part)

                return (
                  <div key={part}>
                    <div className="flex items-center justify-between mb-1.5">
                      <button
                        onClick={() => setFilterPart(filterPart === part ? null : part)}
                        className="text-sm font-medium hover:opacity-80 transition flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        {part}
                      </button>
                      <span className="text-xs text-gray-600">{done}/{total} 완료</span>
                    </div>
                    {/* 세그먼트 바 — 섹션 하나가 칸 하나 */}
                    <div className="flex gap-0.5">
                      {sections.map(sec => {
                        const st = (progressMap.get(sec.id)?.status ?? 0) as ReadStatus
                        return (
                          <button
                            key={sec.id}
                            onClick={() => toggleStatus(sec)}
                            title={`${sec.title} — ${STATUS_LABEL[st]}`}
                            className={`h-5 flex-1 rounded-sm transition-all duration-200 ${STATUS_BG[st]} hover:opacity-80`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-[10px] text-blue-400">■ 2회독 {done}개</span>
                      <span className="text-[10px] text-blue-400/50">■ 1회독 {read1}개</span>
                    </div>
                  </div>
                )
              })}
              <p className="text-[10px] text-gray-700 pt-1">칸을 클릭 → 미완 → 1회독 → 2회독 → 미완 순환</p>
            </div>

            {/* 파트 필터 */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              <button
                onClick={() => setFilterPart(null)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterPart === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                전체
              </button>
              {PARTS.map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPart(filterPart === p ? null : p)}
                  style={filterPart === p ? { backgroundColor: PART_COLOR[p] } : undefined}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterPart === p ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* 카드 타일 */}
            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {visibleSections.map(sec => {
                  const row    = progressMap.get(sec.id)
                  const status = (row?.status ?? 0) as ReadStatus
                  const isEdit = editId === sec.id

                  return (
                    <div key={sec.id} className="rounded-xl overflow-hidden bg-gray-900">
                      {/* 카드 본체 */}
                      <button
                        onClick={() => toggleStatus(sec)}
                        className={`w-full text-left p-3 transition hover:brightness-110 ${
                          status === 2 ? 'bg-blue-900/40' :
                          status === 1 ? 'bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: PART_COLOR[sec.part] }}
                          />
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto ${
                            status === 2 ? 'bg-blue-500 text-white' :
                            status === 1 ? 'bg-blue-500/30 text-blue-400' :
                            'bg-gray-800 text-gray-600'
                          }`}>
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-0.5">{sec.part} · p.{sec.page}</p>
                        <p className="text-sm font-semibold leading-snug">{sec.title}</p>
                        {row?.memo && (
                          <p className="text-[10px] text-blue-400 mt-1.5 truncate">{row.memo}</p>
                        )}
                      </button>
                      {/* 메모 토글 버튼 */}
                      <button
                        onClick={() => {
                          if (isEdit) { setEditId(null); return }
                          setEditId(sec.id)
                          setEditMemo(row?.memo || '')
                        }}
                        className="w-full text-[10px] text-gray-700 hover:text-gray-400 py-1 border-t border-gray-800 transition"
                      >
                        {isEdit ? '닫기' : '메모'}
                      </button>
                      {isEdit && (
                        <div className="p-2 border-t border-gray-800 bg-gray-900 space-y-1.5">
                          <textarea
                            rows={2}
                            value={editMemo}
                            onChange={e => setEditMemo(e.target.value)}
                            placeholder="약점·헷갈린 포인트..."
                            className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                          />
                          <button
                            onClick={() => saveMemo(sec)}
                            disabled={saving}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-1 rounded-lg text-xs font-semibold transition"
                          >
                            {saving ? '…' : '저장'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 매일 루틴 탭 ── */}
        {activeTab === 'daily' && (
          <div>
            <p className="text-xs text-gray-500 mb-4">
              청해와 어휘는 매일 반복이 기본. 오늘 체크하면 스트릭에 기록됩니다.
            </p>

            {/* 오늘 체크 */}
            <div className="bg-gray-900 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">오늘 ({today})</p>
              <div className="flex gap-3">
                {DAILY_PARTS.map(part => {
                  const done = dailyMap.get(`${today}__${part}`) ?? false
                  return (
                    <button
                      key={part}
                      onClick={() => toggleDaily(today, part)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${
                        done
                          ? 'text-white'
                          : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                      }`}
                      style={done ? { backgroundColor: PART_COLOR[part] } : undefined}
                    >
                      {done ? '✓ ' : ''}{part}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 30일 스트릭 */}
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">30일 스트릭</p>
              <div className="space-y-4">
                {DAILY_PARTS.map(part => {
                  const color = PART_COLOR[part]
                  const streak = (() => {
                    let s = 0
                    for (let i = days.length - 1; i >= 0; i--) {
                      if (dailyMap.get(`${days[i]}__${part}`)) s++
                      else break
                    }
                    return s
                  })()
                  const total30 = days.filter(d => dailyMap.get(`${d}__${part}`)).length

                  return (
                    <div key={part}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm font-medium">{part}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-600">연속 {streak}일</span>
                          <span className="text-xs text-gray-600">{total30}/30일</span>
                        </div>
                      </div>
                      {/* 잔디 */}
                      <div className="flex gap-0.5">
                        {days.map(d => {
                          const done = dailyMap.get(`${d}__${part}`) ?? false
                          const isToday = d === today
                          return (
                            <button
                              key={d}
                              onClick={() => toggleDaily(d, part)}
                              title={d}
                              className={`h-5 flex-1 rounded-sm transition ${
                                isToday ? 'ring-1 ring-white/30' : ''
                              }`}
                              style={{
                                backgroundColor: done ? color : '#1f2937',
                                opacity: done ? 1 : 0.4,
                              }}
                            />
                          )
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-700">5/3</span>
                        <span className="text-[10px] text-gray-700">오늘</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 동사활용 쓰기노트 진도 */}
            <div className="bg-gray-900 rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 uppercase tracking-widest">동사활용 쓰기노트</p>
                <span className="text-xs text-gray-600">
                  {[...verbMap.values()].filter(Boolean).length} / {VERB_TOC.length}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 mb-3">쓰면서 익히는 일본어 동사활용 쓰기노트 · 시원스쿨</p>

              {/* PART 구분별 세그먼트 바 */}
              {(['PART1', 'PART2'] as const).map(part => {
                const secs = VERB_TOC.filter(s => s.part === part)
                const done = secs.filter(s => verbMap.get(s.id)).length
                return (
                  <div key={part} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold" style={{ color: VERB_COLOR[part] }}>{part}</span>
                      <span className="text-[10px] text-gray-600">{done}/{secs.length}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {secs.map(sec => {
                        const done = verbMap.get(sec.id) ?? false
                        return (
                          <button
                            key={sec.id}
                            onClick={() => toggleVerb(sec.id)}
                            title={sec.title}
                            className="h-5 flex-1 rounded-sm transition-all duration-150 hover:opacity-80"
                            style={{ backgroundColor: done ? VERB_COLOR[part] : '#1f2937' }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* 카드 목록 */}
              <div className="grid grid-cols-2 gap-1.5 mt-3">
                {VERB_TOC.map(sec => {
                  const done = verbMap.get(sec.id) ?? false
                  return (
                    <button
                      key={sec.id}
                      onClick={() => toggleVerb(sec.id)}
                      className={`text-left px-3 py-2 rounded-lg text-xs transition ${
                        done ? 'bg-green-900/40 text-green-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <span className={`font-bold mr-1 ${done ? 'text-green-400' : 'text-gray-600'}`}>
                        {done ? '✓' : '○'}
                      </span>
                      {sec.title}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-gray-700 mt-2">칸 또는 카드를 클릭해서 완료 체크</p>
            </div>
          </div>
        )}

        {/* ── 플래시카드 탭 ── */}
        {activeTab === 'tools' && (
          <div className="space-y-2">
            <Link
              href="/flashcard?exam=jlpt-n4"
              className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-4 transition"
            >
              <div>
                <p className="text-sm font-semibold">🃏 N4 단어·문형 플래시카드</p>
                <p className="text-xs text-gray-500 mt-0.5">필수 어휘 · 문법 패턴 인출 훈련</p>
              </div>
              <span className="text-gray-600 text-xs">→</span>
            </Link>
            <Link
              href="/dashboard/jlpt-n4/verb-practice"
              className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-4 transition"
            >
              <div>
                <p className="text-sm font-semibold">⚡ 動詞活用練習</p>
                <p className="text-xs text-gray-500 mt-0.5">89개 동사 × 11활용형 · 반사신경 트레이닝</p>
              </div>
              <span className="text-gray-600 text-xs">→</span>
            </Link>
          </div>
        )}

      </div>
    </main>
  )
}
