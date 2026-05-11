'use client'
import { useEffect, useState, ChangeEvent } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import styles from './memorias.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'ko' | 'es'

interface Chapter {
  id: string
  title_ko: string
  title_es: string
  date_range: string
  sort_order: number
}

interface MemItem {
  id: string
  chapter_id: string
  type: 'photo' | 'memo' | 'letter'
  photo_url: string | null
  caption_ko: string | null
  caption_es: string | null
  content: string | null
  author: 'young' | 'lucy' | null
  sort_order: number
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadPhoto(file: File, chapterId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${chapterId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('memorias')
    .upload(path, file, { upsert: false })
  if (error) { console.error(error); return null }
  const { data } = supabase.storage.from('memorias').getPublicUrl(path)
  return data.publicUrl
}

// ─── ChapterModal ─────────────────────────────────────────────────────────────

function ChapterModal({ initial, onSave, onClose }: {
  initial?: Chapter
  onSave: (title_ko: string, title_es: string, date_range: string) => void
  onClose: () => void
}) {
  const [titleKo, setTitleKo] = useState(initial?.title_ko ?? '')
  const [titleEs, setTitleEs] = useState(initial?.title_es ?? '')
  const [dateRange, setDateRange] = useState(initial?.date_range ?? '')

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{initial ? '챕터 수정' : '새 챕터 추가'}</h3>

        <label className={styles.label}>제목 (한국어)</label>
        <input
          className={styles.input}
          value={titleKo}
          onChange={e => setTitleKo(e.target.value)}
          placeholder="예: 우리가 처음 만난 곳"
          autoFocus
        />

        <label className={styles.label}>Título (Español)</label>
        <input
          className={styles.input}
          value={titleEs}
          onChange={e => setTitleEs(e.target.value)}
          placeholder="Ej: Donde nos conocimos"
        />

        <label className={styles.label}>날짜 범위</label>
        <input
          className={styles.input}
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          placeholder="예: 2023.06 – 2024.02"
        />

        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>취소</button>
          <button
            className={styles.btnPrimary}
            onClick={() => { if (titleKo.trim()) onSave(titleKo.trim(), titleEs.trim(), dateRange.trim()) }}
            disabled={!titleKo.trim()}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AddItemModal ─────────────────────────────────────────────────────────────

function AddItemModal({ chapterId, onSave, onClose }: {
  chapterId: string
  onSave: (item: Omit<MemItem, 'id' | 'sort_order'>) => void
  onClose: () => void
}) {
  const [type, setType] = useState<'photo' | 'memo' | 'letter' | null>(null)
  const [captionKo, setCaptionKo] = useState('')
  const [captionEs, setCaptionEs] = useState('')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState<'young' | 'lucy'>('young')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSave() {
    if (!type) return
    if (type === 'photo') {
      if (!file) return
      setUploading(true)
      const url = await uploadPhoto(file, chapterId)
      setUploading(false)
      if (!url) { alert('업로드 실패. Supabase Storage 버킷(memorias)을 확인해주세요.'); return }
      onSave({
        chapter_id: chapterId, type,
        photo_url: url,
        caption_ko: captionKo.trim() || null,
        caption_es: captionEs.trim() || null,
        content: null, author: null,
      })
    } else {
      onSave({
        chapter_id: chapterId, type,
        photo_url: null,
        caption_ko: null, caption_es: null,
        content: content.trim(),
        author,
      })
    }
  }

  // ── type selector ──────────────────────────────────────────────────────────
  if (!type) return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>어떤 카드를 추가할까요?</h3>
        <div className={styles.typeGrid}>
          {([
            { t: 'photo',  emoji: '📷', labelKo: '사진',  labelEs: 'Foto' },
            { t: 'memo',   emoji: '📝', labelKo: '메모',  labelEs: 'Nota' },
            { t: 'letter', emoji: '💌', labelKo: '편지',  labelEs: 'Carta' },
          ] as const).map(({ t, emoji, labelKo, labelEs }) => (
            <button key={t} className={styles.typeBtn} onClick={() => setType(t)}>
              <span className={styles.typeEmoji}>{emoji}</span>
              <span>{labelKo}</span>
              <span className={styles.typeSubLabel}>{labelEs}</span>
            </button>
          ))}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  )

  // ── author selector shared ─────────────────────────────────────────────────
  const AuthorRow = () => (
    <div className={styles.authorRow}>
      <button
        className={`${styles.authorBtn} ${author === 'young' ? styles.authorActiveYoung : ''}`}
        onClick={() => setAuthor('young')}
      >
        👨 Young
      </button>
      <button
        className={`${styles.authorBtn} ${author === 'lucy' ? styles.authorActiveLucy : ''}`}
        onClick={() => setAuthor('lucy')}
      >
        👩 Lucy Milena
      </button>
    </div>
  )

  // ── photo form ─────────────────────────────────────────────────────────────
  if (type === 'photo') return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>📷 사진 추가</h3>

        <div
          className={styles.fileArea}
          onClick={() => document.getElementById('mem-photo-upload')?.click()}
        >
          {preview
            ? <img src={preview} className={styles.previewImg} alt="preview" />
            : <span className={styles.fileHint}>클릭하여 사진 선택 (JPG · PNG · WEBP)</span>
          }
          <input
            id="mem-photo-upload" type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </div>

        <label className={styles.label}>캡션 (한국어, 선택)</label>
        <input className={styles.input} value={captionKo} onChange={e => setCaptionKo(e.target.value)} placeholder="이 사진에 대한 한 줄" />

        <label className={styles.label}>Caption (Español, opcional)</label>
        <input className={styles.input} value={captionEs} onChange={e => setCaptionEs(e.target.value)} placeholder="Una línea sobre esta foto" />

        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={() => setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!file || uploading}>
            {uploading ? '업로드 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── memo form ──────────────────────────────────────────────────────────────
  if (type === 'memo') return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>📝 메모 추가</h3>
        <AuthorRow />
        <textarea
          className={styles.textarea}
          rows={5}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="짧은 메모나 코멘트…"
          autoFocus
        />
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={() => setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!content.trim()}>저장</button>
        </div>
      </div>
    </div>
  )

  // ── letter form ────────────────────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>💌 편지 추가</h3>
        <AuthorRow />
        <p className={styles.letterHint}>편지 전체를 그대로 붙여넣거나 입력하세요. 길어도 괜찮아요.</p>
        <textarea
          className={styles.textarea}
          rows={14}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="편지 내용을 여기에…"
          autoFocus
        />
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={() => setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!content.trim()}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── EditLetterModal ──────────────────────────────────────────────────────────

function EditLetterModal({ item, onSave, onClose }: {
  item: MemItem
  onSave: (content: string, author: 'young' | 'lucy') => void
  onClose: () => void
}) {
  const [content, setContent] = useState(item.content ?? '')
  const [author, setAuthor] = useState<'young' | 'lucy'>(item.author ?? 'young')

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{item.type === 'letter' ? '💌 편지 수정' : '📝 메모 수정'}</h3>
        <div className={styles.authorRow}>
          <button
            className={`${styles.authorBtn} ${author === 'young' ? styles.authorActiveYoung : ''}`}
            onClick={() => setAuthor('young')}
          >👨 Young</button>
          <button
            className={`${styles.authorBtn} ${author === 'lucy' ? styles.authorActiveLucy : ''}`}
            onClick={() => setAuthor('lucy')}
          >👩 Lucy Milena</button>
        </div>
        <textarea
          className={styles.textarea}
          rows={item.type === 'letter' ? 14 : 6}
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>취소</button>
          <button className={styles.btnPrimary} onClick={() => onSave(content, author)} disabled={!content.trim()}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MemoriasGallery() {
  const [lang, setLang] = useState<Lang>('ko')
  const [editMode, setEditMode] = useState(false)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [items, setItems] = useState<MemItem[]>([])
  const [loading, setLoading] = useState(true)

  const [chapterModal, setChapterModal] = useState<{ open: boolean; editing?: Chapter }>({ open: false })
  const [addItemModal, setAddItemModal] = useState<{ open: boolean; chapterId: string }>({ open: false, chapterId: '' })
  const [editItemModal, setEditItemModal] = useState<{ open: boolean; item?: MemItem }>({ open: false })
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set())

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: ch }, { data: it }] = await Promise.all([
      supabase.from('memoria_chapters').select('*').order('sort_order'),
      supabase.from('memoria_items').select('*').order('sort_order'),
    ])
    setChapters(ch ?? [])
    setItems(it ?? [])
    setLoading(false)
  }

