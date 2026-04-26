'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SEITO_TOC, SECTION_MAP, CHAPTER_COLOR_MAP } from '@/lib/constants-denkoshi'

const PAST_EXAMS: Record<string, { label: string; year: number; term: '상' | '하' }> = {
  '20210530': { label: '2021 상기', year: 2021, term: '상' },
  '20211024': { label: '2021 하기', year: 2021, term: '하' },
  '20220529': { label: '2022 상기', year: 2022, term: '상' },
  '20221030': { label: '2022 하기', year: 2022, term: '하' },
  '20230528': { label: '2023 상기', year: 2023, term: '상' },
  '20231029': { label: '2023 하기', year: 2023, term: '하' },
  '20240526': { label: '2024 상기', year: 2024, term: '상' },
  '20241027': { label: '2024 하기', year: 2024, term: '하' },
  '20250525': { label: '2025 상기', year: 2025, term: '상' },
  '20251026': { label: '2025 하기', year: 2025, term: '하' },
}

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

type Session = {
  id: string
  my_score: number | null
  comments: string | null
  drive_url: string | null
  answer_drive_url: string | null
}

type Word = {
  id: string
  exam_id: string
  jp: string
  reading: string | null
  ko: string | null
  memo: string | null
}

type Deck = {
  id: string
  name: string
}

