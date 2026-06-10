'use client'

import { useState } from 'react'
import styles from './DiagramViewer.module.css'

interface Props {
  problemNo: number
  onClose: () => void
}

// 문제당 도면 슬롯 4개 (이미지 파일은 /public/diagrams/문제번호_슬롯번호.jpg 로 넣으면 됨)
// 1_1.jpg = 1번 문제 배관 및 기구 배치도, 1_2.jpg = 제어판 내부 기구 배치도 ...
const DIAGRAM_LABELS = ['배관 및 기구 배치도', '제어판 내부 기구 배치도', '시퀀스 회로도', '기구 내부 결선도 및 구성도']

export default function DiagramViewer({ problemNo, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0)

  const imgSrc = `/diagrams/${problemNo}_${activeTab + 1}.jpg`

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* 헤더 */}
        <div className={styles.header}>
          <span className={styles.title}>공개문제 {problemNo}번 도면</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 탭 */}
        <div className={styles.tabs}>
          {DIAGRAM_LABELS.map((label, i) => (
            <button
              key={i}
              className={`${styles.tab} ${activeTab === i ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 이미지 */}
        <div className={styles.imageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={`공개문제 ${problemNo}번 ${DIAGRAM_LABELS[activeTab]}`}
            className={styles.image}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* 이미지 없을 때 플레이스홀더 */}
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>📐</span>
            <span className={styles.placeholderText}>
              공개문제 {problemNo}번<br />{DIAGRAM_LABELS[activeTab]}
            </span>
            <span className={styles.placeholderSub}>
              /public/diagrams/{problemNo}_{activeTab + 1}.jpg<br />
              1=배관기구배치도 2=제어판내부 3=시퀀스회로도 4=내부결선도
            </span>
          </div>
        </div>

        {/* 핀치줌 안내 */}
        <div className={styles.hint}>핀치로 확대 · 드래그로 이동</div>
      </div>
    </div>
  )
}
