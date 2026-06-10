'use client'
import { useEffect, useState, ChangeEvent } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import styles from './memorias.module.css'

type Lang = 'ko' | 'es'

interface Chapter { id:string; title_ko:string; title_es:string; date_range:string; sort_order:number }
interface MemItem { id:string; chapter_id:string; type:'photo'|'memo'|'letter'|'gdrive'; photo_url:string|null; caption_ko:string|null; caption_es:string|null; content:string|null; author:'young'|'lucy'|null; sort_order:number }

const ROTATIONS = [-2.5, 1.8, -1.2, 3.0, -3.5, 2.2, -0.8, 1.5, -2.0, 2.8]

// ─── Google Drive helpers ─────────────────────────────────────────────────────
function extractDriveId(url: string): { id: string; kind: 'file'|'folder' } | null {
  const file   = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (file)   return { id: file[1],   kind: 'file' }
  const folder = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folder) return { id: folder[1], kind: 'folder' }
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idParam) return { id: idParam[1], kind: 'file' }
  // bare ID (32+ chars, alphanumeric/dash/underscore)
  const bare = url.trim().match(/^([a-zA-Z0-9_-]{25,})$/)
  if (bare)   return { id: bare[1],   kind: 'file' }
  return null
}
function driveImgUrl(id: string)    { return `https://drive.google.com/uc?export=view&id=${id}` }
function driveFolderUrl(id: string) { return `https://drive.google.com/embeddedfolderview?id=${id}#grid` }
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

async function uploadPhoto(file: File, chapterId: string): Promise<string|null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${chapterId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('memorias').upload(path, file, { upsert: false })
  if (error) { console.error(error); return null }
  return supabase.storage.from('memorias').getPublicUrl(path).data.publicUrl
}

