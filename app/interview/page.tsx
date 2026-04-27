'use client'
import { useState, useMemo, useEffect } from 'react'
import { Question, CATEGORIES, DEFAULT_QUESTIONS } from './data'

const STORAGE_KEY = 'interview_questions'
const NOTES_KEY   = 'interview_notes'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }

const COMPANY_FILTERS = [
  { id: 'all',       label: '전체' },
  { id: 'universal', label: '보편' },
  { id: 'company',   label: '기업 특화' },
]

const EMPTY_FORM: Omit<Question, 'id'> = {
  category: 'self', company: 'universal',
  question: '', intent: '', frame: '', warning: '',
}

export default function InterviewPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [notes, setNotes]         = useState<Record<string, string>>({})
  const [cat, setCat]             = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [openId, setOpenId]       = useState<string | null>(null)
  const [modal, setModal]         = useState<{ mode: 'add' | 'edit'; q?: Question } | null>(null)
  const [form, setForm]           = useState<Omit<Question, 'id'>>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      setQuestions(raw ? JSON.parse(raw) : DEFAULT_QUESTIONS)
      const rawNotes = localStorage.getItem(NOTES_KEY)
      setNotes(rawNotes ? JSON.parse(rawNotes) : {})
    } catch { setQuestions(DEFAULT_QUESTIONS) }
  }, [])

  function save(next: Question[]) {
    setQuestions(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function saveNote(id: string, val: string) {
    const next = { ...notes, [id]: val }
    setNotes(next)
    localStorage.setItem(NOTES_KEY, JSON.stringify(next))
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setModal({ mode: 'add' })
  }

  function openEdit(q: Question) {
    setForm({ category: q.category, company: q.company, question: q.question, intent: q.intent, frame: q.frame, warning: q.warning ?? '' })
    setModal({ mode: 'edit', q })
    setOpenId(null)
  }

  function submitForm() {
    if (!form.question.trim() || !form.intent.trim() || !form.frame.trim()) return
    if (modal?.mode === 'add') {
      save([...questions, { id: genId(), ...form }])
    } else if (modal?.mode === 'edit' && modal.q) {
      save(questions.map(q => q.id === modal.q!.id ? { ...q, ...form } : q))
    }
    setModal(null)
  }

  function confirmDelete(id: string) { setDeleteTarget(id) }
  function doDelete() {
    if (!deleteTarget) return
    save(questions.filter(q => q.id !== deleteTarget))
    setDeleteTarget(null)
    setOpenId(null)
  }

  function resetToDefault() {
    save(DEFAULT_QUESTIONS)
    setNotes({})
    localStorage.removeItem(NOTES_KEY)
  }

  // Get all unique companies for filter chips
  const companies = useMemo(() => {
    const set = new Set(questions.map(q => q.company).filter(c => c !== 'universal'))
    return Array.from(set)
  }, [questions])

  const filtered = useMemo(() => questions.filter(q => {
    const catOk = cat === 'all' || q.category === cat
    const compOk =
      companyFilter === 'all' ? true :
      companyFilter === 'universal' ? q.company === 'universal' :
      companyFilter === 'company' ? q.company !== 'universal' :
      q.company === companyFilter
    return catOk && compOk
  }), [questions, cat, companyFilter])

  const catLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label ?? id

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* 헤더 */}
        <div className="mb-6">
          <a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition mb-4 inline-block">← 홈</a>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">🎤 면접 대비</h1>
              <p className="text-gray-500 text-sm">질문 패턴 · 면접관 의도 · 답변 프레임</p>
            </div>
            <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-2 rounded-lg transition">
              + 질문 추가
            </button>
          </div>
        </div>

        {/* 회사 필터 */}
        <div className="flex flex-wrap gap-2 mb-3">
          {COMPANY_FILTERS.map(f => (
            <button key={f.id} onClick={() => setCompanyFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${companyFilter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {f.label}
            </button>
          ))}
          {companies.map(c => (
            <button key={c} onClick={() => setCompanyFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${companyFilter === c ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {c}
            </button>
          ))}
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(c => {
            const count = questions.filter(q => {
              const compOk = companyFilter === 'all' ? true : companyFilter === 'universal' ? q.company === 'universal' : companyFilter === 'company' ? q.company !== 'universal' : q.company === companyFilter
              return (c.id === 'all' || q.category === c.id) && compOk
            }).length
            return (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition ${cat === c.id ? 'bg-gray-200 text-gray-900 font-semibold' : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700'}`}>
                {c.label} <span className="ml-1 opacity-50">{count}</span>
              </button>
            )
          })}
        </div>

        {/* 질문 카드 목록 */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center text-gray-600 py-12 text-sm">질문이 없습니다.</div>
          )}
          {filtered.map(q => {
            const isOpen = openId === q.id
            const isUniversal = q.company === 'universal'
            return (
              <div key={q.id} className="bg-gray-900 rounded-xl overflow-hidden">
                {/* 질문 헤더 */}
                <button onClick={() => setOpenId(isOpen ? null : q.id)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-gray-800 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-gray-600 uppercase tracking-widest">{catLabel(q.category)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${isUniversal ? 'bg-gray-700 text-gray-400' : 'bg-purple-500/20 text-purple-400'}`}>
                        {isUniversal ? '보편' : q.company}
                      </span>
                      {q.warning && <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">⚠️ 핵심</span>}
                    </div>
                    <p className="text-sm font-medium leading-snug">{q.question}</p>
                  </div>
                  <span className="text-gray-600 text-xs mt-0.5 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* 상세 */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
                    <div>
                      <p className="text-xs text-blue-400 font-semibold mb-1">🎯 면접관 의도</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{q.intent}</p>
                    </div>
                    <div>
                      <p className="text-xs text-green-400 font-semibold mb-1">💡 답변 프레임</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{q.frame}</p>
                    </div>
                    {q.warning && (
                      <div className="bg-yellow-500/10 rounded-lg px-3 py-2">
                        <p className="text-xs text-yellow-400 leading-relaxed">⚠️ {q.warning}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-1">📝 내 메모</p>
                      <textarea
                        value={notes[q.id] ?? ''}
                        onChange={e => saveNote(q.id, e.target.value)}
                        placeholder="내 답변 초안이나 키워드를 메모하세요..."
                        rows={3}
                        className="w-full bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 resize-none placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                    {/* 편집/삭제 */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => openEdit(q)}
                        className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
                        ✏️ 편집
                      </button>
                      <button onClick={() => confirmDelete(q.id)}
                        className="text-xs text-red-400 hover:text-red-300 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition">
                        🗑 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 초기화 */}
        <div className="mt-8 text-center">
          <button onClick={resetToDefault}
            className="text-xs text-gray-700 hover:text-gray-500 transition">
            기본값으로 초기화
          </button>
        </div>

      </div>

      {/* ── 편집/추가 모달 ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-base font-bold">{modal.mode === 'add' ? '질문 추가' : '질문 편집'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">카테고리</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-800 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-600">
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">구분</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="universal 또는 회사명"
                  className="w-full bg-gray-800 text-sm text-white rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-600" />
              </div>
            </div>

            {[
              { key: 'question', label: '질문', rows: 2 },
              { key: 'intent',   label: '면접관 의도', rows: 3 },
              { key: 'frame',    label: '답변 프레임', rows: 3 },
              { key: 'warning',  label: '경고 (선택)', rows: 2 },
            ].map(({ key, label, rows }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <textarea
                  value={(form as any)[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={rows}
                  className="w-full bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 resize-none placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button onClick={submitForm}
                disabled={!form.question.trim() || !form.intent.trim() || !form.frame.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm py-2 rounded-lg transition">
                {modal.mode === 'add' ? '추가' : '저장'}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
            <p className="text-sm text-gray-300">이 질문을 삭제할까요?</p>
            <div className="flex gap-2">
              <button onClick={doDelete}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm py-2 rounded-lg transition">
                삭제
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
