'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import styles from './familia.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'es'

interface Item {
  id: string
  phase_key: string      // 'meta' | 'phase1' | 'phase2' | 'phase3'
  category: string       // 'main_goal' | 'financial' | 'core_agreement' | 'young' | 'lucy' | 'couple' | 'scenario'
  scenario_id: string | null
  text_en: string
  text_es: string
  completed: boolean
  sort_order: number
}

interface Scenario {
  id: string
  label_en: string
  label_es: string
  color: string          // 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'
  sort_order: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = [
  { key: 'phase1', en: 'Phase 1 — Preparation',     es: 'Fase 1 — Preparación',    range: 'May – July', emoji: '🌱', accent: '#22c55e' },
  { key: 'phase2', en: 'Phase 2 — Reunion in Korea', es: 'Fase 2 — Reunión en Corea', range: 'Aug – Dec', emoji: '🏠', accent: '#60a5fa' },
]

const CATS = [
  { key: 'young',  en: 'Young',    es: 'Young',   emoji: '👨', varName: 'var(--young)'  },
  { key: 'lucy',   en: 'Lucy',     es: 'Lucy',    emoji: '👩', varName: 'var(--lucy)'   },
  { key: 'couple', en: 'Together', es: 'Juntos',  emoji: '🤝', varName: 'var(--couple)' },
]

const SC_COLORS: Record<string, string> = {
  green:  '#22c55e',
  yellow: '#facc15',
  red:    '#f87171',
  blue:   '#60a5fa',
  purple: '#a78bfa',
}

function display(item: Item, lang: Lang) {
  return lang === 'en' ? item.text_en : (item.text_es || item.text_en)
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────

function ItemRow({ item, lang, onToggle, onDelete, onUpdate }: {
  item: Item
  lang: Lang
  onToggle: (id: string, v: boolean) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, en: string, es: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const text = display(item, lang)

  function startEdit() {
    setVal(text)
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function save() {
    setEditing(false)
    const trimmed = val.trim()
    if (!trimmed || trimmed === text) return
    const newEn = lang === 'en' ? trimmed : item.text_en
    const newEs = lang === 'es' ? trimmed : item.text_es
    onUpdate(item.id, newEn, newEs)
  }

  return (
    <div className={styles.row}>
      <button
        className={`${styles.cb} ${item.completed ? styles.cbDone : ''}`}
        onClick={() => onToggle(item.id, !item.completed)}
      />
      {editing ? (
        <input
          ref={ref}
          className={styles.rowInput}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span
          className={`${styles.rowText} ${item.completed ? styles.done : ''}`}
          onClick={startEdit}
          title={lang === 'en' ? 'Click to edit' : 'Clic para editar'}
        >
          {text || <span className={styles.muted}>…</span>}
        </span>
      )}
      <button className={styles.del} onClick={() => onDelete(item.id)}>×</button>
    </div>
  )
}

// ─── AddRow ───────────────────────────────────────────────────────────────────

function AddRow({ onAdd, lang }: {
  onAdd: (en: string, es: string) => void
  lang: Lang
}) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  function open_() {
    setOpen(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  function submit() {
    const trimmed = val.trim()
    setOpen(false)
    setVal('')
    if (!trimmed) return
    // store the same text for both languages initially; user edits per-lang by switching toggle
    onAdd(trimmed, trimmed)
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={open_}>
        + {lang === 'en' ? 'add item' : 'agregar'}
      </button>
    )
  }

  return (
    <div className={styles.addRow}>
      <input
        ref={ref}
        className={styles.rowInput}
        value={val}
        placeholder={lang === 'en' ? 'New item… (Enter to save)' : 'Nuevo elemento… (Enter para guardar)'}
        onChange={e => setVal(e.target.value)}
        onBlur={submit}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') { setOpen(false); setVal('') }
        }}
      />
    </div>
  )
}

// ─── CategorySection ──────────────────────────────────────────────────────────

function CategorySection({ cat, items, lang, onToggle, onDelete, onUpdate, onAdd }: {
  cat: typeof CATS[0]
  items: Item[]
  lang: Lang
  onToggle: (id: string, v: boolean) => void
  onDelete:  (id: string) => void
  onUpdate:  (id: string, en: string, es: string) => void
  onAdd:     (en: string, es: string) => void
}) {
  const done = items.filter(i => i.completed).length
  return (
    <div className={styles.catSection}>
      <div className={styles.catHead} style={{ color: cat.varName }}>
        <span>{cat.emoji}</span>
        <span>{lang === 'en' ? cat.en : cat.es}</span>
        <span className={styles.catCount}>{done}/{items.length}</span>
      </div>
      {items.map(item => (
        <ItemRow
          key={item.id} item={item} lang={lang}
          onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}
        />
      ))}
      <AddRow onAdd={onAdd} lang={lang} />
    </div>
  )
}

// ─── PhaseCard ────────────────────────────────────────────────────────────────

function PhaseCard({ phase, items, lang, onToggle, onDelete, onUpdate, onAdd }: {
  phase: typeof PHASES[0]
  items: Item[]
  lang: Lang
  onToggle: (id: string, v: boolean) => void
  onDelete:  (id: string) => void
  onUpdate:  (id: string, en: string, es: string) => void
  onAdd:     (cat: string, en: string, es: string) => void
}) {
  const total = items.length
  const done  = items.filter(i => i.completed).length
  const pct   = total ? Math.round((done / total) * 100) : 0

  return (
    <div className={styles.phaseCard} style={{ '--accent': phase.accent } as React.CSSProperties}>
      <div className={styles.phaseHead}>
        <span className={styles.phaseEmoji}>{phase.emoji}</span>
        <div>
          <div className={styles.phaseTitle}>{lang === 'en' ? phase.en : phase.es}</div>
          <div className={styles.phaseRange}>{phase.range}</div>
        </div>
        <span className={styles.phasePct}>{pct}%</span>
      </div>

      <div className={styles.bar}>
        <div
          className={styles.barFill}
          style={{ width: `${pct}%`, background: phase.accent }}
        />
      </div>

      {CATS.map(cat => (
        <CategorySection
          key={cat.key}
          cat={cat}
          items={items.filter(i => i.category === cat.key)}
          lang={lang}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAdd={(en, es) => onAdd(cat.key, en, es)}
        />
      ))}
    </div>
  )
}

// ─── ScenarioCard ─────────────────────────────────────────────────────────────

function ScenarioCard({ sc, items, lang, onToggle, onDelete, onUpdate, onAdd, onDeleteScenario }: {
  sc: Scenario
  items: Item[]
  lang: Lang
  onToggle:         (id: string, v: boolean) => void
  onDelete:          (id: string) => void
  onUpdate:          (id: string, en: string, es: string) => void
  onAdd:             (en: string, es: string) => void
  onDeleteScenario:  () => void
}) {
  const color = SC_COLORS[sc.color] || '#9ca3af'
  const label = lang === 'en' ? sc.label_en : sc.label_es

  return (
    <div className={styles.scCard} style={{ '--sc-color': color } as React.CSSProperties}>
      <div className={styles.scHead}>
        <span className={styles.scLabel} style={{ color }}>{label}</span>
        <button
          className={styles.del}
          onClick={onDeleteScenario}
          title={lang === 'en' ? 'Delete scenario' : 'Eliminar escenario'}
        >×</button>
      </div>
      {items.map(item => (
        <ItemRow
          key={item.id} item={item} lang={lang}
          onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}
        />
      ))}
      <AddRow onAdd={onAdd} lang={lang} />
    </div>
  )
}

