'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from './familia.module.css'

type Lang = 'en' | 'es'

export default function FamiliaHub() {
  const [lang, setLang] = useState<Lang>('en')

  const cards = [
    {
      href: '/familia/memorias',
      emoji: '🌹',
      title: 'Memorias',
      sub: lang === 'en' ? 'Our moments together' : 'Nuestros momentos juntos',
      accent: 'var(--lucy)',
    },
    {
      href: '/lifeops',
      emoji: '📊',
      title: 'Life Ops',
      sub: lang === 'en' ? 'Daily log · budget · roadmap' : 'Registro · presupuesto · plan',
      accent: 'var(--finance)',
    },
  ]

  return (
    <div className={styles.root}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>❤️ Familia Choi · Arrieta</h1>
            <p className={styles.subtitle}>
              {lang === 'en' ? 'Our shared space' : 'Nuestro espacio compartido'} · 2026
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/" className={styles.langBtn} style={{ textDecoration: 'none' }}>
              🏠 {lang === 'en' ? 'Home' : 'Inicio'}
            </Link>
            <button className={styles.langBtn} onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}>
              {lang === 'en' ? '🇪🇸 Español' : '🇬🇧 English'}
            </button>
          </div>
        </header>

        <div className={styles.hubGrid}>
          {cards.map(c => (
            <Link key={c.href} href={c.href} className={styles.hubCard}
              style={{ textDecoration: 'none', borderTop: `3px solid ${c.accent}` }}>
              <span className={styles.hubEmoji}>{c.emoji}</span>
              <span className={styles.hubTitle}>{c.title}</span>
              <span className={styles.hubSub}>{c.sub}</span>
            </Link>
          ))}
        </div>

        <p className={styles.hubHint}>
          {lang === 'en'
            ? 'The long-term roadmap now lives inside Life Ops → Roadmap.'
            : 'El plan a largo plazo ahora está en Life Ops → Plan.'}
        </p>
      </div>
    </div>
  )
}
