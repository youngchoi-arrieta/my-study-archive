'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { BlankAnswer, Problem } from '@/types/trainer'
import { supabase } from '@/lib/supabase'
import { scoreCircuit, scoreTimechart } from '@/lib/trainer/scoring'
import CircuitCanvas from './components/CircuitCanvas'
import Palette from './components/Palette'
import TimechartEditor from './components/TimechartEditor'

type Tab = 'circuit' | 'timechart'

export default function TrainerPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [selProbId, setSelProbId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('circuit')
  const [circuitAns, setCircuitAns] = useState<Record<string, BlankAnswer>>({})
  const [tcAns, setTcAns] = useState<Record<string, 0 | 1>>({})
  const [checked, setChecked] = useState(false)
  const [cScore, setCScore] = useState<{ correct: number; total: number } | null>(null)
  const [tScore, setTScore] = useState<{ correct: number; total: number } | null>(null)
  const [selBlankId, setSelBlankId] = useState<string | null>(null)
  const [showOp, setShowOp] = useState(false)

  useEffect(() => {
    supabase.from('trainer_problems').select('*').order('created_at').then(({ data, error }) => {
      if (!error && data) {
        setProblems(data as Problem[])
        if (data.length > 0) setSelProbId(data[0].id)
      }
      setLoading(false)
    })
  }, [])

  const problem = problems.find(p => p.id === selProbId)

  const selectProblem = (id: string) => {
    setSelProbId(id); setCircuitAns({}); setTcAns({})
    setChecked(false); setCScore(null); setTScore(null)
    setSelBlankId(null); setShowOp(false)
  }

  const handleClickBlank = (id: string) => {
    if (checked) return
    setSelBlankId(id)
  }

  const handleSelectAnswer = (a: BlankAnswer) => {
    if (!selBlankId) return
    setCircuitAns(prev => ({ ...prev, [selBlankId]: a }))
    if (problem) {
      const idx = problem.blanks.findIndex(b => b.id === selBlankId)
      const next = problem.blanks[idx + 1]
      setSelBlankId(next ? next.id : null)
    }
  }

  const handleCheck = () => {
    if (!problem) return
    setChecked(true); setSelBlankId(null)
    setCScore(scoreCircuit(problem.blanks, circuitAns))
    setTScore(scoreTimechart(problem, tcAns))
  }

  const handleReset = () => {
    setCircuitAns({}); setTcAns({})
    setChecked(false); setCScore(null); setTScore(null); setSelBlankId(null)
  }

  const curScore = tab === 'circuit' ? cScore : tScore
  const allOk = curScore && curScore.correct === curScore.total

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#ffffff', color: '#111827',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* 상단바 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px', borderBottom: '1px solid #e5e7eb',
        flexShrink: 0, background: '#fff',
      }}>
        <Link href="/tools" style={{ color: '#9ca3af', fontSize: 12, textDecoration: 'none' }}>← 디지털 토이</Link>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>⚡ 시퀀스 트레이너</span>
        <Link href="/tools/trainer/admin" style={{
          marginLeft: 'auto', fontSize: 11, color: '#6b7280',
          textDecoration: 'none', padding: '3px 10px',
          border: '1px solid #e5e7eb', borderRadius: 5,
        }}>편집기</Link>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 사이드바 */}
        <div style={{
          width: 168, borderRight: '1px solid #e5e7eb',
          overflow: 'auto', flexShrink: 0, padding: '8px 0',
          background: '#f9fafb',
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, padding: '0 12px', marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            문제 목록
          </div>
          {loading ? (
            <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 12px' }}>로딩 중...</div>
          ) : problems.length === 0 ? (
            <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 12px', lineHeight: 1.5 }}>
              편집기에서<br />문제를 추가하세요
            </div>
          ) : problems.map(p => (
            <button key={p.id} onClick={() => selectProblem(p.id)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 12px', border: 'none',
              background: selProbId === p.id ? '#eff6ff' : 'transparent',
              color: selProbId === p.id ? '#1d4ed8' : '#374151',
              fontSize: 11, cursor: 'pointer',
              borderLeft: selProbId === p.id ? '3px solid #3b82f6' : '3px solid transparent',
              fontWeight: selProbId === p.id ? 600 : 400,
            }}>
              <div>{p.title}</div>
              <div style={{ fontSize: 9, marginTop: 2, color: selProbId === p.id ? '#3b82f6' : '#9ca3af' }}>
                {p.exam_type} · blank {p.blanks?.length ?? 0}개
              </div>
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
          {!problem ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14 }}>{loading ? '로딩 중...' : '문제를 선택하세요'}</div>
              {!loading && (
                <Link href="/tools/trainer/admin" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', padding: '6px 16px', border: '1px solid #3b82f6', borderRadius: 6 }}>
                  편집기에서 문제 만들기 →
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* 문제 헤더 */}
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, background: '#f9fafb' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{problem.title}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>{problem.description}</div>
                  </div>
                  {problem.operation_text && (
                    <button onClick={() => setShowOp(v => !v)} style={{
                      fontSize: 11, color: '#6b7280', background: 'none',
                      border: '1px solid #e5e7eb', borderRadius: 5,
                      padding: '3px 10px', cursor: 'pointer', flexShrink: 0,
                    }}>
                      동작사항 {showOp ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {showOp && (
                  <pre style={{
                    marginTop: 8, padding: '8px 12px',
                    background: '#f3f4f6', borderRadius: 6,
                    fontSize: 11, color: '#374151', lineHeight: 1.7,
                    whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
                    border: '1px solid #e5e7eb',
                  }}>
                    {problem.operation_text}
                  </pre>
                )}
              </div>

              {/* 탭 */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0, background: '#fff' }}>
                {(['circuit', 'timechart'] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: '8px 18px', fontSize: 12, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: `2px solid ${tab === t ? '#3b82f6' : 'transparent'}`,
                    color: tab === t ? '#1d4ed8' : '#6b7280',
                    fontWeight: tab === t ? 600 : 400,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {t === 'circuit' ? '시퀀스 회로도' : '타임차트'}
                    {t === 'circuit' && cScore && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 10,
                        background: allOk ? '#dcfce7' : '#fee2e2',
                        color: allOk ? '#15803d' : '#dc2626',
                        fontWeight: 600,
                      }}>
                        {cScore.correct}/{cScore.total}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 에디터 */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {tab === 'circuit' ? (
                  <>
                    {(!problem.blanks || problem.blanks.length === 0) ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#9ca3af' }}>
                        <div>blank가 없어요</div>
                        <Link href="/tools/trainer/admin" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', padding: '6px 16px', border: '1px solid #3b82f6', borderRadius: 6 }}>
                          편집기에서 blank 추가 →
                        </Link>
                      </div>
                    ) : (
                      <div style={{ flex: 1, overflow: 'auto' }}>
                        <CircuitCanvas
                          imagePath={problem.image_path}
                          imageW={1002} imageH={576}
                          blanks={problem.blanks}
                          answers={circuitAns}
                          checked={checked}
                          onClickBlank={handleClickBlank}
                          selectedId={selBlankId}
                        />
                      </div>
                    )}
                    <Palette
                      palette={problem.palette ?? []}
                      selectedId={selBlankId}
                      onSelect={handleSelectAnswer}
                      userAnswer={selBlankId ? circuitAns[selBlankId] : undefined}
                    />
                  </>
                ) : (
                  <TimechartEditor
                    problem={problem}
                    answers={tcAns}
                    setAnswers={setTcAns}
                    checked={checked}
                  />
                )}
              </div>

              {/* 액션바 */}
              <div style={{
                display: 'flex', gap: 8, padding: '8px 14px',
                borderTop: '1px solid #e5e7eb', background: '#f9fafb',
                alignItems: 'center', flexShrink: 0,
              }}>
                <button onClick={handleCheck} disabled={checked} style={{
                  padding: '6px 20px', borderRadius: 6, border: 'none',
                  fontSize: 12, fontWeight: 600,
                  cursor: checked ? 'not-allowed' : 'pointer',
                  background: checked ? '#e5e7eb' : '#2563eb',
                  color: checked ? '#9ca3af' : '#fff',
                }}>
                  채점하기
                </button>
                <button onClick={handleReset} style={{
                  padding: '6px 14px', borderRadius: 6,
                  border: '1px solid #d1d5db', fontSize: 12,
                  cursor: 'pointer', background: '#fff', color: '#374151',
                }}>
                  초기화
                </button>
                {curScore && (
                  <div style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 6,
                    background: allOk ? '#dcfce7' : '#fee2e2',
                    color: allOk ? '#15803d' : '#dc2626',
                  }}>
                    {curScore.correct}/{curScore.total} 정답{allOk ? ' 🎉' : ''}
                  </div>
                )}
                <div style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>
                  {problem.tags?.map(t => (
                    <span key={t} style={{ marginRight: 6, padding: '2px 6px', background: '#f3f4f6', borderRadius: 4 }}>{t}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
