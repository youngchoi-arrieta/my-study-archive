'use client'
import { useState, useMemo } from 'react'
import { QUESTIONS, CATEGORIES } from './data'

export default function InterviewPage() {
  const [cat, setCat] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const filtered = useMemo(
    () => cat === 'all' ? QUESTIONS : QUESTIONS.filter(q => q.category === cat),
    [cat]
  )

  function toggle(id: string) {
    setOpenId(prev => prev === id ? null : id)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* 헤더 */}
        <div className="mb-8">
          <a href="/" className="text-xs text-gray-600 hover:text-gray-400 transition mb-4 inline-block">← 홈</a>
          <h1 className="text-2xl font-bold mb-1">🎤 면접 대비</h1>
          <p className="text-gray-500 text-sm">질문 패턴 · 면접관 의도 · 답변 프레임</p>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition ${
                cat === c.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {c.label}
              <span className="ml-1.5 opacity-50">
                {c.id === 'all'
                  ? QUESTIONS.length
                  : QUESTIONS.filter(q => q.category === c.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* 질문 카드 목록 */}
        <div className="space-y-2">
          {filtered.map(q => {
            const isOpen = openId === q.id
            const catLabel = CATEGORIES.find(c => c.id === q.category)?.label ?? ''
            return (
              <div
                key={q.id}
                className="bg-gray-900 rounded-xl overflow-hidden"
              >
                {/* 질문 헤더 */}
                <button
                  onClick={() => toggle(q.id)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 hover:bg-gray-800 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-600 uppercase tracking-widest">{catLabel}</span>
                      {q.warning && (
                        <span className="text-xs bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">⚠️ 핵심</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">{q.question}</p>
                  </div>
                  <span className="text-gray-600 text-xs mt-0.5 flex-shrink-0">
                    {isOpen ? '▲' : '▼'}
                  </span>
                </button>

                {/* 펼쳐지는 상세 */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">

                    {/* 면접관 의도 */}
                    <div>
                      <p className="text-xs text-blue-400 font-semibold mb-1">🎯 면접관 의도</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{q.intent}</p>
                    </div>

                    {/* 답변 프레임 */}
                    <div>
                      <p className="text-xs text-green-400 font-semibold mb-1">💡 답변 프레임</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{q.frame}</p>
                    </div>

                    {/* 경고 */}
                    {q.warning && (
                      <div className="bg-yellow-500/10 rounded-lg px-3 py-2">
                        <p className="text-xs text-yellow-400 leading-relaxed">⚠️ {q.warning}</p>
                      </div>
                    )}

                    {/* 내 메모 */}
                    <div>
                      <p className="text-xs text-gray-500 font-semibold mb-1">📝 내 메모</p>
                      <textarea
                        value={notes[q.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="내 답변 초안이나 키워드를 메모하세요..."
                        rows={3}
                        className="w-full bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 resize-none placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 전략 메모 */}
        <div className="mt-8 bg-gray-900 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-widest">📌 핵심 전략</p>
          <div className="space-y-2 text-sm text-gray-400">
            <p>• 면접관의 진짜 질문은 두 개 — <span className="text-gray-200">이탈 리스크</span> + <span className="text-gray-200">역량 증명</span></p>
            <p>• 답변의 절반은 "오래 있을 사람"을 안심시키는 데 써야 한다</p>
            <p>• 역질문 4~5개 준비 → 분위기 보고 2~3개만. 즉석 질문이 점수 더 높다</p>
            <p>• 캐나다/일본 계획은 자진 신고 금지. 직접 질문 들어오면 그때 정직하게</p>
            <p>• 6/12 기사 최종합격 변수 → 입사 시점 협의 가능으로 미리 공개</p>
          </div>
        </div>

        {/* 역질문 섹션 */}
        <div className="mt-4 bg-gray-900 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-widest">🔄 내가 던질 역질문</p>
          <div className="space-y-2 text-sm text-gray-400">
            <p>• 연구원의 하루 업무 구성을 비율로 알 수 있을까요? (콘텐츠 기획 / QNA / 자료 정리 등)</p>
            <p>• 입사 후 1년 차에 기대하시는 산출물이 있다면?</p>
            <p>• 기존 연구원분들은 어떤 백그라운드를 가지고 계신가요?</p>
            <p>• PLC·설비보전 등 신규 분야 콘텐츠 개발에도 참여하게 되나요?</p>
            <p>• 성과 평가는 어떤 기준으로 이뤄지나요?</p>
          </div>
        </div>

      </div>
    </main>
  )
}
