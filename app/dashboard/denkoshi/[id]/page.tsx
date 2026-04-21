'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── 기출 메타데이터 ───────────────────────────────────────────────
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

// ── 타입 ─────────────────────────────────────────────────────────
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
  ko: string | null
  memo: string | null
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-500'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 컴포넌트 ─────────────────────────────────────────────────────
export default function DenkoshiDetail() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const exam = PAST_EXAMS[examId]

  // PDF 탭: 문제 / 정답
  const [pdfTab, setPdfTab] = useState<'question' | 'answer'>('question')

  // URL 편집
  const [editingUrl, setEditingUrl] = useState<'question' | 'answer' | null>(null)
  const [urlInput, setUrlInput] = useState('')

  // 세션 (점수·URL)
  const [session, setSession] = useState<Session | null>(null)
  const [editingScore, setEditingScore] = useState(false)
  const [editScore, setEditScore] = useState('')
  const [editComment, setEditComment] = useState('')

  // 단어장
  const [words, setWords] = useState<Word[]>([])
  const [newJp, setNewJp] = useState('')
  const [newKo, setNewKo] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [addingWord, setAddingWord] = useState(false)
  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editWordJp, setEditWordJp] = useState('')
  const [editWordKo, setEditWordKo] = useState('')
  const [editWordMemo, setEditWordMemo] = useState('')

  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)

  // ── fetch ────────────────────────────────────────────────────
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

  useEffect(() => {
    fetchSession()
    fetchWords()
  }, [fetchSession, fetchWords])

  // ── upsert 세션 ───────────────────────────────────────────────
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
    await upsert({
      my_score: editScore ? parseFloat(editScore) : null,
      comments: editComment || null,
    })
    setEditingScore(false)
  }

  const saveUrl = async (type: 'question' | 'answer') => {
    const field = type === 'question' ? 'drive_url' : 'answer_drive_url'
    await upsert({ [field]: urlInput || null })
    setEditingUrl(null)
    setUrlInput('')
  }

  // ── 단어장 CRUD ───────────────────────────────────────────────
  const addWord = async () => {
    if (!newJp.trim()) return
    setSaving(true)
    await supabase.from('denkoshi_words').insert({
      exam_id: examId,
      jp: newJp.trim(),
      ko: newKo.trim() || null,
      memo: newMemo.trim() || null,
    })
    setNewJp(''); setNewKo(''); setNewMemo('')
    setAddingWord(false)
    await fetchWords()
    setSaving(false)
  }

  const startEditWord = (w: Word) => {
    setEditingWordId(w.id)
    setEditWordJp(w.jp)
    setEditWordKo(w.ko || '')
    setEditWordMemo(w.memo || '')
  }

  const saveWord = async (id: string) => {
    setSaving(true)
    await supabase.from('denkoshi_words').update({
      jp: editWordJp.trim(),
      ko: editWordKo.trim() || null,
      memo: editWordMemo.trim() || null,
    }).eq('id', id)
    setEditingWordId(null)
    await fetchWords()
    setSaving(false)
  }

  const deleteWord = async (id: string) => {
    await supabase.from('denkoshi_words').delete().eq('id', id)
    setWords(prev => prev.filter(w => w.id !== id))
  }

  // ── 플래시카드 변환 ───────────────────────────────────────────
  const convertToFlashcard = async () => {
    if (words.length === 0) return
    setConverting(true)
    const deckName = `${exam?.label} 단어장`

    // 덱 생성
    const { data: deck } = await supabase
      .from('flashcard_decks')
      .insert({
        user_id: 'flashcard_user',
        name: deckName,
        description: `${exam?.label} 기출 단어·용어 모음`,
        exam_type: 'denkoshi',
      })
      .select('id')
      .single()

    if (!deck) { setConverting(false); return }

    // 카드 일괄 insert
    const cards = words.map(w => ({
      deck_id: deck.id,
      card_type: 'basic',
      fields: [
        { name: '일본어', value: w.jp, type: 'text' },
        { name: '한국어', value: w.ko || '', type: 'text' },
        ...(w.memo ? [{ name: '메모', value: w.memo, type: 'text' }] : []),
      ],
    }))
    await supabase.from('flashcard_cards').insert(cards)

    setConverting(false)
    alert(`"${deckName}" 덱이 생성됐어요! (${words.length}장)`)
  }

  // ── 렌더링 ───────────────────────────────────────────────────
  const questionUrl = toPreviewUrl(session?.drive_url || '')
  const answerUrl   = toPreviewUrl(session?.answer_drive_url || '')
  const activeUrl   = pdfTab === 'question' ? questionUrl : answerUrl

  if (!exam) return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <p className="text-gray-400">존재하지 않는 회차입니다.</p>
      <button onClick={() => router.back()} className="text-blue-400 mt-4 text-sm">← 돌아가기</button>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* 헤더 */}
      <div className="px-6 pt-5 pb-3 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-sm mb-1 block">
            ← 기출문제 목록
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">第二種電気工事士 — {exam.label}</h1>
            {session?.my_score != null && (
              <span className={`text-lg font-bold tabular-nums ${scoreColor(session.my_score)}`}>
                {session.my_score}점
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 좌: PDF 뷰어 */}
        <div className="flex-1 flex flex-col border-r border-gray-800 overflow-hidden">
          {/* PDF 탭 + URL 관리 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
            <div className="flex gap-1">
              {(['question', 'answer'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setPdfTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    pdfTab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'question' ? '📄 문제' : '✅ 정답'}
                  {t === 'question' && questionUrl && ' ●'}
                  {t === 'answer'   && answerUrl   && ' ●'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setUrlInput(
                  pdfTab === 'question'
                    ? (session?.drive_url || '')
                    : (session?.answer_drive_url || '')
                )
                setEditingUrl(pdfTab)
              }}
              className="text-xs text-gray-600 hover:text-gray-400 transition"
            >
              {(pdfTab === 'question' ? questionUrl : answerUrl) ? '🔗 링크 변경' : '+ 링크 등록'}
            </button>
          </div>

          {/* URL 입력 */}
          {editingUrl === pdfTab && (
            <div className="px-3 py-2 border-b border-gray-800 bg-gray-900 flex gap-2 shrink-0">
              <input
                autoFocus
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="flex-1 bg-gray-800 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => saveUrl(editingUrl)}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
              >
                {saving ? '...' : '저장'}
              </button>
              <button
                onClick={() => setEditingUrl(null)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition"
              >
                취소
              </button>
            </div>
          )}

          {/* iframe */}
          {activeUrl ? (
            <iframe src={activeUrl} className="flex-1 w-full block" allow="autoplay" />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <p className="text-gray-500 text-sm">
                {pdfTab === 'question' ? '문제 PDF가 등록되지 않았습니다' : '정답 PDF가 등록되지 않았습니다'}
              </p>
              <button
                onClick={() => { setUrlInput(''); setEditingUrl(pdfTab) }}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                + 구글 드라이브 링크 등록
              </button>
            </div>
          )}
        </div>

        {/* 우: 사이드 패널 */}
        <div className="w-72 flex flex-col overflow-y-auto shrink-0">

          {/* 점수 메모 */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">점수 메모</h2>
              {!editingScore && (
                <button
                  onClick={() => {
                    setEditScore(session?.my_score?.toString() || '')
                    setEditComment(session?.comments || '')
                    setEditingScore(true)
                  }}
                  className="text-xs text-gray-600 hover:text-white transition"
                >
                  {session?.my_score != null ? '편집' : '+ 기록'}
                </button>
              )}
            </div>
            {editingScore ? (
              <div className="space-y-2">
                <input
                  type="number" min="0" max="100"
                  placeholder="점수"
                  value={editScore}
                  onChange={e => setEditScore(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <textarea
                  placeholder="메모"
                  value={editComment}
                  onChange={e => setEditComment(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={saveScore} disabled={saving}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs transition disabled:opacity-50">
                    {saving ? '...' : '저장'}
                  </button>
                  <button onClick={() => setEditingScore(false)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">
                    취소
                  </button>
                </div>
              </div>
            ) : session?.my_score != null ? (
              <div>
                <p className={`text-2xl font-bold tabular-nums ${scoreColor(session.my_score)}`}>
                  {session.my_score}점
                </p>
                {session.comments && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{session.comments}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-700">기록 없음</p>
            )}
          </div>

          {/* 단어장 */}
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                단어장 {words.length > 0 && `(${words.length})`}
              </h2>
              <div className="flex gap-2">
                {words.length > 0 && (
                  <button
                    onClick={convertToFlashcard}
                    disabled={converting}
                    className="text-xs text-blue-400 hover:text-blue-300 transition disabled:opacity-50"
                    title="플래시카드 덱으로 변환"
                  >
                    {converting ? '변환 중...' : '🃏 덱으로'}
                  </button>
                )}
                <button
                  onClick={() => setAddingWord(p => !p)}
                  className="text-xs text-gray-500 hover:text-white transition"
                >
                  + 추가
                </button>
              </div>
            </div>

            {/* 새 단어 입력 */}
            {addingWord && (
              <div className="bg-gray-900 rounded-xl p-3 mb-3 space-y-1.5">
                <input
                  autoFocus
                  type="text"
                  placeholder="일본어 *"
                  value={newJp}
                  onChange={e => setNewJp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWord()}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="한국어"
                  value={newKo}
                  onChange={e => setNewKo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWord()}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="메모 (선택)"
                  value={newMemo}
                  onChange={e => setNewMemo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWord()}
                  className="w-full bg-gray-800 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex gap-2 pt-1">
                  <button onClick={addWord} disabled={saving || !newJp.trim()}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-xs transition disabled:opacity-50">
                    추가
                  </button>
                  <button onClick={() => { setAddingWord(false); setNewJp(''); setNewKo(''); setNewMemo('') }}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs transition">
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 단어 목록 */}
            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {words.length === 0 && !addingWord && (
                <p className="text-xs text-gray-700 text-center py-6">
                  자주 나오는 단어·용어를<br />기록해두세요
                </p>
              )}
              {words.map(w => (
                <div key={w.id} className="bg-gray-900 rounded-xl p-3 group">
                  {editingWordId === w.id ? (
                    <div className="space-y-1.5">
                      <input value={editWordJp} onChange={e => setEditWordJp(e.target.value)}
                        className="w-full bg-gray-800 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
                      <input value={editWordKo} onChange={e => setEditWordKo(e.target.value)}
                        className="w-full bg-gray-800 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
                      <input value={editWordMemo} onChange={e => setEditWordMemo(e.target.value)}
                        className="w-full bg-gray-800 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500" />
                      <div className="flex gap-1.5">
                        <button onClick={() => saveWord(w.id)} disabled={saving}
                          className="bg-blue-600 hover:bg-blue-500 px-2 py-0.5 rounded text-xs transition disabled:opacity-50">저장</button>
                        <button onClick={() => setEditingWordId(null)}
                          className="bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded text-xs transition">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{w.jp}</p>
                        {w.ko && <p className="text-xs text-gray-400 mt-0.5">{w.ko}</p>}
                        {w.memo && <p className="text-xs text-gray-600 mt-0.5">{w.memo}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button onClick={() => startEditWord(w)}
                          className="text-gray-500 hover:text-white text-xs px-1">✏</button>
                        <button onClick={() => deleteWord(w.id)}
                          className="text-gray-600 hover:text-red-400 text-xs px-1">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
