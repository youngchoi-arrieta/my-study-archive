import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  const { sentence } = await req.json()
  if (!sentence?.trim()) {
    return NextResponse.json({ error: '문장이 없습니다' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `다음 일본어 문장을 분석해줘. JSON만 반환하고 다른 텍스트는 절대 없이.

문장: ${sentence}

반환 형식:
{
  "sentence": {
    "jp": "원문 문장",
    "reading": "전체 후리가나 (romaji 병기, 예: かんとくいん(kan-to-ku-in)의 지시가)",
    "ko": "한국어 해석. 조사를 인라인으로 표시. 예: 감독관의[の=수식] 지시가[が=주어]",
    "memo": "핵심 문형 한 줄. 예: てはいけません=금지문형"
  },
  "words": [
    {
      "jp": "한자",
      "reading": "후리가나(romaji)",
      "ko": "한국어 의미",
      "memo": ""
    }
  ]
}`
    }]
  })

  const text = (message.content[0] as { type: string; text: string }).text
  const clean = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(clean)

  return NextResponse.json(parsed)
}