  // ── Chapter CRUD ───────────────────────────────────────────────────────────

  async function saveChapter(title_ko: string, title_es: string, date_range: string) {
    const editing = chapterModal.editing
    if (editing) {
      await supabase.from('memoria_chapters').update({ title_ko, title_es, date_range }).eq('id', editing.id)
      setChapters(prev => prev.map(c => c.id === editing.id ? { ...c, title_ko, title_es, date_range } : c))
    } else {
      const sort_order = chapters.length
      const { data } = await supabase
        .from('memoria_chapters')
        .insert({ title_ko, title_es, date_range, sort_order })
        .select().single()
      if (data) setChapters(prev => [...prev, data])
    }
    setChapterModal({ open: false })
  }

  async function deleteChapter(id: string) {
    if (!confirm('이 챕터와 모든 카드를 삭제할까요?')) return
    setChapters(prev => prev.filter(c => c.id !== id))
    setItems(prev => prev.filter(i => i.chapter_id !== id))
    await supabase.from('memoria_items').delete().eq('chapter_id', id)
    await supabase.from('memoria_chapters').delete().eq('id', id)
  }

  async function moveChapter(id: string, dir: -1 | 1) {
    const idx = chapters.findIndex(c => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= chapters.length) return
    const next = [...chapters]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    const updated = next.map((c, i) => ({ ...c, sort_order: i }))
    setChapters(updated)
    await Promise.all(updated.map(c => supabase.from('memoria_chapters').update({ sort_order: c.sort_order }).eq('id', c.id)))
  }