// ─── ChapterModal ─────────────────────────────────────────────────────────────
function ChapterModal({ initial, onSave, onClose }: { initial?:Chapter; onSave:(a:string,b:string,c:string)=>void; onClose:()=>void }) {
  const [ko, setKo] = useState(initial?.title_ko ?? '')
  const [es, setEs] = useState(initial?.title_es ?? '')
  const [dr, setDr] = useState(initial?.date_range ?? '')
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{initial ? '챕터 수정' : '새 챕터'}</h3>
        <label className={styles.label}>제목 (한국어)</label>
        <input className={styles.input} value={ko} onChange={e=>setKo(e.target.value)} placeholder="예: 우리가 처음 만난 곳" autoFocus />
        <label className={styles.label}>Título (Español)</label>
        <input className={styles.input} value={es} onChange={e=>setEs(e.target.value)} placeholder="Ej: Donde nos conocimos" />
        <label className={styles.label}>날짜 범위</label>
        <input className={styles.input} value={dr} onChange={e=>setDr(e.target.value)} placeholder="예: 2023.06 – 2024.02" />
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>취소</button>
          <button className={styles.btnPrimary} onClick={()=>{ if(ko.trim()) onSave(ko.trim(),es.trim(),dr.trim()) }} disabled={!ko.trim()}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── AddItemModal ─────────────────────────────────────────────────────────────
function AddItemModal({ chapterId, onSave, onClose }: { chapterId:string; onSave:(item:Omit<MemItem,'id'|'sort_order'>)=>void; onClose:()=>void }) {
  const [type, setType] = useState<'photo'|'memo'|'letter'|'gdrive'|null>(null)
  const [photoTab, setPhotoTab] = useState<'upload'|'drive'>('upload')
  const [driveUrl, setDriveUrl] = useState('')
  const [drivePreview, setDrivePreview] = useState<string|null>(null)
  const [captionKo, setCaptionKo] = useState('')
  const [captionEs, setCaptionEs] = useState('')
  const [content, setContent] = useState('')
  const [author, setAuthor] = useState<'young'|'lucy'>('young')
  const [file, setFile] = useState<File|null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string|null>(null)
  // gdrive folder label
  const [folderLabel, setFolderLabel] = useState('')
  const [folderUrl, setFolderUrl] = useState('')

  function handleFile(e:ChangeEvent<HTMLInputElement>) { const f=e.target.files?.[0]; if(!f) return; setFile(f); setPreview(URL.createObjectURL(f)) }

  function handleDriveUrl(val: string) {
    setDriveUrl(val)
    const parsed = extractDriveId(val)
    if (parsed?.kind === 'file') setDrivePreview(driveImgUrl(parsed.id))
    else setDrivePreview(null)
  }

  async function handleSave() {
    if (!type) return
    if (type==='photo') {
      if (photoTab === 'drive') {
        const parsed = extractDriveId(driveUrl)
        if (!parsed || parsed.kind !== 'file') { alert('유효한 Google Drive 파일 링크를 붙여넣어주세요.'); return }
        onSave({ chapter_id:chapterId, type:'photo', photo_url:driveImgUrl(parsed.id), caption_ko:captionKo.trim()||null, caption_es:captionEs.trim()||null, content:null, author:null })
      } else {
        if(!file) return; setUploading(true)
        const url = await uploadPhoto(file, chapterId); setUploading(false)
        if(!url) { alert('업로드 실패. Supabase Storage 버킷(memorias)을 확인해주세요.'); return }
        onSave({ chapter_id:chapterId, type:'photo', photo_url:url, caption_ko:captionKo.trim()||null, caption_es:captionEs.trim()||null, content:null, author:null })
      }
    } else if (type==='gdrive') {
      const parsed = extractDriveId(folderUrl)
      if (!parsed) { alert('유효한 Google Drive 폴더 링크를 붙여넣어주세요.'); return }
      const embedUrl = parsed.kind === 'folder' ? driveFolderUrl(parsed.id) : driveImgUrl(parsed.id)
      onSave({ chapter_id:chapterId, type:'gdrive', photo_url:embedUrl, caption_ko:folderLabel.trim()||null, caption_es:null, content:null, author:null })
    } else {
      onSave({ chapter_id:chapterId, type, photo_url:null, caption_ko:null, caption_es:null, content:content.trim(), author })
    }
  }

  const AuthorRow = () => (
    <div className={styles.authorRow}>
      <button className={`${styles.authorBtn} ${author==='young'?styles.authorActiveYoung:''}`} onClick={()=>setAuthor('young')}>👨 Young</button>
      <button className={`${styles.authorBtn} ${author==='lucy'?styles.authorActiveLucy:''}`} onClick={()=>setAuthor('lucy')}>👩 Lucy Milena</button>
    </div>
  )

  if (!type) return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>어떤 카드를 추가할까요?</h3>
        <div className={styles.typeGrid}>
          {([['photo','📷','사진','Foto'],['memo','📝','메모','Nota'],['letter','💌','편지','Carta'],['gdrive','📁','GDrive','폴더']] as const).map(([t,e,ko,es])=>(
            <button key={t} className={styles.typeBtn} onClick={()=>setType(t)}>
              <span className={styles.typeEmoji}>{e}</span><span>{ko}</span><span className={styles.typeSubLabel}>{es}</span>
            </button>
          ))}
        </div>
        <div className={styles.modalActions}><button className={styles.btnGhost} onClick={onClose}>취소</button></div>
      </div>
    </div>
  )

  if (type==='photo') return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>📷 사진 추가</h3>
        {/* Tab: upload vs drive */}
        <div className={styles.tabRow}>
          <button className={`${styles.tabBtn} ${photoTab==='upload'?styles.tabActive:''}`} onClick={()=>setPhotoTab('upload')}>파일 업로드</button>
          <button className={`${styles.tabBtn} ${photoTab==='drive'?styles.tabActive:''}`} onClick={()=>setPhotoTab('drive')}>Google Drive 링크</button>
        </div>
        {photoTab==='upload' ? (
          <div className={styles.fileArea} onClick={()=>document.getElementById('mem-photo-upload')?.click()}>
            {preview ? <img src={preview} className={styles.previewImg} alt="preview"/> : <span className={styles.fileHint}>클릭하여 사진 선택 (JPG · PNG · WEBP)</span>}
            <input id="mem-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} onChange={handleFile}/>
          </div>
        ) : (
          <>
            <label className={styles.label}>Google Drive 파일 공유 링크</label>
            <input className={styles.input} value={driveUrl} onChange={e=>handleDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/…/view"/>
            <p className={styles.driveHint}>파일 → 공유 → 링크 복사 (링크 있는 모든 사용자)</p>
            {drivePreview && (
              <div className={styles.drivePreviewBox}>
                <img src={drivePreview} className={styles.previewImg} alt="drive preview"
                  onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
              </div>
            )}
          </>
        )}
        <label className={styles.label}>캡션 (한국어, 선택)</label>
        <input className={styles.input} value={captionKo} onChange={e=>setCaptionKo(e.target.value)} placeholder="이 사진에 대한 한 줄"/>
        <label className={styles.label}>Caption (Español, opcional)</label>
        <input className={styles.input} value={captionEs} onChange={e=>setCaptionEs(e.target.value)} placeholder="Una línea sobre esta foto"/>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={()=>setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave}
            disabled={(photoTab==='upload'&&(!file||uploading))||(photoTab==='drive'&&!driveUrl.trim())}>
            {uploading?'업로드 중…':'저장'}
          </button>
        </div>
      </div>
    </div>
  )

  if (type==='gdrive') return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>📁 Google Drive 폴더</h3>
        <p className={styles.driveHint}>구글 드라이브 폴더를 그대로 임베드합니다.<br/>폴더 → 공유 → 링크 있는 모든 사용자 → 링크 복사</p>
        <label className={styles.label}>폴더 공유 링크</label>
        <input className={styles.input} value={folderUrl} onChange={e=>setFolderUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…" autoFocus/>
        <label className={styles.label}>폴더 제목 (선택)</label>
        <input className={styles.input} value={folderLabel} onChange={e=>setFolderLabel(e.target.value)}
          placeholder="예: 산타마르타 여행 사진"/>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={()=>setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!folderUrl.trim()}>저장</button>
        </div>
      </div>
    </div>
  )

  if (type==='memo') return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>📝 메모 추가</h3>
        <AuthorRow/>
        <textarea className={styles.textarea} rows={5} value={content} onChange={e=>setContent(e.target.value)} placeholder="짧은 메모나 코멘트…" autoFocus/>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={()=>setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!content.trim()}>저장</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>💌 편지 추가</h3>
        <AuthorRow/>
        <p className={styles.letterHint}>편지 전체를 그대로 붙여넣거나 써주세요. 길어도 괜찮아요.</p>
        <textarea className={styles.textarea} rows={14} value={content} onChange={e=>setContent(e.target.value)} placeholder="편지 내용을 여기에…" autoFocus/>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={()=>setType(null)}>← 뒤로</button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={!content.trim()}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── EditItemModal ────────────────────────────────────────────────────────────
function EditItemModal({ item, onSave, onClose }: { item:MemItem; onSave:(c:string,a:'young'|'lucy')=>void; onClose:()=>void }) {
  const [content, setContent] = useState(item.content ?? '')
  const [author, setAuthor] = useState<'young'|'lucy'>(item.author ?? 'young')
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{item.type==='letter'?'💌 편지 수정':'📝 메모 수정'}</h3>
        <div className={styles.authorRow}>
          <button className={`${styles.authorBtn} ${author==='young'?styles.authorActiveYoung:''}`} onClick={()=>setAuthor('young')}>👨 Young</button>
          <button className={`${styles.authorBtn} ${author==='lucy'?styles.authorActiveLucy:''}`} onClick={()=>setAuthor('lucy')}>👩 Lucy Milena</button>
        </div>
        <textarea className={styles.textarea} rows={item.type==='letter'?14:6} value={content} onChange={e=>setContent(e.target.value)}/>
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onClose}>취소</button>
          <button className={styles.btnPrimary} onClick={()=>onSave(content,author)} disabled={!content.trim()}>저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── Cover ────────────────────────────────────────────────────────────────────
function CoverPage({ chapters, lang, editMode, onOpen, onLangToggle, onEditToggle, onNewChapter }: {
  chapters:Chapter[]; lang:Lang; editMode:boolean
  onOpen:()=>void; onLangToggle:()=>void; onEditToggle:()=>void; onNewChapter:()=>void
}) {
  return (
    <div className={styles.cover}>
      <Link href="/familia" className={styles.coverBack}>← Familia</Link>
      <div className={styles.coverActions}>
        <button className={styles.langBtn} onClick={onLangToggle}>{lang==='ko'?'🇨🇴 ES':'🇰🇷 KO'}</button>
        <button className={`${styles.editBtn} ${editMode?styles.editActive:''}`} onClick={onEditToggle}>{editMode?'✅ 완료':'✏️ 편집'}</button>
      </div>
      <div className={styles.coverCenter}>
        <div className={styles.coverRose}>🌹</div>
        <h1 className={styles.coverTitle}>Memorias</h1>
        <p className={styles.coverSub}>Choi · Arrieta</p>
        <div className={styles.coverLine}/>
        <p className={styles.coverYear}>2023 —</p>
        {chapters.length > 0
          ? <button className={styles.coverOpen} onClick={onOpen}>{lang==='ko'?'열기':'Abrir'} →</button>
          : editMode
            ? <button className={styles.coverOpen} onClick={onNewChapter}>+ {lang==='ko'?'첫 챕터 만들기':'Crear primer capítulo'}</button>
            : <p className={styles.coverEmpty}>{lang==='ko'?'아직 기억이 없어요 💕':'Aún no hay memorias 💕'}</p>
        }
        {chapters.length > 0 && <p className={styles.coverCount}>{chapters.length}{lang==='ko'?' 개의 챕터':' capítulos'}</p>}
      </div>
      <div className={styles.coverFooter}>
        {chapters.map((_,i)=><span key={i} className={styles.coverDot}/>)}
      </div>
    </div>
  )
}

// ─── Chapter Page ─────────────────────────────────────────────────────────────
function ChapterPage({ chapter, chapterIdx, totalChapters, items, lang, editMode, animKey, animDir,
  onPrev, onNext, onCover, onAddItem, onDeleteItem, onEditItem, onEditChapter, onDeleteChapter, onMoveChapter
}: {
  chapter:Chapter; chapterIdx:number; totalChapters:number; items:MemItem[]; lang:Lang; editMode:boolean
  animKey:number; animDir:'left'|'right'
  onPrev:()=>void; onNext:()=>void; onCover:()=>void; onAddItem:()=>void
  onDeleteItem:(id:string)=>void; onEditItem:(item:MemItem)=>void
  onEditChapter:()=>void; onDeleteChapter:()=>void; onMoveChapter:(dir:-1|1)=>void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id:string) => setExpanded(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })

  const photos  = items.filter(i=>i.type==='photo')
  const nonPhot = items.filter(i=>i.type!=='photo')
  const title   = lang==='ko' ? chapter.title_ko : (chapter.title_es||chapter.title_ko)
  const numStr  = String(chapterIdx+1).padStart(2,'0')

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.topBarBtn} onClick={onCover}>← {lang==='ko'?'표지':'Portada'}</button>
        <span className={styles.topBarChapter}>{chapterIdx+1} / {totalChapters}</span>
        <div className={styles.topBarRight}>
          {editMode && <>
            <button className={styles.topBarIconBtn} onClick={()=>onMoveChapter(-1)} disabled={chapterIdx===0}>↑</button>
            <button className={styles.topBarIconBtn} onClick={()=>onMoveChapter(1)} disabled={chapterIdx===totalChapters-1}>↓</button>
            <button className={styles.topBarIconBtn} onClick={onEditChapter}>✏️</button>
            <button className={styles.topBarIconBtn} onClick={onDeleteChapter}>🗑️</button>
          </>}
        </div>
      </div>

      {/* Animated content */}
      <div key={animKey} className={`${styles.pageContent} ${animDir==='left'?styles.slideInRight:styles.slideInLeft}`}>

        {/* Chapter heading with big background number */}
        <div className={styles.chapterHeading}>
          <span className={styles.chapterNumBg}>{numStr}</span>
          <div className={styles.chapterHeadingText}>
            <span className={styles.chapterRoman}>{ROMAN[chapterIdx]??numStr}</span>
            {chapter.date_range && <span className={styles.chapterDate}>{chapter.date_range}</span>}
            <h2 className={styles.chapterTitle}>{title}</h2>
          </div>
        </div>

        {/* Polaroid grid */}
        {photos.length > 0 && (
          <div className={styles.polaroidGrid}>
            {photos.map((item,i)=>(
              <div key={item.id} className={styles.polaroid} style={{'--rot':`${ROTATIONS[i%ROTATIONS.length]}deg`} as React.CSSProperties}>
                <div className={styles.polaroidInner}>
                  <img src={item.photo_url!} alt={item.caption_ko??''} className={styles.polaroidImg} loading="lazy"/>
                  <p className={styles.polaroidCaption}>{lang==='ko'?(item.caption_ko??''):((item.caption_es || item.caption_ko) ?? '')}</p>
                </div>
                {editMode && <button className={styles.polaroidDelete} onClick={()=>onDeleteItem(item.id)}>✕</button>}
              </div>
            ))}
          </div>
        )}

        {/* Ghost polaroids when empty */}
        {photos.length===0 && !editMode && (
          <div className={styles.polaroidGrid}>
            {[0,1,2].map(i=>(
              <div key={i} className={`${styles.polaroid} ${styles.polaroidGhost}`} style={{'--rot':`${ROTATIONS[i]}deg`} as React.CSSProperties}>
                <div className={styles.polaroidInner}>
                  <div className={styles.polaroidGhostImg}/>
                  <p className={styles.polaroidCaption}>&nbsp;</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Letters and memos */}
        {nonPhot.map(item=>{
          if (item.type==='gdrive') return (
            <div key={item.id} className={styles.driveCard}>
              <div className={styles.driveCardHeader}>
                <span className={styles.driveCardLabel}>📁 {item.caption_ko || 'Google Drive'}</span>
                {editMode && <div className={styles.cardBtns}>
                  <button className={styles.cardIconBtn} onClick={()=>onDeleteItem(item.id)}>🗑️</button>
                </div>}
              </div>
              <iframe
                src={item.photo_url!}
                className={styles.driveIframe}
                title={item.caption_ko ?? 'Google Drive'}
                allow="autoplay"
              />
              <p className={styles.driveCardHint}>Google Drive에서 보기 — 폴더가 공개 공유 상태여야 표시됩니다</p>
            </div>
          )
          if (item.type==='letter') return (
            <div key={item.id} className={styles.envelope}>
              <div className={styles.envelopeTop}>
                <div className={styles.envelopeSender} data-author={item.author}>
                  <span>💌</span>
                  <span>{item.author==='young'?'Young → Lucy Milena':'Lucy Milena → Young'}</span>
                </div>
                {editMode && <div className={styles.cardBtns}>
                  <button className={styles.cardIconBtn} onClick={()=>onEditItem(item)}>✏️</button>
                  <button className={styles.cardIconBtn} onClick={()=>onDeleteItem(item.id)}>🗑️</button>
                </div>}
              </div>
              <div className={styles.envelopeDivider}/>
              <p className={`${styles.envelopeContent} ${expanded.has(item.id)?styles.expanded:''}`}>{item.content}</p>
              <button className={styles.expandBtn} onClick={()=>toggle(item.id)}>
                {expanded.has(item.id)?(lang==='ko'?'접기 ↑':'Cerrar ↑'):(lang==='ko'?'편지 전체 보기 ↓':'Leer carta completa ↓')}
              </button>
            </div>
          )
          return (
            <div key={item.id} className={`${styles.sticky} ${item.author==='lucy'?styles.stickyLucy:''}`}>
              <div className={styles.stickyTop}>
                <span className={styles.stickyAuthor} data-author={item.author}>📝 {item.author==='young'?'Young':'Lucy Milena'}</span>
                {editMode && <div className={styles.cardBtns}>
                  <button className={styles.cardIconBtn} onClick={()=>onEditItem(item)}>✏️</button>
                  <button className={styles.cardIconBtn} onClick={()=>onDeleteItem(item.id)}>🗑️</button>
                </div>}
              </div>
              <p className={styles.stickyContent}>{item.content}</p>
            </div>
          )
        })}

        {editMode && <button className={styles.addCardBtn} onClick={onAddItem}>+ 카드 추가</button>}
      </div>

      {/* Bottom nav */}
      <div className={styles.bottomNav}>
        <button className={`${styles.navBtn} ${chapterIdx===0?styles.navBtnDisabled:''}`} onClick={onPrev} disabled={chapterIdx===0}>
          ← {lang==='ko'?'이전':'Anterior'}
        </button>
        <div className={styles.navDots}>
          {Array.from({length:totalChapters}).map((_,i)=>(
            <span key={i} className={`${styles.navDot} ${i===chapterIdx?styles.navDotActive:''}`}/>
          ))}
        </div>
        <button className={`${styles.navBtn} ${chapterIdx===totalChapters-1?styles.navBtnDisabled:''}`} onClick={onNext} disabled={chapterIdx===totalChapters-1}>
          {lang==='ko'?'다음':'Siguiente'} →
        </button>
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
  const [pageIdx, setPageIdx] = useState(-1)
  const [animKey, setAnimKey] = useState(0)
  const [animDir, setAnimDir] = useState<'left'|'right'>('left')
  const [chapterModal, setChapterModal] = useState<{open:boolean;editing?:Chapter}>({open:false})
  const [addItemModal, setAddItemModal] = useState<{open:boolean;chapterId:string}>({open:false,chapterId:''})
  const [editItemModal, setEditItemModal] = useState<{open:boolean;item?:MemItem}>({open:false})

  useEffect(()=>{ fetchAll() },[])

  useEffect(()=>{
    function onKey(e:KeyboardEvent) {
      if (e.key==='ArrowRight') go('next')
      if (e.key==='ArrowLeft')  go('prev')
    }
    window.addEventListener('keydown', onKey)
    return ()=>window.removeEventListener('keydown', onKey)
  },[pageIdx, chapters.length])

  async function fetchAll() {
    const [{data:ch},{data:it}] = await Promise.all([
      supabase.from('memoria_chapters').select('*').order('sort_order'),
      supabase.from('memoria_items').select('*').order('sort_order'),
    ])
    setChapters(ch??[]); setItems(it??[]); setLoading(false)
  }

  function go(dir:'next'|'prev') {
    const next = dir==='next' ? pageIdx+1 : pageIdx-1
    if (next < -1 || next >= chapters.length) return
    setAnimDir(dir==='next'?'left':'right'); setAnimKey(k=>k+1); setPageIdx(next)
  }

  async function saveChapter(title_ko:string, title_es:string, date_range:string) {
    const editing = chapterModal.editing
    if (editing) {
      await supabase.from('memoria_chapters').update({title_ko,title_es,date_range}).eq('id',editing.id)
      setChapters(prev=>prev.map(c=>c.id===editing.id?{...c,title_ko,title_es,date_range}:c))
    } else {
      const sort_order = chapters.length
      const {data} = await supabase.from('memoria_chapters').insert({title_ko,title_es,date_range,sort_order}).select().single()
      if (data) {
        setChapters(prev=>[...prev,data])
        setAnimDir('left'); setAnimKey(k=>k+1); setPageIdx(chapters.length)
      }
    }
    setChapterModal({open:false})
  }

  async function deleteChapter(id:string) {
    if (!confirm('이 챕터와 모든 카드를 삭제할까요?')) return
    setChapters(prev=>prev.filter(c=>c.id!==id))
    setItems(prev=>prev.filter(i=>i.chapter_id!==id))
    await supabase.from('memoria_items').delete().eq('chapter_id',id)
    await supabase.from('memoria_chapters').delete().eq('id',id)
    setAnimDir('right'); setAnimKey(k=>k+1); setPageIdx(-1)
  }

  async function moveChapter(id:string, dir:-1|1) {
    const idx = chapters.findIndex(c=>c.id===id)
    const swapIdx = idx+dir
    if (swapIdx<0||swapIdx>=chapters.length) return
    const next=[...chapters]; [next[idx],next[swapIdx]]=[next[swapIdx],next[idx]]
    const updated = next.map((c,i)=>({...c,sort_order:i}))
    setChapters(updated); setPageIdx(swapIdx)
    await Promise.all(updated.map(c=>supabase.from('memoria_chapters').update({sort_order:c.sort_order}).eq('id',c.id)))
  }

  async function saveItem(item:Omit<MemItem,'id'|'sort_order'>) {
    const sort_order = items.filter(i=>i.chapter_id===item.chapter_id).length
    const {data} = await supabase.from('memoria_items').insert({...item,sort_order}).select().single()
    if (data) setItems(prev=>[...prev,data])
    setAddItemModal({open:false,chapterId:''})
  }

  async function updateItem(id:string, content:string, author:'young'|'lucy') {
    await supabase.from('memoria_items').update({content,author}).eq('id',id)
    setItems(prev=>prev.map(i=>i.id===id?{...i,content,author}:i))
    setEditItemModal({open:false})
  }

  async function deleteItem(id:string) {
    if (!confirm('이 카드를 삭제할까요?')) return
    setItems(prev=>prev.filter(i=>i.id!==id))
    await supabase.from('memoria_items').delete().eq('id',id)
  }

  if (loading) return <div className={styles.loading}>memorias를 불러오는 중…</div>

  const currentChapter = chapters[pageIdx]
  const chapterItems   = currentChapter ? items.filter(i=>i.chapter_id===currentChapter.id) : []

  return (
    <div className={styles.root}>
      {pageIdx===-1
        ? <CoverPage chapters={chapters} lang={lang} editMode={editMode}
            onOpen={()=>{setAnimDir('left');setAnimKey(k=>k+1);setPageIdx(0)}}
            onLangToggle={()=>setLang(l=>l==='ko'?'es':'ko')}
            onEditToggle={()=>setEditMode(e=>!e)}
            onNewChapter={()=>setChapterModal({open:true,editing:undefined})}
          />
        : <ChapterPage
            chapter={currentChapter} chapterIdx={pageIdx} totalChapters={chapters.length}
            items={chapterItems} lang={lang} editMode={editMode} animKey={animKey} animDir={animDir}
            onPrev={()=>go('prev')} onNext={()=>go('next')}
            onCover={()=>{setAnimDir('right');setAnimKey(k=>k+1);setPageIdx(-1)}}
            onAddItem={()=>setAddItemModal({open:true,chapterId:currentChapter.id})}
            onDeleteItem={deleteItem} onEditItem={item=>setEditItemModal({open:true,item})}
            onEditChapter={()=>setChapterModal({open:true,editing:currentChapter})}
            onDeleteChapter={()=>deleteChapter(currentChapter.id)}
            onMoveChapter={dir=>moveChapter(currentChapter.id,dir)}
          />
      }

      {pageIdx===-1 && editMode && (
        <div className={styles.coverAddChapter}>
          <button className={styles.addChapterBtn} onClick={()=>setChapterModal({open:true,editing:undefined})}>+ 새 챕터 추가</button>
        </div>
      )}

      {chapterModal.open && <ChapterModal initial={chapterModal.editing} onSave={saveChapter} onClose={()=>setChapterModal({open:false})}/>}
      {addItemModal.open && <AddItemModal chapterId={addItemModal.chapterId} onSave={saveItem} onClose={()=>setAddItemModal({open:false,chapterId:''})}/>}
      {editItemModal.open && editItemModal.item && <EditItemModal item={editItemModal.item} onSave={(c,a)=>updateItem(editItemModal.item!.id,c,a)} onClose={()=>setEditItemModal({open:false})}/>}
    </div>
  )
}
