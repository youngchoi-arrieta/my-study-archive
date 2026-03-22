'use client'

import { useState } from 'react'
import type { Problem, ColElement, ContactType, BlankValue } from '@/types/trainer'
import { getContactSvg, symMCCB, symMotor, symEOCR, symCoil, CONTACT_LABELS, DEVICE_LABELS } from '@/lib/trainer/symbols'

const CONTACT_TYPES: { type: ContactType; label: string }[] = [
  { type: 'NO',  label: 'A접점 (NO)' },
  { type: 'NC',  label: 'B접점 (NC)' },
  { type: 'tNO', label: '한시 a접점' },
  { type: 'tNC', label: '한시 b접점' },
]

function VWire({ h = 10 }: { h?: number }) {
  return <div style={{ width: 2, height: h, background: '#4b5563', margin: '0 auto', flexShrink: 0 }} />
}
function HWire({ w = 12 }: { w?: number }) {
  return <div style={{ height: 2, width: w, background: '#4b5563', flexShrink: 0 }} />
}

function FixedEl({ sym, label }: { sym: string; label: string }) {
  const svgMap: Record<string, string> = {
    mccb: symMCCB(), motor: symMotor(), eocr_body: symEOCR(), coil: symCoil(),
    NO: getContactSvg('NO'), NC: getContactSvg('NC'),
    tNO: getContactSvg('tNO'), tNC: getContactSvg('tNC'),
  }
  return (
    <div className="flex flex-col items-center" style={{ width: 56, color: '#e5e7eb' }}>
      <div className="text-gray-400 mb-0.5 whitespace-nowrap" style={{ fontSize: 9, fontWeight: 500 }}>{label}</div>
      <div dangerouslySetInnerHTML={{ __html: svgMap[sym] ?? '' }} />
    </div>
  )
}

function BlankEl({ blankId, label, answer, answers, checked, selected, onClick }: {
  blankId: string; label: string; answer: { type: ContactType; label: string }
  answers: Record<string, BlankValue>; checked: boolean; selected: boolean; onClick: () => void
}) {
  const val = answers[blankId]
  let border = '1.5px dashed #4b5563'
  let bg = '#1f2937'
  if (selected) { border = '1.5px dashed #34d399'; bg = '#064e3b' }
  if (checked && val) {
    const ok = val.type === answer.type && val.label === answer.label
    border = ok ? '1.5px solid #34d399' : '1.5px solid #f87171'
    bg = ok ? '#064e3b' : '#450a0a'
  }

  return (
    <div className="flex flex-col items-center" style={{ width: 56, color: '#e5e7eb' }}>
      <div className="mb-0.5 whitespace-nowrap" style={{ fontSize: 9, color: val ? '#9ca3af' : '#6b7280' }}>
        {val ? val.label : label}
      </div>
      <div onClick={onClick} style={{
        width: 44, height: 32, border, borderRadius: 5, background: bg,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
      }}>
        {val
          ? <div dangerouslySetInnerHTML={{ __html: getContactSvg(val.type) }} style={{ color: '#e5e7eb' }} />
          : <span style={{ fontSize: 18, color: '#4b5563' }}>+</span>
        }
      </div>
      {val && <div style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>{CONTACT_LABELS[val.type]}</div>}
    </div>
  )
}

function ParallelEl({ branches, answers, checked, selBlank, onClickBlank }: {
  branches: ColElement[][]; answers: Record<string, BlankValue>
  checked: boolean; selBlank: string | null; onClickBlank: (id: string) => void
}) {
  return (
    <div className="flex flex-col items-center">
      <VWire h={8} />
      <div className="flex items-stretch">
        <div style={{ width: 2, background: '#4b5563', alignSelf: 'stretch' }} />
        <div className="flex flex-col gap-1">
          {branches.map((branch, bi) => (
            <div key={bi} className="flex items-center">
              <HWire w={10} />
              {branch.map((el, ei) => (
                <ElRenderer key={ei} el={el} answers={answers} checked={checked} selBlank={selBlank} onClickBlank={onClickBlank} />
              ))}
              <HWire w={10} />
            </div>
          ))}
        </div>
        <div style={{ width: 2, background: '#4b5563', alignSelf: 'stretch' }} />
      </div>
      <VWire h={8} />
    </div>
  )
}

function ElRenderer({ el, answers, checked, selBlank, onClickBlank }: {
  el: ColElement; answers: Record<string, BlankValue>
  checked: boolean; selBlank: string | null; onClickBlank: (id: string) => void
}) {
  if (el.kind === 'fixed') return <><VWire h={8} /><FixedEl sym={el.sym} label={el.label} /><VWire h={8} /></>
  if (el.kind === 'blank') return (
    <><VWire h={8} />
      <BlankEl blankId={el.blankId} label={el.label} answer={el.answer}
        answers={answers} checked={checked} selected={selBlank === el.blankId}
        onClick={() => onClickBlank(el.blankId)} />
      <VWire h={8} /></>
  )
  if (el.kind === 'parallel') return <ParallelEl branches={el.branches} answers={answers} checked={checked} selBlank={selBlank} onClickBlank={onClickBlank} />
  return null
}

