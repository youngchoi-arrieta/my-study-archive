'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_STEPS, STEP_MISTAKE_PRESETS, STORAGE_USER_KEY, fmtTime, type User, type Session, type StepLog, type Step } from '@/lib/constants-practical'
import styles from './page.module.css'
import OverviewTab from './components/OverviewTab'
import StepsTab from './components/StepsTab'
import MistakesTab from './components/MistakesTab'

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
  const [userSteps, setUserSteps] = useState<Step[]>(DEFAULT_STEPS)
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [addProblemNo, setAddProblemNo] = useState(16)
  const [addLogs, setAddLogs] = useState<{ name: string; stepId: number; min: number; sec: number }[]>([])
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
    saveStepTags({ ...stepTags, [stepId]: (stepTags[stepId] ?? []).filter(t => t !== tag) }, user.id)
  }

  const loadSessions = async (userId: string) => {
    const { data } = await supabase
      .from('sessions').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!data) { setLoading(false); return }
    setSessions(data)
    const urls: Record<string, string> = {}
    for (const sess of data) {
      const path = `${userId}/${sess.id}.jpg`
      const { data: fileData } = await supabase.storage.from('session-photos').list(userId, { search: `${sess.id}.jpg` })
      if (fileData && fileData.length > 0) {
        const { data: urlData } = supabase.storage.from('session-photos').getPublicUrl(path)
        urls[sess.id] = urlData.publicUrl
      }
    }
    setPhotoUrls(urls)
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
    if (editMode === 'time') updateData.total_time = editLogs.reduce((a, l) => a + l.elapsed, 0)
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
    if (!hasPhoto) setTimeout(() => fileInputRef.current?.click(), 100)
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
    await supabase.storage.from('session-photos').remove([`${user.id}/${sessId}.jpg`])
    setPhotoUrls(prev => { const n = { ...prev }; delete n[sessId]; return n })
  }

  // ── 파생 데이터 (useMemo) ──────────────────────────────────────
  const filtered = useMemo(
    () => selectedProblem ? sessions.filter(s => s.problem_no === selectedProblem) : sessions,
    [sessions, selectedProblem]
  )

  const totalTarget = useMemo(() => userSteps.reduce((a, s) => a + s.target, 0), [userSteps])

  const stepAvg = useMemo(() => userSteps.map(step => {
    const times = filtered
      .flatMap(s => s.step_logs)
      .filter((l: any) => l.stepId === step.id)
      .map((l: any) => l.elapsed)
      .filter(Boolean)
    return { ...step, avg: times.length ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0 }
  }), [filtered, userSteps])

  const topMistakes = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.flatMap(s => s.step_logs).flatMap((l: any) => l.mistakes || [])
      .forEach((m: string) => { map[m] = (map[m] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [filtered])

  const problemNos = useMemo(
    () => Array.from(new Set(sessions.map(s => s.problem_no))).sort((a, b) => a - b),
    [sessions]
  )

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
          {problemNos.map(no => (
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

        {tab === 'overview' && (
          <OverviewTab
            filtered={filtered} totalTarget={totalTarget} userSteps={userSteps}
            openSession={openSession} editMode={editMode} editLogs={editLogs}
            saving={saving} tagSaving={tagSaving} stepTags={stepTags}
            customTagInputs={customTagInputs} photoUrls={photoUrls}
            uploading={uploading} photoSessId={photoSessId}
            showAddRecord={showAddRecord} addProblemNo={addProblemNo}
            addLogs={addLogs} addSaving={addSaving}
            onOpenEdit={openEdit} onUpdateTime={updateTime}
            onToggleMistake={toggleMistake} onUpdateMemo={updateMemo}
            onSaveEdit={saveEdit} onPhotoClick={handlePhotoClick}
            onFileChange={handleFileChange} onDeletePhoto={deletePhoto}
            onAddTag={addTag} onRemoveTag={removeTag}
            onSetCustomTagInputs={setCustomTagInputs}
            onOpenAddRecord={openAddRecord} onSetShowAddRecord={setShowAddRecord}
            onSetAddProblemNo={setAddProblemNo} onSetAddLogs={setAddLogs}
            onSaveManualRecord={saveManualRecord}
          />
        )}

        {tab === 'steps' && <StepsTab filtered={filtered} stepAvg={stepAvg} />}
        {tab === 'mistakes' && <MistakesTab topMistakes={topMistakes} />}
      </div>
    </main>
  )
}

export default function StatsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', fontSize: 48, background: '#050d1a' }}>⚡</div>}>
      <StatsContent />
    </Suspense>
  )
}
