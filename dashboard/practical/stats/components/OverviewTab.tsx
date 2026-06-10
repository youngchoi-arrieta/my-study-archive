'use client'

import { useRef } from 'react'
import { fmtTime, type Session, type Step, type StepLog } from '@/lib/constants-practical'
import styles from '../page.module.css'

type EditMode = 'time' | 'review' | 'photo' | null

type Props = {
  filtered: Session[]
  totalTarget: number
  userSteps: Step[]
  openSession: string | null
  editMode: EditMode
  editLogs: StepLog[]
  saving: boolean
  tagSaving: boolean
  stepTags: Record<number, string[]>
  customTagInputs: Record<number, string>
  photoUrls: Record<string, string>
  uploading: boolean
  photoSessId: string | null
  showAddRecord: boolean
  addProblemNo: number
  addLogs: { name: string; stepId: number; min: number; sec: number }[]
  addSaving: boolean
  onOpenEdit: (sess: Session, mode: EditMode) => void
  onUpdateTime: (idx: number, min: number, sec: number) => void
  onToggleMistake: (stepIdx: number, tag: string) => void
  onUpdateMemo: (stepIdx: number, memo: string) => void
  onSaveEdit: (sessId: string) => void
  onPhotoClick: (sessId: string, hasPhoto: boolean) => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDeletePhoto: (sessId: string) => void
  onAddTag: (stepId: number, tag: string) => void
  onRemoveTag: (stepId: number, tag: string) => void
  onSetCustomTagInputs: (v: Record<number, string>) => void
  onOpenAddRecord: () => void
  onSetShowAddRecord: (v: boolean) => void
  onSetAddProblemNo: (v: number) => void
  onSetAddLogs: (fn: (prev: { name: string; stepId: number; min: number; sec: number }[]) => { name: string; stepId: number; min: number; sec: number }[]) => void
  onSaveManualRecord: () => void
}

