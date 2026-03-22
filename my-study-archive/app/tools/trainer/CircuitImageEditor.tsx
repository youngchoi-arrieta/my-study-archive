'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ContactType, BlankValue } from '@/types/trainer'
import { getContactSvg, CONTACT_LABELS, DEVICE_LABELS } from '@/lib/trainer/symbols'

// ── 빈칸 정의 (% 좌표 기반) ──────────────────
interface BlankDef {
  id: string
  label: string
  x: number   // left %
  y: number   // top %
  w: number   // width %
  h: number   // height %
  answer: { type: ContactType; label: string }
}

// ── 001-A 도면 blank 위치 ────────────────────
// 도면 이미지(1002×576)를 기준으로 퍼센트 좌표
// 조정이 필요하면 x, y 값만 수정하면 됨
export const BLANKS_001A: BlankDef[] = [
  { id:'b-eocr-nc',   label:'EOCR?',    x:7.5,  y:12.5, w:4.2, h:7.0, answer:{type:'NC', label:'EOCR'} },
  { id:'b-eocr-fr',   label:'EOCR?',    x:7.5,  y:33.5, w:4.2, h:7.0, answer:{type:'NO', label:'EOCR'} },
  { id:'b-fr-bz',     label:'FR?',      x:19.5, y:47.5, w:4.2, h:7.0, answer:{type:'NO', label:'FR'} },
  { id:'b-fr-yl',     label:'FR?',      x:15.5, y:47.5, w:4.2, h:7.0, answer:{type:'NC', label:'FR'} },
  { id:'b-fls',       label:'FLS?',     x:42.0, y:42.0, w:4.2, h:7.0, answer:{type:'NO', label:'FLS'} },
  { id:'b-pb0',       label:'PB0?',     x:50.5, y:25.5, w:4.2, h:7.0, answer:{type:'NC', label:'PB0'} },
  { id:'b-pb1',       label:'PB1?',     x:56.5, y:42.0, w:4.2, h:7.0, answer:{type:'NO', label:'PB1'} },
  { id:'b-t-contact', label:'T한시?',   x:62.0, y:42.0, w:4.2, h:7.0, answer:{type:'tNO',label:'T'} },
  { id:'b-x-contact', label:'X?',       x:50.5, y:56.5, w:4.2, h:7.0, answer:{type:'NO', label:'X'} },
  { id:'b-t-mc2',     label:'T한시?',   x:74.5, y:56.5, w:4.2, h:7.0, answer:{type:'tNO',label:'T'} },
  { id:'b-mc1-rl',    label:'MC1?',     x:81.5, y:56.5, w:4.2, h:7.0, answer:{type:'NO', label:'MC1'} },
  { id:'b-mc2-gl',    label:'MC2?',     x:88.5, y:56.5, w:4.2, h:7.0, answer:{type:'NO', label:'MC2'} },
]

const CONTACT_TYPES: { type: ContactType; label: string }[] = [
  { type:'NO',  label:'A접점 (NO)' },
  { type:'NC',  label:'B접점 (NC)' },
  { type:'tNO', label:'한시 a접점' },
  { type:'tNC', label:'한시 b접점' },
]

interface Props {
  answers: Record<string, BlankValue>
  setAnswers: (a: Record<string, BlankValue>) => void
  checked: boolean
}