type SectionTag = {
  id: string
  exam_id: string
  q_num: number
  section_code: string
  result: 'correct' | 'wrong' | null
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-500'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 섹션 태그 팔레트 컴포넌트 ─────────────────────────────────────
function SectionPalette({
  onSelect,
  onClose,
}: {
  onSelect: (code: string) => void
  onClose: () => void
}) {
  const [selectedCh, setSelectedCh] = useState<number | null>(null)
  const chapter = selectedCh !== null ? SEITO_TOC.find(c => c.ch === selectedCh) : null

  return (
    <div className="mt-1.5 bg-gray-800 rounded-xl p-3 border border-gray-700 space-y-2">
      {/* 장 선택 */}
      <div className="flex flex-wrap gap-1.5">
        {SEITO_TOC.map(ch => (
          <button
            key={ch.ch}
            onClick={() => setSelectedCh(ch.ch === selectedCh ? null : ch.ch)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              selectedCh === ch.ch
                ? `${ch.color} text-white`
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {ch.ch}장
          </button>
        ))}
        <button
          onClick={onClose}
          className="ml-auto px-2 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition"
        >
          ✕
        </button>
      </div>

      {/* 소단원 선택 */}
      {chapter && (
        <div className="flex flex-wrap gap-1.5 border-t border-gray-700 pt-2">
          <p className="w-full text-xs text-gray-500 mb-0.5">{chapter.ja} — {chapter.ko}</p>
          {chapter.sections.map(s => (
            <button
              key={s.code}
              onClick={() => onSelect(s.code)}
              className="flex flex-col items-start px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-left"
            >
              <span className="text-xs font-bold text-white">{s.code}</span>
              <span className="text-[10px] text-gray-400">{s.ko}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 문제 태그 행 ──────────────────────────────────────────────────
function QuestionRow({
  qNum,
  tag,
  onTagSelect,
  onResultToggle,
  onRemove,
}: {
  qNum: number
  tag: SectionTag | undefined
  onTagSelect: (qNum: number, code: string) => void
  onResultToggle: (qNum: number, current: 'correct' | 'wrong' | null) => void
  onRemove: (qNum: number) => void
}) {
  const [open, setOpen] = useState(false)
  const section = tag ? SECTION_MAP.get(tag.section_code) : null
  const chNum = tag ? parseInt(tag.section_code.split('-')[0]) : null
  const chColor = chNum ? CHAPTER_COLOR_MAP.get(chNum) : null

  return (
    <div className="group">
      <div className="flex items-center gap-2 py-1">
        {/* 문제 번호 */}
        <span className="text-xs text-gray-600 w-6 text-right shrink-0">{qNum}</span>

        {/* 태그 버튼 */}
        {tag && section ? (
          <button
            onClick={() => setOpen(p => !p)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${chColor} text-white hover:opacity-80`}
          >
            <span className="font-bold">{tag.section_code}</span>
            <span className="text-white/80 hidden sm:inline">{section.ko}</span>
          </button>
        ) : (
          <button
            onClick={() => setOpen(p => !p)}
            className="px-2.5 py-1 rounded-lg text-xs text-gray-600 border border-dashed border-gray-700 hover:border-gray-500 hover:text-gray-400 transition"
          >
            + 소단원 태그
          </button>
        )}

        {/* 정오답 버튼 — 태그 있을 때만 */}
        {tag && (
          <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => onResultToggle(qNum, tag.result)}
              className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                tag.result === 'correct'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:text-green-400'
              }`}
            >
              ✓
            </button>
            <button
              onClick={() => onResultToggle(qNum, tag.result === 'wrong' ? 'wrong' : null)}
              className={`px-2 py-0.5 rounded text-xs font-bold transition ${
                tag.result === 'wrong'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-600 hover:text-red-400'
              }`}
            >
              ✗
            </button>
            <button
              onClick={() => onRemove(qNum)}
              className="px-1.5 py-0.5 rounded text-xs text-gray-700 hover:text-red-400 transition"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 팔레트 */}
      {open && (
        <SectionPalette
          onSelect={(code) => {
            onTagSelect(qNum, code)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function DenkoshiDetail() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const exam = PAST_EXAMS[examId]

  const [pdfTab, setPdfTab] = useState<'question' | 'answer'>('question')
  const [editingUrl, setEditingUrl] = useState<'question' | 'answer' | null>(null)
  const [urlInput, setUrlInput] = useState('')

  const [session, setSession] = useState<Session | null>(null)
  const [editingScore, setEditingScore] = useState(false)
  const [editScore, setEditScore] = useState('')
  const [editComment, setEditComment] = useState('')

  const [words, setWords] = useState<Word[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [addingWord, setAddingWord] = useState(false)
  const [newJp, setNewJp] = useState('')
  const [newReading, setNewReading] = useState('')
  const [newKo, setNewKo] = useState('')
  const [newMemo, setNewMemo] = useState('')

  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editWordJp, setEditWordJp] = useState('')
  const [editWordReading, setEditWordReading] = useState('')
  const [editWordKo, setEditWordKo] = useState('')
  const [editWordMemo, setEditWordMemo] = useState('')

  const [deckPickWordId, setDeckPickWordId] = useState<string | null>(null)
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [addingToDecks, setAddingToDecks] = useState(false)

  const [saving, setSaving] = useState(false)

  // 섹션 태그
  const [tags, setTags] = useState<SectionTag[]>([])
  const [showTags, setShowTags] = useState(true)
  const [showWords, setShowWords] = useState(true)

  // ── fetch ──────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    if (!exam) return
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, my_score, comments, drive_url, answer_drive_url')
      .eq('exam_type', 'denkoshi')
      .eq('year', exam.year)
      .eq('session', exam.term === '상' ? 1 : 2)
      .maybeSingle()
    setSession(data)
    if (data) {
      setEditScore(data.my_score?.toString() || '')
      setEditComment(data.comments || '')
    }
  }, [exam])

  const fetchWords = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_words')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at')
    setWords(data || [])
  }, [examId])

  const fetchDecks = useCallback(async () => {
    const { data } = await supabase
      .from('flashcard_decks')
      .select('id, name')
      .eq('exam_type', 'denkoshi')
      .order('created_at')
    setDecks(data || [])
  }, [])

  const fetchTags = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_section_tags')
      .select('*')
      .eq('exam_id', examId)
      .order('q_num')
    setTags((data || []) as SectionTag[])
  }, [examId])

  useEffect(() => {
    fetchSession()
    fetchWords()
    fetchDecks()
    fetchTags()
  }, [fetchSession, fetchWords, fetchDecks, fetchTags])

  // ── 세션 upsert ───────────────────────────────────────────────
  const upsert = async (extra: Partial<Session>) => {
    if (!exam) return
    setSaving(true)
    const base = {
      exam_type: 'denkoshi',
      year: exam.year,
      session: exam.term === '상' ? 1 : 2,
      record_type: '기출문제',
    }
    if (session) {
      await supabase.from('exam_sessions').update({ ...base, ...extra }).eq('id', session.id)
    } else {
      await supabase.from('exam_sessions').insert({ ...base, ...extra })
    }
    await fetchSession()
    setSaving(false)
  }

  const saveScore = async () => {
    await upsert({ my_score: editScore ? parseFloat(editScore) : null, comments: editComment || null })
    setEditingScore(false)
  }

  const saveUrl = async (type: 'question' | 'answer') => {
    const field = type === 'question' ? 'drive_url' : 'answer_drive_url'
    await upsert({ [field]: urlInput || null })
    setEditingUrl(null)
    setUrlInput('')
  }

  // ── 섹션 태그 조작 ────────────────────────────────────────────
  const handleTagSelect = async (qNum: number, code: string) => {
    await supabase
      .from('denkoshi_section_tags')
      .upsert(
        { exam_id: examId, q_num: qNum, section_code: code, result: null },
        { onConflict: 'exam_id,q_num' }
      )
    await fetchTags()
  }

  const handleResultToggle = async (qNum: number, current: 'correct' | 'wrong' | null) => {
    const tag = tags.find(t => t.q_num === qNum)
    if (!tag) return
    let next: 'correct' | 'wrong' | null
    if (current === null) next = 'correct'
    else if (current === 'correct') next = 'wrong'
    else next = null
    await supabase
      .from('denkoshi_section_tags')
      .update({ result: next })
      .eq('id', tag.id)
    await fetchTags()
  }

  const handleRemoveTag = async (qNum: number) => {
    const tag = tags.find(t => t.q_num === qNum)
    if (!tag) return
    await supabase.from('denkoshi_section_tags').delete().eq('id', tag.id)
    setTags(prev => prev.filter(t => t.q_num !== qNum))
  }

  // ── 단어장 조작 ───────────────────────────────────────────────
  const addWord = async () => {
    if (!newJp.trim()) return
    setSaving(true)
    await supabase.from('denkoshi_words').insert({
      exam_id: examId,
      jp: newJp.trim(),
      reading: newReading.trim() || null,
      ko: newKo.trim() || null,
      memo: newMemo.trim() || null,
    })
    setNewJp(''); setNewReading(''); setNewKo(''); setNewMemo('')
    await fetchWords()
    setSaving(false)
  }

  const startEditWord = (w: Word) => {
    setEditingWordId(w.id)
    setEditWordJp(w.jp)
    setEditWordReading(w.reading || '')
    setEditWordKo(w.ko || '')
    setEditWordMemo(w.memo || '')
  }

  const saveWord = async (id: string) => {
    setSaving(true)
    await supabase.from('denkoshi_words').update({
      jp: editWordJp.trim(),
      reading: editWordReading.trim() || null,
      ko: editWordKo.trim() || null,
      memo: editWordMemo.trim() || null,
    }).eq('id', id)
    setEditingWordId(null)
    await fetchWords()
    setSaving(false)
  }

  const deleteWord = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('denkoshi_words').delete().eq('id', id)
    setWords(prev => prev.filter(w => w.id !== id))
  }

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds(prev =>
      prev.includes(deckId) ? prev.filter(id => id !== deckId) : [...prev, deckId]
    )
  }

  const addToDecks = async (w: Word) => {
    if (selectedDeckIds.length === 0) return
    setAddingToDecks(true)
    const cards = selectedDeckIds.flatMap(deckId => [
      {
        deck_id: deckId,
        card_type: 'basic',
        fields: [
          { name: '앞면', value: w.jp, type: 'text' },
          { name: '뒷면', value: [w.reading, w.ko].filter(Boolean).join('\n'), type: 'text' },
        ],
      },
      {
        deck_id: deckId,
        card_type: 'basic',
        fields: [
          { name: '앞면', value: w.ko || w.jp, type: 'text' },
          { name: '뒷면', value: [w.jp, w.reading].filter(Boolean).join('\n'), type: 'text' },
        ],
      },
    ])
    await supabase.from('flashcard_cards').insert(cards)
    setDeckPickWordId(null)
    setSelectedDeckIds([])
    setAddingToDecks(false)
  }

  const questionUrl = toPreviewUrl(session?.drive_url || '')
  const answerUrl   = toPreviewUrl(session?.answer_drive_url || '')
  const activeUrl   = pdfTab === 'question' ? questionUrl : answerUrl

  const taggedCount = tags.length
  const correctCount = tags.filter(t => t.result === 'correct').length
  const wrongCount = tags.filter(t => t.result === 'wrong').length

  if (!exam) return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <p className="text-gray-400">존재하지 않는 회차입니다.</p>
      <button onClick={() => router.back()} className="text-blue-400 mt-4 text-sm">← 돌아가기</button>
    </main>
  )

  return (
    <main className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* 헤더 */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-800 shrink-0 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-sm shrink-0">
          ← 목록
        </button>
        <h1 className="text-sm font-bold truncate">第二種電気工事士 — {exam.label}</h1>
        {session?.my_score != null && (
          <span className={`text-sm font-bold tabular-nums shrink-0 ${scoreColor(session.my_score)}`}>
            {session.my_score}점
          </span>
        )}
        <button
          onClick={() => {
            setEditScore(session?.my_score?.toString() || '')
            setEditComment(session?.comments || '')
            setEditingScore(p => !p)
          }}
          className="text-xs text-gray-600 hover:text-gray-400 transition shrink-0 ml-auto"
        >
          ✏ 점수 메모
        </button>
      </div>

      {/* 점수 메모 */}
      {editingScore && (
        <div className="px-5 py-3 border-b border-gray-800 bg-gray-900 flex gap-3 items-start shrink-0">
          <input
            type="number" min="0" max="100" placeholder="점수"
            value={editScore} onChange={e => setEditScore(e.target.value)}
            className="w-20 bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text" placeholder="메모"
            value={editComment} onChange={e => setEditComment(e.target.value)}
            className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={saveScore} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50 shrink-0">
            {saving ? '...' : '저장'}
          </button>
          <button onClick={() => setEditingScore(false)}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition shrink-0">
            닫기
          </button>
        </div>
      )}

      {/* 본문 — PDF 50% / 우측 50% */}
      <div className="flex flex-1 overflow-hidden">

        {/* 좌: PDF */}
        <div className="w-1/2 flex flex-col border-r border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0 bg-gray-900">
            <div className="flex gap-1">
              {(['question', 'answer'] as const).map(t => (
                <button key={t} onClick={() => setPdfTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    pdfTab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}>
                  {t === 'question' ? `📄 문제${questionUrl ? ' ●' : ''}` : `✅ 정답${answerUrl ? ' ●' : ''}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {(pdfTab === 'question' ? session?.drive_url : session?.answer_drive_url) && (
                <a
                  href={(pdfTab === 'question' ? session?.drive_url : session?.answer_drive_url) || ''}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-white transition"
                >
                  ↗ 새 탭
                </a>
              )}
              <button
                onClick={() => {
                  setUrlInput(pdfTab === 'question' ? (session?.drive_url || '') : (session?.answer_drive_url || ''))
                  setEditingUrl(pdfTab)
                }}
                className="text-xs text-gray-600 hover:text-gray-400 transition"
              >
                {(pdfTab === 'question' ? questionUrl : answerUrl) ? '🔗 변경' : '+ 링크 등록'}
              </button>
            </div>
          </div>

          {editingUrl === pdfTab && (
            <div className="px-3 py-2 border-b border-gray-800 bg-gray-900 flex gap-2 shrink-0">
              <input autoFocus type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button onClick={() => saveUrl(editingUrl!)} disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50">
                {saving ? '...' : '저장'}
              </button>
              <button onClick={() => setEditingUrl(null)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition">
                취소
              </button>
            </div>
          )}

          {activeUrl ? (
            <iframe src={activeUrl} className="flex-1 w-full block" allow="autoplay" />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-gray-500 text-sm">
                {pdfTab === 'question' ? '문제 PDF 미등록' : '정답 PDF 미등록'}
              </p>
              <button onClick={() => { setUrlInput(''); setEditingUrl(pdfTab) }}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition">
                + 구글 드라이브 링크 등록
              </button>
            </div>
          )}
        </div>

        {/* 우: 섹션 태그 + 단어장 */}
        <div className="w-1/2 flex flex-col overflow-hidden">

          {/* ── 섹션 태그 섹션 ── */}
          <div className="border-b border-gray-800 shrink-0">
            <button
              onClick={() => setShowTags(p => !p)}
              className="w-full px-4 py-2.5 bg-gray-900 flex items-center justify-between text-left hover:bg-gray-800 transition"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  출제 소단원 매핑
                </span>
                {taggedCount > 0 && (
                  <span className="text-gray-600 text-xs">
                    {taggedCount}/50
                    {correctCount > 0 && <span className="text-green-600 ml-1">✓{correctCount}</span>}
                    {wrongCount > 0 && <span className="text-red-600 ml-1">✗{wrongCount}</span>}
                  </span>
                )}
              </div>
              <span className="text-gray-600 text-xs">{showTags ? '▲' : '▼'}</span>
            </button>

            {showTags && (
              <div className="bg-gray-950 px-4 py-3 max-h-80 overflow-y-auto">
                <div className="divide-y divide-gray-800/50">
                  {Array.from({ length: 50 }, (_, i) => i + 1).map(qNum => (
                    <QuestionRow
                      key={qNum}
                      qNum={qNum}
                      tag={tags.find(t => t.q_num === qNum)}
                      onTagSelect={handleTagSelect}
                      onResultToggle={handleResultToggle}
                      onRemove={handleRemoveTag}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 단어장 섹션 ── */}
          <div className="border-b border-gray-800 shrink-0">
            <div className="px-4 py-2.5 bg-gray-900 flex items-center justify-between">
              <button
                onClick={() => setShowWords(p => !p)}
                className="flex items-center gap-2 text-left flex-1"
              >
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  단어장 {words.length > 0 && <span className="text-gray-600 font-normal ml-1">({words.length})</span>}
                </span>
                <span className="text-gray-600 text-xs">{showWords ? '▲' : '▼'}</span>
              </button>
              {showWords && (
                <button
                  onClick={() => { setAddingWord(p => !p); setDeckPickWordId(null) }}
                  className={`text-xs px-3 py-1 rounded-lg transition ml-2 ${
                    addingWord ? 'bg-gray-700 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {addingWord ? '닫기' : '+ 추가'}
                </button>
              )}
            </div>
          </div>

          {showWords && addingWord && (
            <div className="border-b border-gray-800 bg-gray-900 p-4 shrink-0">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">한자 (일본어) *</label>
                  <textarea autoFocus value={newJp} onChange={e => setNewJp(e.target.value)}
                    placeholder="例: 漏電遮断器" rows={2}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">후리가나 (독음)</label>
                  <input type="text" value={newReading} onChange={e => setNewReading(e.target.value)}
                    placeholder="例: ろうでんしゃだんき"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">한국어 의미</label>
                  <textarea value={newKo} onChange={e => setNewKo(e.target.value)}
                    placeholder="例: 누전차단기" rows={2}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">메모</label>
                  <input type="text" value={newMemo} onChange={e => setNewMemo(e.target.value)}
                    placeholder="예: 8회 연속 출제"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addWord} disabled={saving || !newJp.trim()}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                  {saving ? '추가 중...' : '추가'}
                </button>
                <button onClick={() => { setAddingWord(false); setNewJp(''); setNewReading(''); setNewKo(''); setNewMemo('') }}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition">
                  취소
                </button>
              </div>
            </div>
          )}

          {showWords && (
            <div className="flex-1 overflow-y-auto p-4">
              {words.length === 0 && !addingWord ? (
                <div className="text-center py-12">
                  <p className="text-gray-700 text-sm">자주 나오는 한자·용어·문장을 기록해두세요</p>
                  <p className="text-gray-700 text-xs mt-1">한자 + 후리가나 + 한국어 → 덱에 바로 추가 가능</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {words.map(w => (
                    <div key={w.id} className="bg-gray-900 rounded-xl p-3 group">
                      {editingWordId === w.id ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">한자</label>
                            <textarea value={editWordJp} onChange={e => setEditWordJp(e.target.value)} rows={2}
                              className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">후리가나</label>
                            <input value={editWordReading} onChange={e => setEditWordReading(e.target.value)}
                              className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">한국어</label>
                            <textarea value={editWordKo} onChange={e => setEditWordKo(e.target.value)} rows={2}
                              className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">메모</label>
                            <input value={editWordMemo} onChange={e => setEditWordMemo(e.target.value)}
                              className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div className="col-span-2 flex gap-2 mt-1">
                            <button onClick={() => saveWord(w.id)} disabled={saving}
                              className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs transition disabled:opacity-50">
                              저장
                            </button>
                            <button onClick={() => setEditingWordId(null)}
                              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-base font-bold text-white whitespace-pre-wrap">{w.jp}</span>
                                {w.reading && <span className="text-xs text-blue-400">{w.reading}</span>}
                              </div>
                              {w.ko && <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap">{w.ko}</p>}
                              {w.memo && <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{w.memo}</p>}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button
                                onClick={() => { setDeckPickWordId(deckPickWordId === w.id ? null : w.id); setSelectedDeckIds([]) }}
                                className="text-blue-500 hover:text-blue-300 text-xs px-2 py-1 rounded"
                                title="덱에 추가"
                              >
                                ＋
                              </button>
                              <button onClick={() => startEditWord(w)}
                                className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded">
                                ✏
                              </button>
                              <button onClick={() => deleteWord(w.id)}
                                className="text-gray-600 hover:text-red-400 text-xs px-2 py-1 rounded">
                                ✕
                              </button>
                            </div>
                          </div>

                          {deckPickWordId === w.id && (
                            <div className="mt-2 pt-2 border-t border-gray-800">
                              <p className="text-xs text-gray-500 mb-2">추가할 덱 선택 (복수 가능)</p>
                              {decks.length === 0 ? (
                                <p className="text-xs text-gray-700">먼저 플래시카드에서 덱을 만들어주세요.</p>
                              ) : (
                                <div className="space-y-1 mb-2">
                                  {decks.map(deck => (
                                    <label key={deck.id} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedDeckIds.includes(deck.id)}
                                        onChange={() => toggleDeck(deck.id)}
                                        className="accent-blue-500"
                                      />
                                      <span className="text-xs text-gray-300">{deck.name}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => addToDecks(w)}
                                  disabled={addingToDecks || selectedDeckIds.length === 0}
                                  className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs transition disabled:opacity-50"
                                >
                                  {addingToDecks ? '추가 중...' : `추가 (${selectedDeckIds.length * 2}장)`}
                                </button>
                                <button
                                  onClick={() => { setDeckPickWordId(null); setSelectedDeckIds([]) }}
                                  className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
