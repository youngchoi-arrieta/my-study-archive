'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_STEPS, STORAGE_USER_KEY, fmtTime, type User, type Step, type StepLog } from '@/lib/constants-practical'
import DiagramViewer from '../DiagramViewer'
import styles from './page.module.css'

function TrainContent() {
  const router = useRouter()
  const params = useSearchParams()
  const problemNo = Number(params.get('problem') || 1)
  const resumeParam = params.get('resume') === '1'

  const [user, setUser] = useState<User | null>(null)
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [logs, setLogs] = useState<StepLog[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [showDiagrams, setShowDiagrams] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean[]>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const userRef = useRef<User | null>(null)

  const step = steps[currentIdx]
  const log = logs[currentIdx]
  const remaining = (step?.target ?? 0) - elapsed
  const isOver = remaining < 0
  const checkedCount = step ? (checkedItems[step.id]?.filter(Boolean).length ?? 0) : 0
  const totalCheck = step?.checklist.length ?? 0

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_USER_KEY)
    if (!saved) { router.replace('/dashboard/practical'); return }
    const u: User = JSON.parse(saved)
    setUser(u)
    userRef.current = u
    loadData(u.id)
  }, [])

  const loadData = async (userId: string) => {
    const { data: psData } = await supabase
      .from('problem_steps').select('steps').eq('user_id', userId).single()
    const loaded: Step[] = psData?.steps || DEFAULT_STEPS
    setSteps(loaded)

    const initChecked: Record<number, boolean[]> = {}
    loaded.forEach((s: Step) => { initChecked[s.id] = s.checklist.map(() => false) })
    setCheckedItems(initChecked)

    // 이어하기 모드면 draft 불러오기
    if (resumeParam) {
      const { data: draft } = await supabase
        .from('sessions_draft').select('*').eq('user_id', userId).eq('problem_no', problemNo).single()
      if (draft) {
        setCurrentIdx(draft.current_step)
        setTotalElapsed(draft.total_elapsed)
        setElapsed(draft.step_logs[draft.current_step]?.elapsed ?? 0)
        setLogs(draft.step_logs)
        return
      }
    }
    setLogs(loaded.map((s: Step) => ({ stepId: s.id, name: s.name, elapsed: 0, mistakes: [] })))
  }

  // 임시 저장
  const saveDraft = useCallback(async (exitAfter = false) => {
    const u = userRef.current
    if (!u) return
    const updatedLogs = logs.map((l, i) => i === currentIdx ? { ...l, elapsed } : l)
    await supabase.from('sessions_draft').upsert({
      user_id: u.id,
      problem_no: problemNo,
      current_step: currentIdx,
      total_elapsed: totalElapsed,
      step_logs: updatedLogs,
      updated_at: new Date().toISOString(),
    })
    if (exitAfter) router.replace(`/dashboard/practical/problem/${problemNo}`)
  }, [logs, currentIdx, elapsed, totalElapsed, problemNo])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => e + 1)
        setTotalElapsed(t => t + 1)
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const goToStep = useCallback((nextIdx: number, updatedLogs: StepLog[], nextElapsed: number) => {
    setLogs(updatedLogs)
    setCurrentIdx(nextIdx)
    setElapsed(nextElapsed)
    setRunning(true)
  }, [])

  const nextStep = useCallback(async () => {
    const updatedLogs = logs.map((l, i) => i === currentIdx ? { ...l, elapsed } : l)
    setRunning(false)
    if (currentIdx < steps.length - 1) {
      goToStep(currentIdx + 1, updatedLogs, updatedLogs[currentIdx + 1]?.elapsed ?? 0)
    } else {
      setLogs(updatedLogs)
      setSaving(true)
      // 정식 저장
      await supabase.from('sessions').insert({
        user_id: user!.id, problem_no: problemNo,
        total_time: totalElapsed, step_logs: updatedLogs,
      })
      // draft 삭제
      await supabase.from('sessions_draft').delete().eq('user_id', user!.id).eq('problem_no', problemNo)
      setSaving(false)
      router.replace(`/dashboard/practical/problem/${problemNo}`)
    }
  }, [currentIdx, elapsed, logs, steps, totalElapsed, user, problemNo, router, goToStep])

  const prevStep = useCallback(() => {
    if (currentIdx === 0) return
    const updatedLogs = logs.map((l, i) => i === currentIdx ? { ...l, elapsed } : l)
    setLogs(updatedLogs)
    setRunning(false)
    setCurrentIdx(i => i - 1)
    setElapsed(updatedLogs[currentIdx - 1]?.elapsed ?? 0)
  }, [currentIdx, elapsed, logs])

  const handleExit = useCallback(() => {
    setRunning(false)
    const choice = confirm('임시 저장하고 나갈까요?\n\n확인 = 임시 저장 후 나가기\n취소 = 저장 없이 나가기')
    if (choice) {
      saveDraft(true)
    } else {
      const u = userRef.current
      const deleteDraft = confirm('기존 임시 저장 기록을 삭제할까요?\n\n확인 = 삭제\n취소 = 유지')
      if (deleteDraft && u) {
        supabase.from('sessions_draft').delete().eq('user_id', u.id).eq('problem_no', problemNo)
      }
      router.replace(`/dashboard/practical/problem/${problemNo}`)
    }
  }, [saveDraft, problemNo, router])

  const toggleCheck = (stepId: number, idx: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [stepId]: prev[stepId].map((v, i) => i === idx ? !v : v)
    }))
  }

  const circumference = 2 * Math.PI * 110
  const strokeDash = circumference * (1 - Math.min(elapsed / (step?.target || 1), 1))
  const nextLabel = saving ? '저장 중...'
    : currentIdx < steps.length - 1 ? `다음 → ${steps[currentIdx + 1]?.name}`
    : '🏁 훈련 완료!'

  if (!step || !log) return <div className={styles.loading}>⚡</div>

  return (
    <main className={`${styles.main} ${isOver ? styles.mainOver : ''}`}>
      <header className={styles.topBar}>
        <button className={styles.exitBtn} onClick={handleExit}>✕</button>
        <div className={styles.progressDots}>
          {steps.map((s, i) => (
            <div key={i} className={`${styles.dot} ${i < currentIdx ? styles.dotDone : i === currentIdx ? styles.dotCurrent : ''}`} title={s.name} />
          ))}
        </div>
        <div className={styles.topRight}>
          <span className={styles.totalTimeLabel}>총 {fmtTime(totalElapsed)}</span>
          <button className={styles.diagramBtn} onClick={() => setShowDiagrams(true)}>📐 도면</button>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.leftCol}>
          <div className={styles.stepHeader}>
            <h1 className={styles.stepName}>Step {currentIdx + 1}. {step.name}</h1>
          </div>

          <div className={styles.timerWrap}>
            <svg className={styles.timerSvg} viewBox="0 0 240 240">
              <circle cx={120} cy={120} r={110} fill="none" stroke="var(--surface2)" strokeWidth={14} />
              <circle cx={120} cy={120} r={110} fill="none"
                stroke={isOver ? 'var(--red)' : 'var(--accent)'}
                strokeWidth={14}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDash}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
            </svg>
            <div className={styles.timerInner}>
              <span className={`${styles.timerDigit} ${isOver ? styles.timerOver : ''}`}>
                {fmtTime(elapsed)}
              </span>
              <span className={`${styles.remaining} ${isOver ? styles.remainingOver : ''}`}>
                {isOver ? `+${fmtTime(Math.abs(remaining))} 초과` : `남은 ${fmtTime(remaining)}`}
              </span>
            </div>
          </div>

          <button
            className={`${styles.playBtn} ${running ? styles.pauseBtn : styles.startBtn}`}
            onClick={() => setRunning(r => !r)}
          >
            {running ? '⏸ 일시정지' : '▶ 시작'}
          </button>

          <div className={styles.navBtns}>
            <button className={styles.prevBtn} onClick={prevStep} disabled={currentIdx === 0}>← 이전</button>
            <button className={styles.nextBtn} onClick={nextStep} disabled={saving}>{nextLabel}</button>
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.checkHeader}>
            <span>✅ 체크리스트</span>
            <span className={styles.checkCount}>{checkedCount} / {totalCheck}</span>
          </div>
          <div className={styles.checkList}>
            {step.checklist.map((item, i) => (
              <label key={i} className={styles.checkItem}>
                <input type="checkbox"
                  checked={checkedItems[step.id]?.[i] ?? false}
                  onChange={() => toggleCheck(step.id, i)}
                  className={styles.checkbox}
                />
                <span className={`${styles.checkLabel} ${checkedItems[step.id]?.[i] ? styles.checkDone : ''}`}>
                  {item}
                </span>
              </label>
            ))}
            {step.checklist.length === 0 && (
              <p className={styles.checkEmpty}>이 공정은 체크리스트가 없어요</p>
            )}
          </div>
        </div>
      </div>

      {showDiagrams && <DiagramViewer problemNo={problemNo} onClose={() => setShowDiagrams(false)} />}
    </main>
  )
}

export default function TrainPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',fontSize:48}}>⚡</div>}>
      <TrainContent />
    </Suspense>
  )
}