export default function CircuitImageEditor({ answers, setAnswers, checked }: Props) {
  const [selBlank, setSelBlank] = useState<string | null>(null)
  const [selType, setSelType] = useState<ContactType | null>(null)
  const step = selBlank ? (selType ? 'label' : 'type') : null

  const clickBlank = (id: string) => {
    if (checked) return
    setSelBlank(id)
    setSelType(null)
  }

  const pickType = (t: ContactType) => setSelType(t)

  const pickLabel = (label: string) => {
    if (!selBlank || !selType) return
    setAnswers({ ...answers, [selBlank]: { type: selType, label } })
    setSelBlank(null)
    setSelType(null)
  }

  const getBlankStyle = (b: BlankDef) => {
    const val = answers[b.id]
    const isSel = selBlank === b.id
    let border = '1.5px dashed #34d399'
    let bg = 'rgba(0,20,10,0.75)'

    if (isSel) { border = '2px solid #34d399'; bg = 'rgba(0,60,30,0.9)' }
    if (checked && val) {
      const ok = val.type === b.answer.type && val.label === b.answer.label
      border = ok ? '2px solid #4ade80' : '2px solid #f87171'
      bg = ok ? 'rgba(0,60,0,0.85)' : 'rgba(80,0,0,0.85)'
    }
    if (checked && !val) {
      border = '2px solid #f87171'
      bg = 'rgba(80,0,0,0.7)'
    }

    return {
      position: 'absolute' as const,
      left: `${b.x}%`, top: `${b.y}%`,
      width: `${b.w}%`, height: `${b.h}%`,
      border, background: bg,
      borderRadius: 3,
      cursor: checked ? 'default' : 'pointer',
      display: 'flex', flexDirection: 'column' as const,
      alignItems: 'center', justifyContent: 'center',
      transition: 'all .15s',
      zIndex: 10,
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 도면 이미지 + overlay */}
      <div className="flex-1 overflow-auto bg-white" style={{ minHeight: 0 }}>
        <div style={{ position: 'relative', display: 'inline-block', minWidth: '100%' }}>
          <Image
            src="/problems/001-A.png"
            alt="전기기능사 001-A 시퀀스 회로도"
            width={1002}
            height={576}
            style={{ display: 'block', width: '100%', height: 'auto' }}
            priority
          />

          {/* Blank overlays */}
          {BLANKS_001A.map(b => {
            const val = answers[b.id]
            return (
              <div
                key={b.id}
                style={getBlankStyle(b)}
                onClick={() => clickBlank(b.id)}
                title={b.label}
              >
                {val ? (
                  <>
                    <div
                      dangerouslySetInnerHTML={{ __html: getContactSvg(val.type) }}
                      style={{ color: '#34d399', transform: 'scale(0.55)', transformOrigin: 'center' }}
                    />
                    <div style={{ fontSize: 7, color: '#34d399', fontWeight: 600, lineHeight: 1, marginTop: -2 }}>
                      {val.label}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 9, color: '#34d399', fontWeight: 600 }}>?</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 팔레트 */}
      <div className="border-t border-gray-800 bg-gray-900 p-3 flex-shrink-0">
        {!selBlank && (
          <p className="text-gray-500 text-xs">도면의 빈칸(?)을 클릭하세요</p>
        )}
        {selBlank && step === 'type' && (
          <>
            <p className="text-gray-400 text-xs font-medium mb-2">
              ① 접점 종류 선택
              <span className="text-gray-600 ml-2">
                ({BLANKS_001A.find(b => b.id === selBlank)?.label})
              </span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {CONTACT_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => pickType(type)}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-gray-700 hover:border-emerald-500 hover:bg-emerald-950 transition-all bg-gray-800"
                  style={{ color: '#e5e7eb' }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: getContactSvg(type) }}
                    style={{ color: '#e5e7eb' }}
                  />
                  <span style={{ fontSize: 9 }}>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {selBlank && step === 'label' && (
          <>
            <p className="text-gray-400 text-xs font-medium mb-2">
              ② 기호 선택
              <span className="text-emerald-600 ml-2">
                {CONTACT_LABELS[selType!]} 선택됨
              </span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {DEVICE_LABELS.map(l => (
                <button
                  key={l}
                  onClick={() => pickLabel(l)}
                  className="px-3 py-1 rounded-full border border-gray-700 hover:border-emerald-500 hover:bg-emerald-950 transition-all text-gray-300 bg-gray-800"
                  style={{ fontSize: 11 }}
                >
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