  // ── Item CRUD ──────────────────────────────────────────────────────────────

  async function saveItem(item: Omit<MemItem, 'id' | 'sort_order'>) {
    const sort_order = items.filter(i => i.chapter_id === item.chapter_id).length
    const { data } = await supabase
      .from('memoria_items')
      .insert({ ...item, sort_order })
      .select().single()
    if (data) setItems(prev => [...prev, data])
    setAddItemModal({ open: false, chapterId: '' })
  }

  async function updateItem(id: string, content: string, author: 'young' | 'lucy') {
    await supabase.from('memoria_items').update({ content, author }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, content, author } : i))
    setEditItemModal({ open: false })
  }

  async function deleteItem(id: string) {
    if (!confirm('이 카드를 삭제할까요?')) return
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('memoria_items').delete().eq('id', id)
  }

  function toggleLetter(id: string) {
    setExpandedLetters(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className={styles.loading}>loading memorias…</div>

  return (
    <div className={styles.root}>
      <div className={styles.inner}>

        {/* Header */}
        <header className={styles.header}>
          <div>
            <div className={styles.backRow}>
              <Link href="/familia" className={styles.backLink}>← Familia</Link>
            </div>
            <h1 className={styles.title}>🌹 Memorias</h1>
            <p className={styles.subtitle}>Choi · Arrieta · 우리의 기억</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.langBtn} onClick={() => setLang(l => l === 'ko' ? 'es' : 'ko')}>
              {lang === 'ko' ? '🇨🇴 ES' : '🇰🇷 KO'}
            </button>
            <button
              className={`${styles.editBtn} ${editMode ? styles.editActive : ''}`}
              onClick={() => setEditMode(e => !e)}
            >
              {editMode ? '✅ 완료' : '✏️ 편집'}
            </button>
          </div>
        </header>

        {/* Empty state */}
        {chapters.length === 0 && (
          <div className={styles.empty}>
            <p>아직 기억이 없어요 💕</p>
            <p className={styles.emptyHint}>편집 모드를 켜서 첫 챕터를 추가해보세요.</p>
          </div>
        )}

        {/* Chapters */}
        {chapters.map((ch, idx) => {
          const chItems = items.filter(i => i.chapter_id === ch.id)
          const photos = chItems.filter(i => i.type === 'photo')
          const cards  = chItems.filter(i => i.type !== 'photo')

          return (
            <section key={ch.id} className={styles.chapter}>

              {/* Chapter header */}
              <div className={styles.chapterHeader}>
                <div className={styles.chapterMeta}>
                  {ch.date_range && <span className={styles.dateRange}>{ch.date_range}</span>}
                  <h2 className={styles.chapterTitle}>
                    {lang === 'ko' ? ch.title_ko : (ch.title_es || ch.title_ko)}
                  </h2>
                </div>
                {editMode && (
                  <div className={styles.chapterActions}>
                    <button className={styles.iconBtn} title="위로" onClick={() => moveChapter(ch.id, -1)} disabled={idx === 0}>↑</button>
                    <button className={styles.iconBtn} title="아래로" onClick={() => moveChapter(ch.id, 1)} disabled={idx === chapters.length - 1}>↓</button>
                    <button className={styles.iconBtn} title="수정" onClick={() => setChapterModal({ open: true, editing: ch })}>✏️</button>
                    <button className={styles.iconBtn} title="삭제" onClick={() => deleteChapter(ch.id)}>🗑️</button>
                  </div>
                )}
              </div>

              {/* Photo grid */}
              {photos.length > 0 && (
                <div className={styles.photoGrid}>
                  {photos.map(item => (
                    <div key={item.id} className={styles.photoCard}>
                      <img
                        src={item.photo_url!}
                        alt={item.caption_ko ?? ''}
                        className={styles.photo}
                        loading="lazy"
                      />
                      {(item.caption_ko || item.caption_es) && (
                        <p className={styles.caption}>
                          {lang === 'ko' ? item.caption_ko : (item.caption_es || item.caption_ko)}
                        </p>
                      )}
                      {editMode && (
                        <button className={styles.photoDeleteBtn} onClick={() => deleteItem(item.id)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Memo & Letter cards */}
              {cards.map(item => (
                <div
                  key={item.id}
                  className={item.type === 'letter' ? styles.letterCard : styles.memoCard}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.cardAuthor} data-author={item.author}>
                      {item.type === 'letter' ? '💌' : '📝'}{' '}
                      {item.author === 'young' ? 'Young' : 'Lucy Milena'}
                    </span>
                    {editMode && (
                      <div className={styles.cardBtns}>
                        <button
                          className={styles.cardIconBtn}
                          onClick={() => setEditItemModal({ open: true, item })}
                        >✏️</button>
                        <button
                          className={styles.cardIconBtn}
                          onClick={() => deleteItem(item.id)}
                        >🗑️</button>
                      </div>
                    )}
                  </div>

                  {item.type === 'letter' ? (
                    <>
                      <p className={`${styles.letterContent} ${expandedLetters.has(item.id) ? styles.expanded : ''}`}>
                        {item.content}
                      </p>
                      <button className={styles.expandBtn} onClick={() => toggleLetter(item.id)}>
                        {expandedLetters.has(item.id) ? '접기 ↑' : '편지 전체 보기 ↓'}
                      </button>
                    </>
                  ) : (
                    <p className={styles.memoContent}>{item.content}</p>
                  )}
                </div>
              ))}

              {/* Add card */}
              {editMode && (
                <button
                  className={styles.addCardBtn}
                  onClick={() => setAddItemModal({ open: true, chapterId: ch.id })}
                >
                  + 카드 추가
                </button>
              )}
            </section>
          )
        })}

        {/* Add chapter */}
        {editMode && (
          <button className={styles.addChapterBtn} onClick={() => setChapterModal({ open: true, editing: undefined })}>
            + 새 챕터 추가
          </button>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {chapterModal.open && (
        <ChapterModal
          initial={chapterModal.editing}
          onSave={saveChapter}
          onClose={() => setChapterModal({ open: false })}
        />
      )}
      {addItemModal.open && (
        <AddItemModal
          chapterId={addItemModal.chapterId}
          onSave={saveItem}
          onClose={() => setAddItemModal({ open: false, chapterId: '' })}
        />
      )}
      {editItemModal.open && editItemModal.item && (
        <EditLetterModal
          item={editItemModal.item}
          onSave={(content, author) => updateItem(editItemModal.item!.id, content, author)}
          onClose={() => setEditItemModal({ open: false })}
        />
      )}
    </div>
  )
}
