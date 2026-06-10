'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { STORAGE_USER_KEY, type User } from '@/lib/constants-practical'
import styles from './page.module.css'

type Category = 'all' | 'fls' | 'ls'

const CATEGORY_LABELS: Record<Category, string> = {
  all: '모든 공개도면 공통사항',
  fls: 'FLS 도면 공통사항',
  ls: 'LS 도면 공통사항',
}

const CATEGORY_COLORS: Record<Category, string> = {
  all: '#60a5fa',
  fls: '#34d399',
  ls: '#a78bfa',
}

type Items = Record<Category, string[]>
const DEFAULT_ITEMS: Items = { all: [], fls: [], ls: [] }

export default function CommonNotesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [items, setItems] = useState<Items>(DEFAULT_ITEMS)
  const [activeTab, setActiveTab] = useState<Category>('all')
  const [input, setInput] = useState('')
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
      .from('common_notes').select('items').eq('user_id', userId).single()
    if (data) {
      setItems(data.items)
    } else {
      await supabase.from('common_notes').insert({ user_id: userId, items: DEFAULT_ITEMS })
      setItems(DEFAULT_ITEMS)
    }
    setLoading(false)
  }

  const saveItems = async (next: Items) => {
    if (!user) return
    setItems(next)
    await supabase.from('common_notes').upsert({ user_id: user.id, items: next, updated_at: new Date().toISOString() })
  }

  const add = () => {
    if (!input.trim()) return
    const next = { ...items, [activeTab]: [...items[activeTab], input.trim()] }
    saveItems(next)
    setInput('')
  }

  const remove = (i: number) => {
    const next = { ...items, [activeTab]: items[activeTab].filter((_, j) => j !== i) }
    saveItems(next)
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',fontSize:48,background:'#050d1a'}}>⚡</div>

  const color = CATEGORY_COLORS[activeTab]

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.inner}>
        <nav className={styles.nav}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard/practical')}>← 홈</button>
          <h1 className={styles.title}>📋 공통사항</h1>
          <div />
        </nav>

        {/* 카테고리 탭 */}
        <div className={styles.tabRow}>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
            <button key={cat}
              className={`${styles.tab} ${activeTab === cat ? styles.tabActive : ''}`}
              style={activeTab === cat ? { borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] } : {}}
              onClick={() => { setActiveTab(cat); setInput('') }}>
              {cat === 'all' ? '공통' : cat === 'fls' ? 'FLS' : 'LS'}
              {items[cat].length > 0 && <span className={styles.badge}>{items[cat].length}</span>}
            </button>
          ))}
        </div>

        <div className={styles.categoryLabel} style={{ color }}>
          {CATEGORY_LABELS[activeTab]}
        </div>

        <div className={styles.list}>
          {items[activeTab].length === 0
            ? <div className={styles.empty}>아직 항목이 없어요. 아래에서 추가해보세요!</div>
            : items[activeTab].map((item, i) => (
              <div key={i} className={styles.item} style={{ borderLeftColor: color }}>
                <span className={styles.bullet} style={{ color }}>▸</span>
                <span className={styles.text}>{item}</span>
                <button className={styles.delBtn} onClick={() => remove(i)}>✕</button>
              </div>
            ))
          }
        </div>

        <div className={styles.inputRow}>
          <input
            className={styles.input}
            style={{ '--focus-color': color } as any}
            placeholder={`${CATEGORY_LABELS[activeTab]} 추가...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button className={styles.addBtn} style={{ background: color }} onClick={add}>+</button>
        </div>
      </div>
    </main>
  )
}
