'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { TOPIC_TREE } from '@/lib/constants'

type PdfRef = {
  id: string
  title: string
  subject: string
  description: string
  drive_url: string
  created_at: string
}

function drivePreviewUrl(url: string): string {
  // https://drive.google.com/file/d/FILE_ID/view → /preview
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  // 이미 /preview 형태면 그대로
  return url.replace('/view', '/preview')
}

const SUBJECTS = ['전체', ...TOPIC_TREE.map(t => t.label)]

export default function LibraryPage() {
  const [pdfs, setPdfs] = useState<PdfRef[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState('전체')
  const [activePdf, setActivePdf] = useState<PdfRef | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  // 추가 폼 state
  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formUrl, setFormUrl] = useState('')

  useEffect(() => {
    fetchPdfs()
  }, [])

  const fetchPdfs = async () => {
    const { data } = await supabase
      .from('pdf_refs')
      .select('*')
      .order('created_at', { ascending: false })
    setPdfs(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!formTitle || !formUrl) return alert('제목과 URL을 입력해주세요')
    setSaving(true)
    const { error } = await supabase.from('pdf_refs').insert({
      title: formTitle,
      subject: formSubject,
      description: formDesc,
      drive_url: formUrl,
    })
    if (!error) {
      setFormTitle(''); setFormSubject(''); setFormDesc(''); setFormUrl('')
      setAdding(false)
      fetchPdfs()
    } else alert('저장 실패: ' + error.message)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('pdf_refs').delete().eq('id', id)
    if (activePdf?.id === id) setActivePdf(null)
    fetchPdfs()
  }

  const filtered = selectedSubject === '전체'
    ? pdfs
    : pdfs.filter(p => p.subject === selectedSubject)

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ height: '100dvh' }}>
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
          <h1 className="text-xl font-bold">📖 레퍼런스 라이브러리</h1>
        </div>
        <button
          onClick={() => setAdding(!adding)}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition"
        >
          {adding ? '✕ 취소' : '+ PDF 추가'}
        </button>
      </div>

      {/* PDF 추가 폼 */}
      {adding && (
        <div className="px-6 py-4 bg-gray-900 border-b border-gray-800 space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <input className="bg-gray-800 rounded-lg p-3 text-white text-sm"
              placeholder="제목" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            <select className="bg-gray-800 rounded-lg p-3 text-white text-sm"
              value={formSubject} onChange={e => setFormSubject(e.target.value)}>
              <option value="">주제 선택</option>
              {TOPIC_TREE.map(t => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          </div>
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white text-sm"
            placeholder="구글 드라이브 공유 URL" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
          <input className="w-full bg-gray-800 rounded-lg p-3 text-white text-sm"
            placeholder="설명 (선택)" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 왼쪽: 목록 */}
        <div className={`flex flex-col border-r border-gray-800 shrink-0 ${activePdf ? 'w-72' : 'w-full max-w-xl mx-auto'}`}>
          {/* 주제 필터 */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-gray-800">
            {SUBJECTS.map(s => (
              <button key={s}
                onClick={() => setSelectedSubject(s)}
                className={`px-3 py-1 rounded-full text-xs transition ${
                  selectedSubject === s ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}>
                {s}
              </button>
            ))}
          </div>

          {/* PDF 목록 */}
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {loading && <p className="text-gray-400 text-sm">불러오는 중...</p>}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm">PDF가 없어요</p>
              </div>
            )}
            {filtered.map(pdf => {
              const topic = TOPIC_TREE.find(t => t.label === pdf.subject)
              return (
                <div key={pdf.id}
                  onClick={() => setActivePdf(activePdf?.id === pdf.id ? null : pdf)}
                  className={`rounded-xl p-4 cursor-pointer transition ${
                    activePdf?.id === pdf.id ? 'bg-blue-900 border border-blue-700' : 'bg-gray-800 hover:bg-gray-700'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{pdf.title}</p>
                      {pdf.subject && (
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${topic?.color || 'bg-gray-600'}`}>
                          {pdf.subject}
                        </span>
                      )}
                      {pdf.description && (
                        <p className="text-gray-400 text-xs mt-1 truncate">{pdf.description}</p>
                      )}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDelete(pdf.id) }}
                      className="text-gray-600 hover:text-red-400 text-xs shrink-0 transition">
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 오른쪽: PDF 뷰어 */}
        {activePdf && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
              <p className="text-sm font-semibold truncate">{activePdf.title}</p>
              <button onClick={() => setActivePdf(null)}
                className="text-gray-400 hover:text-white text-sm shrink-0 ml-4">✕ 닫기</button>
            </div>
            <iframe
              src={drivePreviewUrl(activePdf.drive_url)}
              className="flex-1 w-full"
              allow="autoplay"
            />
          </div>
        )}
      </div>
    </main>
  )
}
