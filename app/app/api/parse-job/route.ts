import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL 없음' }, { status: 400 })

  try {
    // 1. 채용공고 페이지 HTML 가져오기
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    let html = await pageRes.text()

    // HTML을 적당히 정리 (너무 길면 자르기)
    // script, style 제거
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    html = html.replace(/<style[\s\S]*?<\/style>/gi, '')
    html = html.replace(/<[^>]+>/g, ' ')
    html = html.replace(/\s+/g, ' ').trim()
    if (html.length > 8000) html = html.slice(0, 8000)

    // 2. Claude API 호출
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: '한국 채용공고 파서야. 주어진 텍스트에서 정보를 추출해. JSON만 응답 (마크다운 없이): {"company":"회사명","role":"직무/포지션","cat":"top|foreign|sme|dc","memo":"핵심 요약 2-3줄 (한국어)"}. cat 규칙: top=대기업/그룹사, foreign=외국계/글로벌, sme=중소중견기업, dc=데이터센터/IT인프라',
        messages: [{ role: 'user', content: `채용공고 URL: ${url}\n\n내용:\n${html}` }],
      }),
    })

    const data = await claudeRes.json()

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 })
    }

    const text = data.content
      .filter((x: { type: string }) => x.type === 'text')
      .map((x: { text: string }) => x.text)
      .join('')

    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)

  } catch (e) {
    console.error('파싱 에러:', e)
    return NextResponse.json({ error: '파싱 실패' }, { status: 500 })
  }
}
