'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_STEPS, MISTAKE_PRESETS, STEP_MISTAKE_PRESETS, STORAGE_USER_KEY, fmtTime, type User, type Session, type StepLog } from '@/lib/constants-practical'
import styles from './page.module.css'

type EditMode = 'time' | 'review' | 'photo' | null

function StatsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const initProblem = params.get('problem') ? Number(params.get('problem')) : null

  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedProblem, setSelectedProblem] = useState<number | null>(initProblem)
  const [tab, setTab] = useState<'overview' | 'steps' | 'mistakes'>('overview')
  const [loading, setLoading] = useState(true)
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [editLogs, setEditLogs] = useState<StepLog[]>([])
  const [saving, setSaving] = useState(false)
  const [customTagInputs, setCustomTagInputs] = useState<Record<number, string>>({})
  const [stepTags, setStepTags] = useState<Record<number, string[]>>({})
  const [tagSaving, setTagSaving] = useState(false)
  const [userSteps, setUserSteps] = useState(DEFAULT_STEPS)
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [addProblemNo, setAddProblemNo] = useState(16)
  const [addLogs, setAddLogs] = useState<{name: string, stepId: number, min: number, sec: number}[]>([])
  const [addSaving, setAddSaving] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoSessId, setPhotoSessId] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_USER_KEY)
    if (!saved) { router.replace('/dashboard/practical'); return }
    const u: User = JSON.parse(saved)
    setUser(u)
    loadSessions(u.id)
    loadStepTags(u.id)
    loadUserSteps(u.id)
  }, [])

  const loadUserSteps = async (userId: string) => {
    const { data } = await supabase.from('problem_steps').select('steps').eq('user_id', userId).single()
    if (data?.steps) setUserSteps(data.steps)
  }

  const openAddRecord = () => {
    setAddLogs(userSteps.map(s => ({ name: s.name, stepId: s.id, min: 0, sec: 0 })))
    setShowAddRecord(true)
  }

  const saveManualRecord = async () => {
    if (!user) return
    setAddSaving(true)
    const stepLogs = addLogs.map(l => ({
      stepId: l.stepId, name: l.name,
      elapsed: l.min * 60 + l.sec,
      mistakes: [],
    }))
    const totalTime = stepLogs.reduce((a, l) => a + l.elapsed, 0)
    const { error } = await supabase.from('sessions').insert({
      user_id: user.id, problem_no: addProblemNo,
      total_time: totalTime, step_logs: stepLogs,
    })
    if (error) { alert('저장 실패: ' + error.message); setAddSaving(false); return }
    await loadSessions(user.id)
    setShowAddRecord(false)
    setAddSaving(false)
  }

  const loadStepTags = async (userId: string) => {
    const { data } = await supabase.from('step_tags').select('tags').eq('user_id', userId).single()
    if (data) {
      setStepTags(data.tags)
    } else {
      // 기본값으로 초기화
      await supabase.from('step_tags').insert({ user_id: userId, tags: STEP_MISTAKE_PRESETS })
      setStepTags(STEP_MISTAKE_PRESETS)
    }
  }

  const saveStepTags = async (next: Record<number, string[]>, userId: string) => {
    setStepTags(next)
    setTagSaving(true)
    await supabase.from('step_tags').upsert({ user_id: userId, tags: next, updated_at: new Date().toISOString() })
    setTagSaving(false)
  }

  const addTag = (stepId: number, tag: string) => {
    if (!tag.trim() || !user) return
    const current = stepTags[stepId] ?? []
    if (current.includes(tag.trim())) return
    saveStepTags({ ...stepTags, [stepId]: [...current, tag.trim()] }, user.id)
  }

  const removeTag = (stepId: number, tag: string) => {
    if (!user) return
    const current = stepTags[stepId] ?? []
    saveStepTags({ ...stepTags, [stepId]: current.filter(t => t !== tag) }, user.id)
  }

  const loadSessions = async (userId: string) => {
    const { data } = await supabase
      .from('sessions').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) {
      setSessions(data)
      // 사진 URL 로드
      const urls: Record<string, string> = {}
      for (const sess of data) {
        const path = `${userId}/${sess.id}.jpg`
        const { data: urlData } = supabase.storage.from('session-photos').getPublicUrl(path)
        // 실제 존재 여부 확인
        const { data: fileData } = await supabase.storage.from('session-photos').list(userId, { search: `${sess.id}.jpg` })
        if (fileData && fileData.length > 0) {
          urls[sess.id] = urlData.publicUrl
        }
      }
      setPhotoUrls(urls)
    }
    setLoading(false)
  }

  const openEdit = (sess: Session, mode: EditMode) => {
    if (openSession === sess.id && editMode === mode) {
      setOpenSession(null); setEditMode(null); return
    }
    setOpenSession(sess.id)
    setEditMode(mode)
    if (mode === 'time' || mode === 'review') {
      setEditLogs(JSON.parse(JSON.stringify(sess.step_logs)))
    }
  }

  const updateTime = (idx: number, min: number, sec: number) => {
    setEditLogs(prev => prev.map((l, i) => i === idx ? { ...l, elapsed: min * 60 + sec } : l))
  }

  const toggleMistake = (stepIdx: number, tag: string) => {
    setEditLogs(prev => prev.map((l, i) => {
      if (i !== stepIdx) return l
      const has = l.mistakes.includes(tag)
      return { ...l, mistakes: has ? l.mistakes.filter(m => m !== tag) : [...l.mistakes, tag] }
    }))
  }

  const updateMemo = (stepIdx: number, memo: string) => {
    setEditLogs(prev => prev.map((l, i) => i === stepIdx ? { ...l, memo } : l))
  }

  const saveEdit = async (sessId: string) => {
    setSaving(true)
    const updateData: any = { step_logs: editLogs }
    if (editMode === 'time') {
      updateData.total_time = editLogs.reduce((a, l) => a + l.elapsed, 0)
    }
    const { error } = await supabase.from('sessions').update(updateData).eq('id', sessId)
    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }
    const u = JSON.parse(localStorage.getItem(STORAGE_USER_KEY)!)
    await loadSessions(u.id)
    setOpenSession(null); setEditMode(null)
    setSaving(false)
  }

  const handlePhotoClick = (sessId: string, hasPhoto: boolean) => {
    if (openSession === sessId && editMode === 'photo') {
      setOpenSession(null); setEditMode(null); return
    }
    setOpenSession(sessId)
    setEditMode('photo')
    setPhotoSessId(sessId)
    // 사진 없을 때만 바로 파일 선택
    if (!hasPhoto) {
      setTimeout(() => fileInputRef.current?.click(), 100)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !photoSessId || !user) return
    setUploading(true)
    const path = `${user.id}/${photoSessId}.jpg`
    const { error } = await supabase.storage.from('session-photos').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { alert('업로드 실패: ' + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('session-photos').getPublicUrl(path)
    setPhotoUrls(prev => ({ ...prev, [photoSessId]: urlData.publicUrl + '?t=' + Date.now() }))
    setUploading(false)
    e.target.value = ''
  }

  const deletePhoto = async (sessId: string) => {
    if (!user) return
    const path = `${user.id}/${sessId}.jpg`
    await supabase.storage.from('session-photos').remove([path])
    setPhotoUrls(prev => { const n = { ...prev }; delete n[sessId]; return n })
  }

  const filtered = selectedProblem ? sessions.filter(s => s.problem_no === selectedProblem) : sessions
  const totalTarget = userSteps.reduce((a, s) => a + s.target, 0)

  const stepAvg = userSteps.map(step => {
    const times = filtered.flatMap(s => s.step_logs)
      .filter((l: any) => l.stepId === step.id).map((l: any) => l.elapsed).filter(Boolean)
    return { ...step, avg: times.length ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0 }
  })

  const mistakeMap: Record<string, number> = {}
  filtered.flatMap(s => s.step_logs).flatMap((l: any) => l.mistakes || [])
    .forEach((m: string) => { mistakeMap[m] = (mistakeMap[m] || 0) + 1 })
  const topMistakes = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]).slice(0, 10)

  if (loading) return <div className={styles.loading}>⚡</div>

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      <div className={styles.inner}>
        <nav className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard/practical')}>← 홈</button>
          <h1 className={styles.pageTitle}>📊 통계</h1>
          <span className={styles.userName}>{user?.name}</span>
        </nav>

        <div className={styles.filterRow}>
          <button className={`${styles.filterBtn} ${!selectedProblem ? styles.filterActive : ''}`} onClick={() => setSelectedProblem(null)}>전체</button>
          {Array.from(new Set(sessions.map(s => s.problem_no))).sort((a, b) => a - b).map(no => (
            <button key={no} className={`${styles.filterBtn} ${selectedProblem === no ? styles.filterActive : ''}`} onClick={() => setSelectedProblem(no)}>{no}번</button>
          ))}
        </div>

        <div className={styles.tabRow}>
          {(['overview', 'steps', 'mistakes'] as const).map(t => (
            <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
              {t === 'overview' ? '전체 기록' : t === 'steps' ? '공정별 평균' : '실수 분석'}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <div className={styles.empty}>아직 훈련 기록이 없어요</div>}

        {/* 전체 탭 */}
        {tab === 'overview' && (
          <>
            {/* 수동 기록 추가 버튼 */}
            <button className={styles.addRecordBtn} onClick={openAddRecord}>+ 기록 수동 추가</button>

            {/* 수동 기록 입력 패널 */}
            {showAddRecord && (
              <div className={styles.addRecordBox}>
                <div className={styles.addRecordHeader}>
                  <span className={styles.editHint}>📝 훈련 기록 수동 추가</span>
                  <button className={styles.addRecordClose} onClick={() => setShowAddRecord(false)}>✕</button>
                </div>
                <div className={styles.editRow}>
                  <span className={styles.editName}>문제 번호</span>
                  <select className={styles.problemSelect} value={addProblemNo} onChange={e => setAddProblemNo(Number(e.target.value))}>
                    {Array.from({length: 18}, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}번 ({n <= 9 ? 'FLS' : 'LS'}형)</option>
                    ))}
                  </select>
                </div>
                {addLogs.map((l, j) => (
                  <div key={j} className={styles.editRow}>
                    <span className={styles.editName}>{l.name}</span>
                    <div className={styles.editTimeRow}>
                      <input type="number" min={0} value={l.min}
                        onChange={e => setAddLogs(prev => prev.map((x, i) => i === j ? { ...x, min: Number(e.target.value) } : x))}
                        className={styles.timeInput} />
                      <span className={styles.timeUnit}>분</span>
                      <input type="number" min={0} max={59} value={l.sec}
                        onChange={e => setAddLogs(prev => prev.map((x, i) => i === j ? { ...x, sec: Number(e.target.value) } : x))}
                        className={styles.timeInput} />
                      <span className={styles.timeUnit}>초</span>
                    </div>
                  </div>
                ))}
                <div className={styles.editTotal}>
                  총 합계: <strong>{fmtTime(addLogs.reduce((a, l) => a + l.min * 60 + l.sec, 0))}</strong>
                </div>
                <button className={styles.saveBtn} onClick={saveManualRecord} disabled={addSaving}>
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
                        onClick={() => openEdit(sess, 'time')}>⏱ 시간</button>
                      <button className={`${styles.editBtn} ${styles.reviewBtn} ${isOpen && editMode === 'review' ? styles.editBtnActive : ''}`}
                        onClick={() => openEdit(sess, 'review')}>
                        📝{hasMistakes ? ' ✓' : ''}
                      </button>
                      <button className={`${styles.editBtn} ${styles.photoBtn} ${hasPhoto ? styles.photoBtnHas : ''}`}
                        onClick={() => handlePhotoClick(sess.id, hasPhoto)}>
                        {uploading && photoSessId === sess.id ? '⏳' : hasPhoto ? '🖼️' : '📷'}
                      </button>
                    </div>
                  </div>

                  {/* 공정 칩 */}
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

                  {/* 열렸을 때: 사진 있음 */}
                  {isOpen && editMode === 'photo' && hasPhoto && (
                    <div className={styles.photoBox}>
                      <img src={photoUrls[sess.id]} alt="완성작" className={styles.photoImg} />
                      <div className={styles.photoBtns}>
                        <button className={styles.photoChange} onClick={() => { setPhotoSessId(sess.id); fileInputRef.current?.click() }}>🔄 사진 변경</button>
                        <button className={styles.photoDelete} onClick={() => deletePhoto(sess.id)}>🗑 삭제</button>
                      </div>
                    </div>
                  )}

                  {/* 열렸을 때: 사진 없음 */}
                  {isOpen && editMode === 'photo' && !hasPhoto && !uploading && (
                    <div className={styles.photoEmpty}>
                      <p>📷 사진을 선택해주세요</p>
                      <button className={styles.photoUploadBtn} onClick={() => fileInputRef.current?.click()}>갤러리에서 선택</button>
                    </div>
                  )}

                  {/* 시간 수정 패널 */}
                  {isOpen && editMode === 'time' && (
                    <div className={styles.editBox}>
                      <p className={styles.editHint}>⏱ 공정별 시간 수정</p>
                      {editLogs.map((l, j) => (
                        <div key={j} className={styles.editRow}>
                          <span className={styles.editName}>{l.name}</span>
                          <div className={styles.editTimeRow}>
                            <input type="number" min={0} value={Math.floor(l.elapsed / 60)}
                              onChange={e => updateTime(j, Number(e.target.value), l.elapsed % 60)}
                              className={styles.timeInput} />
                            <span className={styles.timeUnit}>분</span>
                            <input type="number" min={0} max={59} value={l.elapsed % 60}
                              onChange={e => updateTime(j, Math.floor(l.elapsed / 60), Number(e.target.value))}
                              className={styles.timeInput} />
                            <span className={styles.timeUnit}>초</span>
                          </div>
                        </div>
                      ))}
                      <div className={styles.editTotal}>총 합계: <strong>{fmtTime(editLogs.reduce((a, l) => a + l.elapsed, 0))}</strong></div>
                      <button className={styles.saveBtn} onClick={() => saveEdit(sess.id)} disabled={saving}>
                        {saving ? '저장 중...' : '✓ 저장'}
                      </button>
                    </div>
                  )}

                  {/* 반성 패널 */}
                  {isOpen && editMode === 'review' && (
                    <div className={styles.reviewBox}>
                      <p className={styles.editHint}>📝 훈련 반성{tagSaving ? ' — 태그 저장 중...' : ''}</p>
                      {editLogs.map((l, j) => {
                        const presets = stepTags[l.stepId] ?? []
                        const customInput = customTagInputs[j] ?? ''
                        const addCustomTag = () => {
                          if (!customInput.trim()) return
                          addTag(l.stepId, customInput.trim())
                          toggleMistake(j, customInput.trim())
                          setCustomTagInputs(prev => ({ ...prev, [j]: '' }))
                        }
                        return (
                          <div key={j} className={styles.reviewStep}>
                            <div className={styles.reviewStepName}>{l.name}</div>
                            <div className={styles.tagGrid}>
                              {presets.map((tag, k) => (
                                <div key={k} className={styles.tagWrap}>
                                  <button
                                    className={`${styles.tag} ${l.mistakes.includes(tag) ? styles.tagActive : ''}`}
                                    onClick={() => toggleMistake(j, tag)}>
                                    {tag}
                                  </button>
                                  <button className={styles.tagDel} onClick={() => removeTag(l.stepId, tag)}>✕</button>
                                </div>
                              ))}
                            </div>
                            <div className={styles.tagInputRow}>
                              <input
                                className={styles.tagInput}
                                placeholder="태그 추가..."
                                value={customInput}
                                onChange={e => setCustomTagInputs(prev => ({ ...prev, [j]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                              />
                              <button className={styles.tagAddBtn} onClick={addCustomTag}>+</button>
                            </div>
                            <textarea className={styles.memoInput} placeholder="추가 메모 (선택)"
                              value={(l as any).memo ?? ''} onChange={e => updateMemo(j, e.target.value)} rows={2} />
                          </div>
                        )
                      })}
                      <button className={styles.saveBtn} onClick={() => saveEdit(sess.id)} disabled={saving}>
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
        )}

        {/* 공정별 탭 */}
        {tab === 'steps' && filtered.length > 0 && (
          <div className={styles.stepStatList}>
            {stepAvg.map((s, i) => {
              const ratio = s.avg > 0 ? s.avg / s.target : 0
              const barColor = ratio > 1 ? 'var(--red)' : ratio > 0.85 ? 'var(--yellow)' : 'var(--green)'
              return (
                <div key={i} className={styles.stepStatCard}>
                  <div className={styles.stepStatTop}>
                    <span className={styles.stepStatName}>{s.name}</span>
                    <span className={styles.stepStatTimes}>
                      목표 {fmtTime(s.target)} | 평균{' '}
                      <span style={{ color: ratio > 1 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                        {s.avg ? fmtTime(s.avg) : '-'}
                      </span>
                    </span>
                  </div>
                  {s.avg > 0 && (
                    <div className={styles.bar}>
                      <div className={styles.barFill} style={{ width: `${Math.min(ratio * 100, 100)}%`, background: barColor }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 실수 탭 */}
        {tab === 'mistakes' && (
          <div className={styles.mistakeStatList}>
            {topMistakes.length === 0
              ? <div className={styles.empty}>기록된 실수가 없어요 🎉</div>
              : topMistakes.map(([m, cnt], i) => (
                <div key={i} className={styles.mistakeStatRow}>
                  <span className={styles.mistakeRank}>#{i + 1}</span>
                  <span className={styles.mistakeName}>{m}</span>
                  <div className={styles.mistakeBarWrap}>
                    <div className={styles.mistakeBar}>
                      <div className={styles.mistakeBarFill} style={{ width: `${(cnt / topMistakes[0][1]) * 100}%` }} />
                    </div>
                    <span className={styles.mistakeCnt}>{cnt}회</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </main>
  )
}

export default function StatsPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',fontSize:48}}>⚡</div>}>
      <StatsContent />
    </Suspense>
  )
}

