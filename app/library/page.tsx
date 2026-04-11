'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type PdfRef = {
  id: string
  title: string
  subject: string
  description: string
  drive_url: string
  created_at: string
}

type Subject = {
  id: string
  label: string
}

const SHELF_COLORS = [
  'from-blue-900 to-blue-800',
  'from-teal-900 to-teal-800',
  'from-purple-900 to-purple-800',
  'from-orange-900 to-orange-800',
  'from-green-900 to-green-800',
  'from-rose-900 to-rose-800',
  'from-indigo-900 to-indigo-800',
]

const BOOK_COLORS = [
  'bg-blue-700', 'bg-teal-700', 'bg-purple-700', 'bg-orange-700',
  'bg-green-700', 'bg-rose-700', 'bg-indigo-700', 'bg-cyan-700',
  'bg-amber-700', 'bg-emerald-700',
]

function drivePreviewUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  return url.replace('/view', '/preview')
}

function BookCard({ pdf, subjects, onClick, onDelete, onUpdateSubject, onUpdate, colorIdx }: {
  pdf: PdfRef
  subjects: Subject[]
  onClick: () => void
  onDelete: () => void
  onUpdateSubject: (subject: string) => void
  onUpdate: (id: string, title: string, url: string, desc: string) => void
  colorIdx: number
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(pdf.title)
  const [editUrl, setEditUrl] = useState(pdf.drive_url)
  const [editDesc, setEditDesc] = useState(pdf.description || '')
  const color = BOOK_COLORS[colorIdx % BOOK_COLORS.length]

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onUpdate(pdf.id, editTitle, editUrl, editDesc)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 space-y-2 z-30" style={{ width: '220px' }}
        onClick={e => e.stopPropagation()}>
        <p className="text-xs text-gray-400 font-semibold">✏️ 편집</p>
        <input className="w-full bg-gray-700 rounded p-1.5 text-white text-xs"
          value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="제목" />
        <input className="w-full bg-gray-700 rounded p-1.5 text-white text-xs"
          value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="구글 드라이브 URL" />
        <input className="w-full bg-gray-700 rounded p-1.5 text-white text-xs"
          value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="설명 (선택)" />
        <div className="flex gap-2">
          <button onClick={handleSaveEdit}
            className="flex-1 bg-blue-600 hover:bg-blue-500 rounded px-2 py-1 text-xs">저장</button>
          <button onClick={e => { e.stopPropagation(); setEditing(false) }}
            className="flex-1 bg-gray-700 hover:bg-gray-600 rounded px-2 py-1 text-xs">취소</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group">
      {/* 책 본체 */}
      <div
        onClick={onClick}
        className={`${color} rounded-lg cursor-pointer transition-all duration-200 hover:-translate-y-2 hover:shadow-xl flex flex-col`}
        style={{ width: '100px', height: '140px' }}
      >
        <div className="flex-1 p-2 flex items-center justify-center">
          <p className="text-white text-xs font-semibold text-center leading-tight line-clamp-4">
            {pdf.title}
          </p>
        </div>
        <div className="px-2 pb-2">
          {pdf.subject && (
            <p className="text-white/50 text-xs truncate text-center">{pdf.subject}</p>
          )}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg bg-black/20" />
      </div>

      {/* 호버 메뉴 */}
      <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 z-10">
        <button
          onClick={e => { e.stopPropagation(); setEditing(true); setShowMenu(false) }}
          className="bg-gray-700 hover:bg-gray-600 rounded-full w-6 h-6 text-xs flex items-center justify-center"
          title="편집"
        >✏️</button>
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
          className="bg-gray-700 hover:bg-gray-600 rounded-full w-6 h-6 text-xs flex items-center justify-center"
          title="주제 변경"
        >🏷️</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="bg-red-800 hover:bg-red-700 rounded-full w-6 h-6 text-xs flex items-center justify-center"
          title="삭제"
        >✕</button>
      </div>

      {/* 주제 변경 드롭다운 */}
      {showMenu && (
        <div className="absolute top-6 right-0 z-20 bg-gray-800 border border-gray-700 rounded-lg p-2 shadow-xl min-w-max">
          <p className="text-xs text-gray-400 mb-1 px-1">주제 변경</p>
          <button
            onClick={e => { e.stopPropagation(); onUpdateSubject(''); setShowMenu(false) }}
            className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-700 text-gray-300"
          >
            주제 없음
          </button>
          {subjects.map(s => (
            <button key={s.id}
              onClick={e => { e.stopPropagation(); onUpdateSubject(s.label); setShowMenu(false) }}
              className={`block w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-700 ${pdf.subject === s.label ? 'text-blue-400' : 'text-white'}`}
            >
              {pdf.subject === s.label ? '✓ ' : ''}{s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const [pdfs, setPdfs] = useState<PdfRef[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [activePdf, setActivePdf] = useState<PdfRef | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [managingSubjects, setManagingSubjects] = useState(false)
  const [newSubject, setNewSubject] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: pdfData }, { data: subjectData }] = await Promise.all([
      supabase.from('pdf_refs').select('*').order('created_at', { ascending: true }),
      supabase.from('library_subjects').select('*').order('created_at', { ascending: true }),
    ])
    setPdfs(pdfData || [])
    setSubjects(subjectData || [])
    setLoading(false)
  }

  const handleSavePdf = async () => {
    if (!formTitle || !formUrl) return alert('제목과 URL을 입력해주세요')
    setSaving(true)
    const { error } = await supabase.from('pdf_refs').insert({
      title: formTitle, subject: formSubject, description: formDesc, drive_url: formUrl,
    })
    if (!error) { setFormTitle(''); setFormSubject(''); setFormDesc(''); setFormUrl(''); setAdding(false); fetchAll() }
    else alert('저장 실패: ' + error.message)
    setSaving(false)
  }

  const handleDeletePdf = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('pdf_refs').delete().eq('id', id)
    if (activePdf?.id === id) setActivePdf(null)
    fetchAll()
  }

  const handleUpdateSubject = async (pdfId: string, subject: string) => {
    await supabase.from('pdf_refs').update({ subject }).eq('id', pdfId)
    setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, subject } : p))
    if (activePdf?.id === pdfId) setActivePdf(prev => prev ? { ...prev, subject } : null)
  }

  const handleUpdate = async (pdfId: string, title: string, url: string, desc: string) => {
    await supabase.from('pdf_refs').update({ title, drive_url: url, description: desc }).eq('id', pdfId)
    setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, title, drive_url: url, description: desc } : p))
    if (activePdf?.id === pdfId) setActivePdf(prev => prev ? { ...prev, title, drive_url: url, description: desc } : null)
  }

  const handleAddSubject = async () => {
    if (!newSubject.trim()) return
    await supabase.from('library_subjects').insert({ label: newSubject.trim() })
    setNewSubject('')
    fetchAll()
  }

  const handleDeleteSubject = async (id: string, label: string) => {
    if (!confirm(`"${label}" 주제를 삭제할까요?`)) return
    await supabase.from('library_subjects').delete().eq('id', id)
    fetchAll()
  }

  // 책장 구성: 주제별 그룹 + 미분류
  const shelves: { label: string; pdfs: PdfRef[] }[] = [
    ...subjects.map(s => ({
      label: s.label,
      pdfs: pdfs.filter(p => p.subject === s.label),
    })).filter(s => s.pdfs.length > 0),
    ...(pdfs.filter(p => !p.subject || p.subject === '').length > 0
      ? [{ label: '미분류', pdfs: pdfs.filter(p => !p.subject || p.subject === '') }]
      : []),
  ]

  // 책 전체 색상 인덱스 (책마다 고유 색)
  const bookColorMap: Record<string, number> = {}
  pdfs.forEach((p, i) => { bookColorMap[p.id] = i })

  return (
    <main className="bg-gray-950 text-white flex flex-col" style={{ height: '100dvh' }}>
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
          <h1 className="text-xl font-bold">📖 레퍼런스 라이브러리</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setManagingSubjects(!managingSubjects); setAdding(false) }}
            className={`px-3 py-2 rounded-lg text-sm transition ${managingSubjects ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
            🏷️ 주제 관리
          </button>
          <button onClick={() => { setAdding(!adding); setManagingSubjects(false) }}
            className={`px-3 py-2 rounded-lg text-sm transition ${adding ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {adding ? '✕ 취소' : '+ PDF 추가'}
          </button>
        </div>
      </div>

      {/* 주제 관리 */}
      {managingSubjects && (
        <div className="px-6 py-4 bg-gray-900 border-b border-gray-800 shrink-0">
          <p className="text-sm text-gray-400 mb-3">주제(책장) 추가/삭제</p>
          <div className="flex gap-2 mb-3">
            <input className="flex-1 bg-gray-800 rounded-lg p-2 text-white text-sm"
              placeholder="새 주제 이름"
              value={newSubject} onChange={e => setNewSubject(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()} />
            <button onClick={handleAddSubject}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm">추가</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {subjects.map(s => (
              <span key={s.id} className="flex items-center gap-1 bg-gray-700 px-3 py-1 rounded-full text-sm">
                {s.label}
                <button onClick={() => handleDeleteSubject(s.id, s.label)}
                  className="text-gray-400 hover:text-red-400 ml-1">✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PDF 추가 폼 */}
      {adding && (
        <div className="px-6 py-4 bg-gray-900 border-b border-gray-800 space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <input className="bg-gray-800 rounded-lg p-3 text-white text-sm"
              placeholder="제목" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            <select className="bg-gray-800 rounded-lg p-3 text-white text-sm"
              value={formSubject} onChange={e => setFormSubject(e.target.value)}>
              <option value="">주제 선택 (선택사항)</option>
              {subjects.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
            </select>
          </div>
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white text-sm"
            placeholder="구글 드라이브 공유 URL" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white text-sm"
            placeholder="설명 (선택)" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
          <button onClick={handleSavePdf} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      )}

      {/* 책장 + 뷰어 */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 책장 영역 */}
        <div className={`flex-1 overflow-auto p-6 space-y-8 ${activePdf ? 'hidden md:block md:w-1/3' : ''}`}>
          {loading && <p className="text-gray-400">불러오는 중...</p>}
          {!loading && shelves.length === 0 && (
            <div className="text-center py-32 text-gray-500">
              <p className="text-5xl mb-4">📚</p>
              <p>PDF를 추가해보세요</p>
            </div>
          )}

          {shelves.map((shelf, shelfIdx) => (
            <div key={shelf.label}>
              {/* 책장 레이블 */}
              <div className={`bg-gradient-to-r ${SHELF_COLORS[shelfIdx % SHELF_COLORS.length]} rounded-t-lg px-4 py-2 flex items-center gap-2`}>
                <span className="text-white font-semibold text-sm">📚 {shelf.label}</span>
                <span className="text-white/50 text-xs">({shelf.pdfs.length}권)</span>
              </div>
              {/* 책장 선반 */}
              <div className="bg-gray-800 border border-gray-700 rounded-b-lg px-6 py-6">
                <div className="flex flex-wrap gap-4">
                  {shelf.pdfs.map(pdf => (
                    <BookCard
                      key={pdf.id}
                      pdf={pdf}
                      subjects={subjects}
                      colorIdx={bookColorMap[pdf.id]}
                      onClick={() => setActivePdf(activePdf?.id === pdf.id ? null : pdf)}
                      onDelete={() => handleDeletePdf(pdf.id)}
                      onUpdateSubject={(subject) => handleUpdateSubject(pdf.id, subject)}
                      onUpdate={handleUpdate}
                    />
                  ))}
                </div>
              </div>
              {/* 선반 바닥 */}
              <div className="h-3 bg-gray-600 rounded-b-lg shadow-lg" />
            </div>
          ))}
        </div>

        {/* PDF 뷰어 */}
        {activePdf && (
          <div className="flex flex-col border-l border-gray-800" style={{ width: activePdf ? '65%' : '0' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
              <p className="text-sm font-semibold truncate">{activePdf.title}</p>
              <button onClick={() => setActivePdf(null)}
                className="text-gray-400 hover:text-white text-sm shrink-0 ml-4">✕ 닫기</button>
            </div>
            <iframe src={drivePreviewUrl(activePdf.drive_url)} className="flex-1 w-full" allow="autoplay" />
          </div>
        )}
      </div>
    </main>
  )
}
