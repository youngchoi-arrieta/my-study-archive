'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FLS_PROBLEMS, LS_PROBLEMS, STORAGE_USER_KEY, DEFAULT_STEPS, type User, type Step } from '@/lib/constants-practical'
import styles from './page.module.css'

type EditTab = 'checklist' | 'tips'

export default function HomePage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [nameInput, setNameInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showStepSettings, setShowStepSettings] = useState(false)
  const [editSteps, setEditSteps] = useState<Step[]>(DEFAULT_STEPS)
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null)
  const [editTab, setEditTab] = useState<EditTab>('checklist')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_USER_KEY)
    if (saved) { try { setCurrentUser(JSON.parse(saved)) } catch {} }
    loadUsers()
  }, [])

  useEffect(() => {
    if (currentUser) loadSteps(currentUser.id)
  }, [currentUser])

  const loadUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data)
    setLoading(false)
  }

  const loadSteps = async (userId: string) => {
    const { data } = await supabase.from('problem_steps').select('steps').eq('user_id', userId).single()
    if (data?.steps) setEditSteps(data.steps)
    else setEditSteps(JSON.parse(JSON.stringify(DEFAULT_STEPS)))
  }

  const saveSteps = async (updated: Step[]) => {
    if (!currentUser) return
    setSaving(true)
    await supabase.from('problem_steps').upsert(
      { user_id: currentUser.id, steps: updated, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setEditSteps(updated)
    setSaving(false)
  }

  const loginAs = (user: User) => {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
    setCurrentUser(user)
    setEditMode(false)
  }

  const handleNewUser = async () => {
    const name = nameInput.trim()
    if (!name) return
    setSaving(true); setError('')
    let { data: existing } = await supabase.from('users').select('*').eq('name', name).single()
    if (!existing) {
      const { data: created, error: err } = await supabase.from('users').insert({ name }).select().single()
      if (err) { setError('저장 실패. 다시 시도해주세요.'); setSaving(false); return }
      existing = created
      setUsers(prev => [existing!, ...prev])
    }
    loginAs(existing!)
    setSaving(false); setNameInput('')
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`'${user.name}' 유저와 모든 기록을 삭제할까요?`)) return
    await supabase.from('users').delete().eq('id', user.id)
    setUsers(prev => prev.filter(u => u.id !== user.id))
    if (currentUser?.id === user.id) { localStorage.removeItem(STORAGE_USER_KEY); setCurrentUser(null) }
  }

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_USER_KEY)
    setCurrentUser(null); setEditMode(false)
  }

  // 공정 편집 헬퍼
  const updateListItem = (si: number, field: EditTab, ii: number, val: string) => {
    setEditSteps(prev => prev.map((s, i) => {
      if (i !== si) return s
      const arr = [...s[field]]; arr[ii] = val
      return { ...s, [field]: arr }
    }))
  }
  const removeListItem = (si: number, field: EditTab, ii: number) => {
    const updated = editSteps.map((s, i) => {
      if (i !== si) return s
      return { ...s, [field]: s[field].filter((_, j) => j !== ii) }
    })
    saveSteps(updated)
  }
  const addListItem = (si: number, field: EditTab) => {
    setEditSteps(prev => prev.map((s, i) => i !== si ? s : { ...s, [field]: [...s[field], ''] }))
  }
  const saveListItem = (si: number, field: EditTab, ii: number) => {
    const val = editSteps[si][field][ii].trim()
    if (!val) { removeListItem(si, field, ii); return }
    saveSteps(editSteps)
  }
  const updateTarget = (si: number, min: number, sec: number) => {
    const updated = editSteps.map((s, i) => i === si ? { ...s, target: min * 60 + sec } : s)
    saveSteps(updated)
  }

  if (loading) return <div className={styles.loading}>⚡</div>

  // 공정 설정 화면
  if (showStepSettings) {
    return (
      <main className={styles.main}>
        <div className={styles.bg} />
        <div className={styles.inner}>
          <nav className={styles.nav}>
            <button className={styles.backBtn} onClick={() => setShowStepSettings(false)}>← 뒤로</button>
            <span className={styles.navTitle}>공정 설정</span>
            <span className={styles.navSub}>전체 문제 공통 적용</span>
          </nav>

          <div className={styles.stepAccordion}>
            {editSteps.map((s, si) => (
              <div key={s.id} className={styles.stepItem}>
                <button
                  className={`${styles.stepItemHeader} ${editingStepIdx === si ? styles.stepItemHeaderOpen : ''}`}
                  onClick={() => setEditingStepIdx(editingStepIdx === si ? null : si)}
                >
                  <span className={styles.stepItemNum}>{si + 1}</span>
                  <span className={styles.stepItemName}>{s.name}</span>
                  <span className={styles.stepItemTarget}>{Math.floor(s.target / 60)}분 {s.target % 60 > 0 ? `${s.target % 60}초` : ''}</span>
                  <span className={styles.stepItemArrow}>{editingStepIdx === si ? '▲' : '▼'}</span>
                </button>

                {editingStepIdx === si && (
                  <div className={styles.stepItemBody}>
                    <div className={styles.editTabs}>
                      <button className={`${styles.editTab} ${editTab === 'checklist' ? styles.editTabActive : ''}`} onClick={() => setEditTab('checklist')}>⏱ 목표시간 · ✅ 체크리스트</button>
                      <button className={`${styles.editTab} ${editTab === 'tips' ? styles.editTabActive : ''}`} onClick={() => setEditTab('tips')}>💡 노하우</button>
                    </div>

                    {editTab === 'checklist' && (
                      <div className={styles.listEdit}>
                        <div className={styles.targetEdit}>
                          <span className={styles.targetLabel}>목표 시간</span>
                          <input type="number" min={0} value={Math.floor(s.target / 60)}
                            onChange={e => updateTarget(si, Number(e.target.value), s.target % 60)}
                            className={styles.timeInput} />
                          <span className={styles.timeUnit}>분</span>
                          <input type="number" min={0} max={59} value={s.target % 60}
                            onChange={e => updateTarget(si, Math.floor(s.target / 60), Number(e.target.value))}
                            className={styles.timeInput} />
                          <span className={styles.timeUnit}>초</span>
                        </div>
                        <div className={styles.divider} />
                        {s.checklist.map((item, ii) => (
                          <div key={ii} className={styles.listEditRow}>
                            <input className={styles.listInput} value={item}
                              onChange={e => updateListItem(si, 'checklist', ii, e.target.value)}
                              onBlur={() => saveListItem(si, 'checklist', ii)}
                              onKeyDown={e => e.key === 'Enter' && saveListItem(si, 'checklist', ii)}
                              placeholder="체크리스트 항목" />
                            <button className={styles.listDelBtn} onClick={() => removeListItem(si, 'checklist', ii)}>✕</button>
                          </div>
                        ))}
                        <button className={styles.addItemBtn} onClick={() => addListItem(si, 'checklist')}>+ 항목 추가</button>
                      </div>
                    )}

                    {editTab === 'tips' && (
                      <div className={styles.listEdit}>
                        {s.tips.map((item, ii) => (
                          <div key={ii} className={styles.listEditRow}>
                            <input className={styles.listInput} value={item}
                              onChange={e => updateListItem(si, 'tips', ii, e.target.value)}
                              onBlur={() => saveListItem(si, 'tips', ii)}
                              onKeyDown={e => e.key === 'Enter' && saveListItem(si, 'tips', ii)}
                              placeholder="노하우 내용" />
                            <button className={styles.listDelBtn} onClick={() => removeListItem(si, 'tips', ii)}>✕</button>
                          </div>
                        ))}
                        <button className={styles.addItemBtn} onClick={() => addListItem(si, 'tips')}>+ 항목 추가</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {saving && <p className={styles.savingNote}>저장 중...</p>}
        </div>
      </main>
    )
  }

  // 유저 선택 전 화면
  if (!currentUser) {
    return (
      <main className={styles.main}>
        <div className={styles.bg} />
        <div className={styles.inner}>
          <nav className={styles.nav}>
            <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>← 대시보드</button>
            <span />
          </nav>
          <header className={styles.header}>
            <div className={styles.badge}>⚡ 전기기능사 실기</div>
            <h1 className={styles.title}>실기 트레이너</h1>
            <p className={styles.sub}>공정별 타이머 · 실수 기록 · 도면 뷰어</p>
          </header>

          {users.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionRow}>
                <p className={styles.sectionLabel}>누구로 시작할까요?</p>
                <button className={styles.editModeBtn} onClick={() => setEditMode(p => !p)}>{editMode ? '완료' : '편집'}</button>
              </div>
              <div className={styles.userGrid}>
                {users.map(u => (
                  <div key={u.id} className={styles.userCardWrap}>
                    <button className={styles.userCard} onClick={() => !editMode && loginAs(u)}>
                      <span className={styles.userAvatar}>{u.name[0]}</span>
                      <span className={styles.userCardName}>{u.name}</span>
                    </button>
                    {editMode && <button className={styles.deleteUserBtn} onClick={() => deleteUser(u)}>✕</button>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={styles.newUserBox}>
            <p className={styles.sectionLabel}>{users.length > 0 ? '또는 새 이름으로 시작' : '이름을 입력하면 바로 시작!'}</p>
            <div className={styles.loginRow}>
              <input className={styles.nameInput} placeholder="이름 입력" value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleNewUser()}
                maxLength={20} autoFocus={users.length === 0} />
              <button className={styles.loginBtn} onClick={handleNewUser} disabled={saving}>{saving ? '...' : '시작 →'}</button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>
      </main>
    )
  }

  // 문제 선택 화면
  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.inner}>
        <nav className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>← 대시보드</button>
          <span />
        </nav>
        <header className={styles.header}>
          <div className={styles.badge}>⚡ 전기기능사 실기</div>
          <h1 className={styles.title}>실기 트레이너</h1>
        </header>

        <div className={styles.userRow}>
          <div className={styles.userNameWrap}>
            <span className={styles.userName}>👋 {currentUser.name}</span>
            <button className={styles.logoutBtn} onClick={handleLogout}>변경</button>
          </div>
          <div className={styles.userRowBtns}>
            <button className={styles.disqualifyBtn} onClick={() => router.push('/dashboard/practical/disqualify')}>⚠️ 실격사유</button>
            <button className={styles.commonNotesBtn} onClick={() => router.push('/dashboard/practical/common-notes')}>📋 공통사항</button>
            <button className={styles.settingsBtn} onClick={() => setShowStepSettings(true)}>⚙️ 공정 설정</button>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.groupHeader}>
            <span className={styles.groupBadge} style={{background:'#1e3a5f', color:'#60a5fa'}}>FLS형</span>
            <span className={styles.groupSub}>공개문제 1 ~ 9번</span>
          </div>
          <div className={styles.problemGrid}>
            {FLS_PROBLEMS.map(p => (
              <button key={p.no} className={styles.problemCard} onClick={() => router.push(`/dashboard/practical/problem/${p.no}`)}>
                <span className={styles.problemNo}>{p.no}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.groupHeader}>
            <span className={styles.groupBadge} style={{background:'#1a3324', color:'#4ade80'}}>LS형</span>
            <span className={styles.groupSub}>공개문제 10 ~ 18번</span>
          </div>
          <div className={styles.problemGrid}>
            {LS_PROBLEMS.map(p => (
              <button key={p.no} className={styles.problemCard} onClick={() => router.push(`/dashboard/practical/problem/${p.no}`)}>
                <span className={styles.problemNo}>{p.no}</span>
              </button>
            ))}
          </div>
        </section>

        <div className={styles.quickLinks}>
          <button className={styles.quickBtn} onClick={() => router.push('/dashboard/practical/stats')}>📊 전체 통계</button>
        </div>
      </div>
    </main>
  )
}
