'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_STEPS, STORAGE_USER_KEY, fmtTime, fmtTimeLabel, type User, type Session, type Step } from '@/lib/constants-practical'
import DiagramViewer from '../DiagramViewer'
import styles from './page.module.css'

export default function ProblemPage() {
  const router = useRouter()
  const params = useParams()
  const no = Number(params.id)

  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS)
  const [showDiagrams, setShowDiagrams] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftStep, setDraftStep] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_USER_KEY)
    if (!saved) { router.replace('/dashboard/practical'); return }
    const u: User = JSON.parse(saved)
    setUser(u)
    loadData(u.id)
  }, [no])

  const loadData = async (userId: string) => {
    const { data: sess } = await supabase
      .from('sessions').select('*')
      .eq('user_id', userId).eq('problem_no', no)
      .order('created_at', { ascending: false }).limit(20)
    if (sess) setSessions(sess)

    const { data: ps } = await supabase
      .from('problem_steps').select('steps')
      .eq('user_id', userId).single()
    if (ps?.steps) setSteps(ps.steps)

    // draft 확인
    const { data: draft } = await supabase
      .from('sessions_draft').select('current_step')
      .eq('user_id', userId).eq('problem_no', no).single()
    if (draft) { setHasDraft(true); setDraftStep(draft.current_step) }

    setLoading(false)
  }

  const deleteSession = async (id: string) => {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const totalTarget = steps.reduce((a, s) => a + s.target, 0)
  const bestTime = sessions.length ? Math.min(...sessions.map(s => s.total_time)) : null
  const avgTime = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.total_time, 0) / sessions.length) : null

  if (loading) return <div className={styles.loading}>⚡</div>

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.inner}>
        <nav className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard/practical')}>← 홈</button>
          <button className={styles.diagramBtn} onClick={() => setShowDiagrams(true)}>📐 도면</button>
        </nav>

        <header className={styles.header}>
          <div className={styles.problemBadge}>공개문제</div>
          <h1 className={styles.problemNo}>{no}번</h1>
        </header>

        <div className={styles.statsRow}>
          <div className={styles.statCard}><span className={styles.statIcon}>🎯</span><span className={styles.statValue}>{fmtTimeLabel(totalTarget)}</span><span className={styles.statLabel}>목표 시간</span></div>
          <div className={styles.statCard}><span className={styles.statIcon}>📋</span><span className={styles.statValue}>{sessions.length}회</span><span className={styles.statLabel}>누적 훈련</span></div>
          {bestTime !== null && <div className={styles.statCard}><span className={styles.statIcon}>🏆</span><span className={styles.statValue}>{fmtTime(bestTime)}</span><span className={styles.statLabel}>최고 기록</span></div>}
          {avgTime !== null && <div className={styles.statCard}><span className={styles.statIcon}>⌀</span><span className={styles.statValue}>{fmtTime(avgTime)}</span><span className={styles.statLabel}>평균 시간</span></div>}
        </div>

        <button className={styles.startBtn} onClick={() => router.push(`/dashboard/practical/train?problem=${no}`)}>▶ 훈련 시작</button>

        {hasDraft && (
          <button className={styles.resumeBtn} onClick={() => router.push(`/dashboard/practical/train?problem=${no}&resume=1`)}>
            ↩ 이어하기 — Step {draftStep + 1}에서 재개
          </button>
        )}

        {/* 공정별 목표시간 — 읽기 전용 (편집은 홈 > 공정 설정) */}
        <section className={styles.section}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>공정별 목표시간</h2>
            <button className={styles.linkBtn} onClick={() => router.push('/dashboard/practical')}>편집 →</button>
          </div>
          <div className={styles.stepList}>
            {steps.map((s, i) => (
              <div key={s.id} className={styles.stepRow}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span className={styles.stepRowName}>{s.name}</span>
                <span className={styles.stepTarget}>{fmtTimeLabel(s.target)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 최근 기록 */}
        {sessions.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionRow}>
              <h2 className={styles.sectionTitle}>최근 기록</h2>
              <button className={styles.linkBtn} onClick={() => router.push(`/stats?problem=${no}`)}>전체 보기 →</button>
            </div>
            <div className={styles.sessionList}>
              {sessions.slice(0, 5).map((sess, i) => {
                const over = sess.total_time > totalTarget
                return (
                  <div key={sess.id} className={styles.sessionRow}>
                    <span className={styles.sessNum}>#{sessions.length - i}</span>
                    <span className={styles.sessDate}>{new Date(sess.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    <span className={`${styles.sessTime} ${over ? styles.over : styles.ok}`}>{fmtTime(sess.total_time)}</span>
                    {sess.step_logs.some((l: any) => l.mistakes.length > 0) && <span className={styles.hasMistake}>실수</span>}
                    <button className={styles.deleteBtn} onClick={() => deleteSession(sess.id)}>🗑</button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
      {showDiagrams && <DiagramViewer problemNo={no} onClose={() => setShowDiagrams(false)} />}
    </main>
  )
}