interface Props {
  problem: Problem
  answers: Record<string, BlankValue>
  setAnswers: (a: Record<string, BlankValue>) => void
  checked: boolean
}

export default function CircuitEditor({ problem, answers, setAnswers, checked }: Props) {
  const [selBlank, setSelBlank] = useState<string | null>(null)
  const [selType, setSelType] = useState<ContactType | null>(null)
  const step = selBlank ? (selType ? 'label' : 'type') : null

  const clickBlank = (id: string) => { if (checked) return; setSelBlank(id); setSelType(null) }
  const pickType = (t: ContactType) => setSelType(t)
  const pickLabel = (label: string) => {
    if (!selBlank || !selType) return
    setAnswers({ ...answers, [selBlank]: { type: selType, label } })
    setSelBlank(null); setSelType(null)
  }

  const renderSection = (cols: typeof problem.main_circuit, sectionLabel: string, color: string) => (
    <div className="flex flex-col">
      <div className="text-xs font-medium mb-1 px-2 py-0.5 rounded self-start" style={{ color, background: color + '22', fontSize: 9 }}>
        {sectionLabel}
      </div>
      <div className="flex gap-1">
        {cols.map(col => (
          <div key={col.id} className="flex flex-col items-center">
            <div className="text-center mb-1 whitespace-pre-line leading-tight" style={{ fontSize: 9, color: '#6b7280' }}>
              {col.colLabel}
            </div>
            <VWire h={6} />
            {col.elements.map((el, i) => (
              <ElRenderer key={i} el={el} answers={answers} checked={checked} selBlank={selBlank} onClickBlank={clickBlank} />
            ))}
            <VWire h={6} />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 캔버스 */}
      <div className="flex-1 overflow-auto p-4 bg-gray-950" style={{ color: '#e5e7eb' }}>
        <div className="inline-flex flex-col" style={{ minWidth: '100%' }}>
          {/* L1 상단 모선 */}
          <div className="flex items-center" style={{ paddingLeft: 48 }}>
            <div className="font-bold mr-2" style={{ fontSize: 11, color: '#e5e7eb', width: 20 }}>L1</div>
            <div className="flex-1 rounded-sm" style={{ height: 3, background: '#e5e7eb' }} />
          </div>

          <div className="flex items-start gap-3" style={{ paddingLeft: 48 }}>
            {renderSection(problem.main_circuit, '주회로', '#60a5fa')}
            <div style={{ width: 1, background: '#374151', alignSelf: 'stretch', margin: '0 4px' }} />
            {renderSection(problem.aux_circuit, '보조회로', '#34d399')}
          </div>

          {/* L2 하단 모선 */}
          <div className="flex items-center" style={{ paddingLeft: 48 }}>
            <div className="font-bold mr-2" style={{ fontSize: 11, color: '#e5e7eb', width: 20 }}>L2</div>
            <div className="flex-1 rounded-sm" style={{ height: 3, background: '#e5e7eb' }} />
          </div>
        </div>
      </div>

      {/* 팔레트 */}
      <div className="border-t border-gray-800 bg-gray-900 p-3">
        {!selBlank && (
          <p className="text-gray-500 text-xs">빈칸(+)을 클릭해 선택하세요</p>
        )}
        {selBlank && step === 'type' && (
          <>
            <p className="text-gray-400 text-xs font-medium mb-2">① 접점 종류 선택</p>
            <div className="flex gap-2 flex-wrap">
              {CONTACT_TYPES.map(({ type, label }) => (
                <button key={type} onClick={() => pickType(type)}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-gray-700 hover:border-emerald-500 hover:bg-emerald-950 transition-all bg-gray-800"
                  style={{ color: '#e5e7eb' }}>
                  <div dangerouslySetInnerHTML={{ __html: getContactSvg(type) }} />
                  <span style={{ fontSize: 9 }}>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {selBlank && step === 'label' && (
          <>
            <p className="text-gray-400 text-xs font-medium mb-2">② 기호 선택</p>
            <div className="flex gap-2 flex-wrap">
              {DEVICE_LABELS.map(l => (
                <button key={l} onClick={() => pickLabel(l)}
                  className="px-3 py-1 rounded-full border border-gray-700 hover:border-emerald-500 hover:bg-emerald-950 transition-all text-gray-300 bg-gray-800"
                  style={{ fontSize: 11 }}>
                  {l}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