export default function OverviewTab({
  filtered, totalTarget, userSteps,
  openSession, editMode, editLogs, saving, tagSaving,
  stepTags, customTagInputs, photoUrls, uploading, photoSessId,
  showAddRecord, addProblemNo, addLogs, addSaving,
  onOpenEdit, onUpdateTime, onToggleMistake, onUpdateMemo, onSaveEdit,
  onPhotoClick, onFileChange, onDeletePhoto,
  onAddTag, onRemoveTag, onSetCustomTagInputs,
  onOpenAddRecord, onSetShowAddRecord, onSetAddProblemNo, onSetAddLogs, onSaveManualRecord,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />

      <button className={styles.addRecordBtn} onClick={onOpenAddRecord}>+ 기록 수동 추가</button>

      {showAddRecord && (
        <div className={styles.addRecordBox}>
          <div className={styles.addRecordHeader}>
            <span className={styles.editHint}>📝 훈련 기록 수동 추가</span>
            <button className={styles.addRecordClose} onClick={() => onSetShowAddRecord(false)}>✕</button>
          </div>
          <div className={styles.editRow}>
            <span className={styles.editName}>문제 번호</span>
            <select className={styles.problemSelect} value={addProblemNo} onChange={e => onSetAddProblemNo(Number(e.target.value))}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}번 ({n <= 9 ? 'FLS' : 'LS'}형)</option>
              ))}
            </select>
          </div>
          {addLogs.map((l, j) => (
            <div key={j} className={styles.editRow}>
              <span className={styles.editName}>{l.name}</span>
              <div className={styles.editTimeRow}>
                <input type="number" min={0} value={l.min}
                  onChange={e => onSetAddLogs(prev => prev.map((x, i) => i === j ? { ...x, min: Number(e.target.value) } : x))}
                  className={styles.timeInput} />
                <span className={styles.timeUnit}>분</span>
                <input type="number" min={0} max={59} value={l.sec}
                  onChange={e => onSetAddLogs(prev => prev.map((x, i) => i === j ? { ...x, sec: Number(e.target.value) } : x))}
                  className={styles.timeInput} />
                <span className={styles.timeUnit}>초</span>
              </div>
            </div>
          ))}
          <div className={styles.editTotal}>
            총 합계: <strong>{fmtTime(addLogs.reduce((a, l) => a + l.min * 60 + l.sec, 0))}</strong>
          </div>
          <button className={styles.saveBtn} onClick={onSaveManualRecord} disabled={addSaving}>
            {addSaving ? '저장 중...' : '✓ 저장'}
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className={styles.sessionList}>
          {filtered.map((sess, i) => {
            const over = sess.total_time > totalTarget
            const isOpen = openSession === sess.id
            const hasMistakes = sess.step_logs.some((l: any) => (l.mistakes?.length ?? 0) > 0 || l.memo)
            const hasPhoto = !!photoUrls[sess.id]
            return (
              <div key={sess.id} className={styles.sessCard}>
                <div className={styles.sessTop}>
                  <span className={styles.sessNo}>#{filtered.length - i} · {sess.problem_no}번</span>
                  <span className={styles.sessDate}>
                    {new Date(sess.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`${styles.sessTime} ${over ? styles.over : styles.ok}`}>{fmtTime(sess.total_time)}</span>
                  <div className={styles.sessBtns}>
                    <button className={`${styles.editBtn} ${isOpen && editMode === 'time' ? styles.editBtnActive : ''}`}
                      onClick={() => onOpenEdit(sess, 'time')}>⏱ 시간</button>
                    <button className={`${styles.editBtn} ${styles.reviewBtn} ${isOpen && editMode === 'review' ? styles.editBtnActive : ''}`}
                      onClick={() => onOpenEdit(sess, 'review')}>
                      📝{hasMistakes ? ' ✓' : ''}
                    </button>
                    <button className={`${styles.editBtn} ${styles.photoBtn} ${hasPhoto ? styles.photoBtnHas : ''}`}
                      onClick={() => onPhotoClick(sess.id, hasPhoto)}>
                      {uploading && photoSessId === sess.id ? '⏳' : hasPhoto ? '🖼️' : '📷'}
                    </button>
                  </div>
                </div>

                <div className={styles.stepChips}>
                  {sess.step_logs.map((l: any, j: number) => {
                    const step = userSteps.find(s => s.id === l.stepId)
                    const isOver = l.elapsed > (step?.target || 0)
                    return (
                      <span key={j} className={`${styles.chip} ${l.elapsed === 0 ? styles.chipZero : isOver ? styles.chipOver : styles.chipOk}`}>
                        {l.name} {l.elapsed === 0 ? '-' : fmtTime(l.elapsed)}
                      </span>
                    )
                  })}
                </div>

                {isOpen && editMode === 'photo' && hasPhoto && (
                  <div className={styles.photoBox}>
                    <img src={photoUrls[sess.id]} alt="완성작" className={styles.photoImg} />
                    <div className={styles.photoBtns}>
                      <button className={styles.photoChange} onClick={() => { fileInputRef.current?.click() }}>🔄 사진 변경</button>
                      <button className={styles.photoDelete} onClick={() => onDeletePhoto(sess.id)}>🗑 삭제</button>
                    </div>
                  </div>
                )}

                {isOpen && editMode === 'photo' && !hasPhoto && !uploading && (
                  <div className={styles.photoEmpty}>
                    <p>📷 사진을 선택해주세요</p>
                    <button className={styles.photoUploadBtn} onClick={() => fileInputRef.current?.click()}>갤러리에서 선택</button>
                  </div>
                )}

                {isOpen && editMode === 'time' && (
                  <div className={styles.editBox}>
                    <p className={styles.editHint}>⏱ 공정별 시간 수정</p>
                    {editLogs.map((l, j) => (
                      <div key={j} className={styles.editRow}>
                        <span className={styles.editName}>{l.name}</span>
                        <div className={styles.editTimeRow}>
                          <input type="number" min={0} value={Math.floor(l.elapsed / 60)}
                            onChange={e => onUpdateTime(j, Number(e.target.value), l.elapsed % 60)}
                            className={styles.timeInput} />
                          <span className={styles.timeUnit}>분</span>
                          <input type="number" min={0} max={59} value={l.elapsed % 60}
                            onChange={e => onUpdateTime(j, Math.floor(l.elapsed / 60), Number(e.target.value))}
                            className={styles.timeInput} />
                          <span className={styles.timeUnit}>초</span>
                        </div>
                      </div>
                    ))}
                    <div className={styles.editTotal}>총 합계: <strong>{fmtTime(editLogs.reduce((a, l) => a + l.elapsed, 0))}</strong></div>
                    <button className={styles.saveBtn} onClick={() => onSaveEdit(sess.id)} disabled={saving}>
                      {saving ? '저장 중...' : '✓ 저장'}
                    </button>
                  </div>
                )}

                {isOpen && editMode === 'review' && (
                  <div className={styles.reviewBox}>
                    <p className={styles.editHint}>📝 훈련 반성{tagSaving ? ' — 태그 저장 중...' : ''}</p>
                    {editLogs.map((l, j) => {
                      const presets = stepTags[l.stepId] ?? []
                      const customInput = customTagInputs[j] ?? ''
                      const addCustomTag = () => {
                        if (!customInput.trim()) return
                        onAddTag(l.stepId, customInput.trim())
                        onToggleMistake(j, customInput.trim())
                        onSetCustomTagInputs({ ...customTagInputs, [j]: '' })
                      }
                      return (
                        <div key={j} className={styles.reviewStep}>
                          <div className={styles.reviewStepName}>{l.name}</div>
                          <div className={styles.tagGrid}>
                            {presets.map((tag, k) => (
                              <div key={k} className={styles.tagWrap}>
                                <button
                                  className={`${styles.tag} ${l.mistakes.includes(tag) ? styles.tagActive : ''}`}
                                  onClick={() => onToggleMistake(j, tag)}>
                                  {tag}
                                </button>
                                <button className={styles.tagDel} onClick={() => onRemoveTag(l.stepId, tag)}>✕</button>
                              </div>
                            ))}
                          </div>
                          <div className={styles.tagInputRow}>
                            <input
                              className={styles.tagInput}
                              placeholder="태그 추가..."
                              value={customInput}
                              onChange={e => onSetCustomTagInputs({ ...customTagInputs, [j]: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                            />
                            <button className={styles.tagAddBtn} onClick={addCustomTag}>+</button>
                          </div>
                          <textarea className={styles.memoInput} placeholder="추가 메모 (선택)"
                            value={(l as any).memo ?? ''} onChange={e => onUpdateMemo(j, e.target.value)} rows={2} />
                        </div>
                      )
                    })}
                    <button className={styles.saveBtn} onClick={() => onSaveEdit(sess.id)} disabled={saving}>
                      {saving ? '저장 중...' : '✓ 저장'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