// ─── Phase3Card ───────────────────────────────────────────────────────────────

function Phase3Card({ scenarios, items, lang, onToggle, onDeleteItem, onUpdateItem, onAddItem, onAddScenario, onDeleteScenario }: {
  scenarios:        Scenario[]
  items:            Item[]
  lang:             Lang
  onToggle:         (id: string, v: boolean) => void
  onDeleteItem:      (id: string) => void
  onUpdateItem:      (id: string, en: string, es: string) => void
  onAddItem:         (scenId: string, en: string, es: string) => void
  onAddScenario:     (en: string, es: string, color: string) => void
  onDeleteScenario:  (id: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const inputRef = useRef<HTMLInputElement>(null)

  function openAdd() {
    setAdding(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function submitScenario() {
    const trimmed = newLabel.trim()
    setAdding(false)
    setNewLabel('')
    if (!trimmed) return
    onAddScenario(trimmed, trimmed, newColor)
  }

  return (
    <div className={styles.phase3Card}>
      <div className={styles.phase3Head}>
        <span style={{ fontSize: '1.4rem' }}>🔀</span>
        <div>
          <div className={styles.phaseTitle}>
            {lang === 'en' ? 'Phase 3 — Decision' : 'Fase 3 — Decisión'}
          </div>
          <div className={styles.phaseRange}>
            {lang === 'en' ? 'After December · choose your path' : 'Después de Diciembre · elige tu camino'}
          </div>
        </div>
      </div>

      <div className={styles.scenariosGrid}>
        {scenarios.map(sc => (
          <ScenarioCard
            key={sc.id}
            sc={sc}
            items={items.filter(i => i.scenario_id === sc.id)}
            lang={lang}
            onToggle={onToggle}
            onDelete={onDeleteItem}
            onUpdate={onUpdateItem}
            onAdd={(en, es) => onAddItem(sc.id, en, es)}
            onDeleteScenario={() => onDeleteScenario(sc.id)}
          />
        ))}

        {adding ? (
          <div className={styles.newScCard}>
            <input
              ref={inputRef}
              className={styles.rowInput}
              value={newLabel}
              placeholder={lang === 'en' ? 'Scenario name…' : 'Nombre del escenario…'}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitScenario()
                if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
              }}
            />
            <div className={styles.colorPicker}>
              {Object.entries(SC_COLORS).map(([k, v]) => (
                <button
                  key={k}
                  className={`${styles.colorDot} ${newColor === k ? styles.colorSelected : ''}`}
                  style={{ background: v }}
                  onClick={() => setNewColor(k)}
                  title={k}
                />
              ))}
            </div>
            <button className={styles.scSubmitBtn} onClick={submitScenario}>
              {lang === 'en' ? 'Add scenario' : 'Agregar escenario'}
            </button>
          </div>
        ) : (
          <button className={styles.addScenarioBtn} onClick={openAdd}>
            + {lang === 'en' ? 'add scenario' : 'agregar escenario'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MetaSection ──────────────────────────────────────────────────────────────

function MetaSection({ title, emoji, color, items, lang, onToggle, onDelete, onUpdate, onAdd }: {
  title: string
  emoji: string
  color: string
  items: Item[]
  lang: Lang
  onToggle: (id: string, v: boolean) => void
  onDelete:  (id: string) => void
  onUpdate:  (id: string, en: string, es: string) => void
  onAdd:     (en: string, es: string) => void
}) {
  return (
    <div className={styles.metaCard} style={{ '--meta-color': color } as React.CSSProperties}>
      <div className={styles.metaHeader}>
        <span>{emoji}</span>
        <span>{title}</span>
      </div>
      {items.map(item => (
        <ItemRow
          key={item.id} item={item} lang={lang}
          onToggle={onToggle} onDelete={onDelete} onUpdate={onUpdate}
        />
      ))}
      <AddRow onAdd={onAdd} lang={lang} />
    </div>
  )
}

// ─── CoreAgreement ────────────────────────────────────────────────────────────

function CoreAgreement({ items, lang, onToggle, onDelete, onUpdate, onAdd }: {
  items: Item[]
  lang: Lang
  onToggle: (id: string, v: boolean) => void
  onDelete:  (id: string) => void
  onUpdate:  (id: string, en: string, es: string) => void
  onAdd:     (en: string, es: string) => void
}) {
  return (
    <div className={styles.coreCard}>
      <div className={styles.coreHead}>
        ❤️ {lang === 'en' ? 'Core Agreement' : 'Acuerdo Fundamental'}
      </div>
      {items.map(item => (
        <div key={item.id} className={styles.row} style={{ alignItems: 'flex-start' }}>
          <span className={`${styles.rowText} ${styles.coreText} ${item.completed ? styles.done : ''}`}>
            {display(item, lang)}
          </span>
          <button className={styles.del} onClick={() => onDelete(item.id)}>×</button>
        </div>
      ))}
      <AddRow onAdd={onAdd} lang={lang} />
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function FamiliaRoadmap() {
  const [lang, setLang]           = useState<Lang>('en')
  const [items, setItems]         = useState<Item[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading]     = useState(true)

  const fetchAll = useCallback(async () => {
    const [{ data: scData }, { data: itData }] = await Promise.all([
      supabase.from('familia_scenarios').select('*').order('sort_order'),
      supabase.from('familia_items').select('*').order('sort_order'),
    ])
    setScenarios(scData || [])
    setItems(itData || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Item CRUD ────────────────────────────────────────────
  async function toggleItem(id: string, completed: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed } : i))
    await supabase.from('familia_items').update({ completed }).eq('id', id)
  }

  async function addItem(
    phase_key: string,
    category: string,
    text_en: string,
    text_es: string,
    scenario_id?: string,
  ) {
    const { data } = await supabase
      .from('familia_items')
      .insert({
        phase_key, category, text_en, text_es,
        scenario_id: scenario_id || null,
        completed: false,
        sort_order: items.length,
      })
      .select()
      .single()
    if (data) setItems(prev => [...prev, data as Item])
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('familia_items').delete().eq('id', id)
  }

  async function updateItem(id: string, text_en: string, text_es: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, text_en, text_es } : i))
    await supabase.from('familia_items').update({ text_en, text_es }).eq('id', id)
  }

  // ── Scenario CRUD ────────────────────────────────────────
  async function addScenario(label_en: string, label_es: string, color: string) {
    const { data } = await supabase
      .from('familia_scenarios')
      .insert({ label_en, label_es, color, sort_order: scenarios.length })
      .select()
      .single()
    if (data) setScenarios(prev => [...prev, data as Scenario])
  }

  async function deleteScenario(id: string) {
    setScenarios(prev => prev.filter(s => s.id !== id))
    setItems(prev => prev.filter(i => i.scenario_id !== id))
    await supabase.from('familia_scenarios').delete().eq('id', id)
  }

  // ── Helpers ─────────────────────────────────────────────
  const metaItems = (cat: string) =>
    items.filter(i => i.phase_key === 'meta' && i.category === cat)

  const phaseItems = (key: string) =>
    items.filter(i => i.phase_key === key && !i.scenario_id)

  // ── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.loading}>
        <span>loading familia…</span>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.inner}>

        {/* ── Header ─────────────────────────────────────── */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>❤️ Familia Choi · Arrieta</h1>
            <p className={styles.subtitle}>
              {lang === 'en' ? 'Our shared roadmap' : 'Nuestro camino compartido'} · 2026
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/familia/memorias" className={styles.langBtn} style={{ textDecoration: 'none' }}>
              🌹 Memorias
            </Link>
            <button
              className={styles.langBtn}
              onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            >
              {lang === 'en' ? '🇪🇸 Español' : '🇬🇧 English'}
            </button>
          </div>
        </header>

        {/* ── Goals + Financial ──────────────────────────── */}
        <div className={styles.metaRow}>
          <MetaSection
            title={lang === 'en' ? 'Core Goals' : 'Metas Principales'}
            emoji="🎯" color="var(--goals)"
            items={metaItems('main_goal')} lang={lang}
            onToggle={toggleItem}
            onAdd={(en, es) => addItem('meta', 'main_goal', en, es)}
            onDelete={deleteItem} onUpdate={updateItem}
          />
          <MetaSection
            title={lang === 'en' ? 'Financial Plan' : 'Plan Financiero'}
            emoji="💰" color="var(--finance)"
            items={metaItems('financial')} lang={lang}
            onToggle={toggleItem}
            onAdd={(en, es) => addItem('meta', 'financial', en, es)}
            onDelete={deleteItem} onUpdate={updateItem}
          />
        </div>

        {/* ── Phase 1 & 2 ────────────────────────────────── */}
        <div className={styles.phasesGrid}>
          {PHASES.map(phase => (
            <PhaseCard
              key={phase.key} phase={phase}
              items={phaseItems(phase.key)} lang={lang}
              onToggle={toggleItem} onDelete={deleteItem} onUpdate={updateItem}
              onAdd={(cat, en, es) => addItem(phase.key, cat, en, es)}
            />
          ))}
        </div>

        {/* ── Phase 3 — Decision ─────────────────────────── */}
        <Phase3Card
          scenarios={scenarios}
          items={items.filter(i => i.phase_key === 'phase3')}
          lang={lang}
          onToggle={toggleItem}
          onDeleteItem={deleteItem}
          onUpdateItem={updateItem}
          onAddItem={(scenId, en, es) => addItem('phase3', 'scenario', en, es, scenId)}
          onAddScenario={addScenario}
          onDeleteScenario={deleteScenario}
        />

        {/* ── Core Agreement ─────────────────────────────── */}
        <CoreAgreement
          items={metaItems('core_agreement')} lang={lang}
          onToggle={toggleItem}
          onAdd={(en, es) => addItem('meta', 'core_agreement', en, es)}
          onDelete={deleteItem} onUpdate={updateItem}
        />

      </div>
    </div>
  )
}
