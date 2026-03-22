'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DEFAULT_DISQUALIFY, STORAGE_USER_KEY, type User } from '@/lib/constants-practical'
import styles from './page.module.css'

export default function DisqualifyPage() {
  const router = useRouter()
  const [items, setItems] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_USER_KEY)
    if (!saved) { router.replace('/dashboard/practical'); return }
    const u: User = JSON.parse(saved)
    setUser(u)
    loadItems(u.id)
  }, [])

  const loadItems = async (userId: string) => {
    const { data } = await supabase
      .from('disqualify').select('items').eq('user_id', userId).single()
    if (data) {
      setItems(data.items)
    } else {
      // DB에 없으면 기본값 저장
      await supabase.from('disqualify').insert({ user_id: userId, items: DEFAULT_DISQUALIFY })
      setItems(DEFAULT_DISQUALIFY)
    }
    setLoading(false)
  }

  const saveItems = async (next: string[], userId: string) => {
    setItems(next)
    await supabase.from('disqualify').upsert({ user_id: userId, items: next, updated_at: new Date().toISOString() })
  }

  const add = () => {
    if (!input.trim() || !user) return
    saveItems([...items, input.trim()], user.id)
    setInput('')
  }

  const remove = (i: number) => {
    if (!user) return
    saveItems(items.filter((_, j) => j !== i), user.id)
  }

  const reset = () => {
    if (!user) return
    if (confirm('기본 목록으로 초기화할까요?')) saveItems(DEFAULT_DISQUALIFY, user.id)
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',fontSize:48}}>⚡</div>

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.inner}>
        <nav className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard/practical')}>← 홈</button>
          <h1 className={styles.title}>⚠️ 실격사유</h1>
          <button className={styles.resetBtn} onClick={reset}>초기화</button>
        </nav>

        <div className={styles.hint}>시험 중 이것만큼은 절대 하지 말 것!</div>

        <div className={styles.list}>
          {items.map((item, i) => (
            <div key={i} className={styles.item}>
              <span className={styles.bullet}>⚠</span>
              <span className={styles.text}>{item}</span>
              <button className={styles.delBtn} onClick={() => remove(i)}>✕</button>
            </div>
          ))}
        </div>

        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder="실격사유 직접 추가..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button className={styles.addBtn} onClick={add}>+</button>
        </div>
      </div>
    </main>
  )
}
