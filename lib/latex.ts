import katex from 'katex'
import React from 'react'

// cards/[id]에서 사용: HTML 문자열 → LaTeX 렌더링된 HTML 문자열 반환
export function renderLatexHtml(html: string): string {
  if (!html) return ''
  return html.replace(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g, match => {
    const isDisplay = match.startsWith('$$')
    const math = isDisplay ? match.slice(2, -2) : match.slice(1, -1)
    try { return katex.renderToString(math, { displayMode: isDisplay, throwOnError: false }) }
    catch { return match }
  })
}

// diagram/[id]에서 사용: HTML 문자열 → React 노드 배열 반환 (이미지 보존)
export function renderLatexNodes(html: string): React.ReactNode[] {
  if (!html) return []

  const imgPlaceholders: string[] = []
  const withPlaceholders = html.replace(/<img[^>]+>/g, (match) => {
    imgPlaceholders.push(match)
    return `%%IMG${imgPlaceholders.length - 1}%%`
  })

  const plain = withPlaceholders
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const parts = plain.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|%%IMG\d+%%)/g)

  return parts.map((part, i) => {
    const imgMatch = part.match(/^%%IMG(\d+)%%$/)
    if (imgMatch) {
      const imgHtml = imgPlaceholders[parseInt(imgMatch[1])]
      return React.createElement('span', {
        key: i,
        dangerouslySetInnerHTML: { __html: imgHtml },
        className: 'inline-block my-2'
      })
    }
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim()
      try {
        return React.createElement('span', {
          key: i,
          dangerouslySetInnerHTML: { __html: katex.renderToString(math, { displayMode: true, throwOnError: false }) }
        })
      } catch { return React.createElement('span', { key: i }, part) }
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim()
      try {
        return React.createElement('span', {
          key: i,
          dangerouslySetInnerHTML: { __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }
        })
      } catch { return React.createElement('span', { key: i }, part) }
    }
    return React.createElement('span', { key: i }, part)
  })
}

// diagram/[id] Cloze 렌더링: LaTeX + 빈칸 처리
export function renderClozeNodes(
  html: string,
  qIdx: number,
  revealed: Set<number>,
  onReveal: (idx: number) => void
): React.ReactNode[] {
  if (!html) return []
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = plain.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\{\{.*?\}\})/g)
  let blanks = 0

  return parts.map((part, i) => {
    const clozeMatch = part.match(/^\{\{(.*?)\}\}$/)
    if (clozeMatch) {
      const blankIdx = qIdx * 100 + blanks++
      const isRevealed = revealed.has(blankIdx)
      return React.createElement('button', {
        key: i,
        onClick: () => onReveal(blankIdx),
        className: `mx-1 px-2 py-0.5 rounded font-bold transition text-sm ${
          isRevealed ? 'bg-green-700 text-white' : 'bg-gray-600 text-gray-600 hover:bg-gray-500 hover:text-gray-400'
        }`
      }, isRevealed ? clozeMatch[1] : '　　')
    }
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2).trim()
      try {
        return React.createElement('span', {
          key: i,
          dangerouslySetInnerHTML: { __html: katex.renderToString(math, { displayMode: true, throwOnError: false }) }
        })
      } catch { return React.createElement('span', { key: i }, part) }
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1).trim()
      try {
        return React.createElement('span', {
          key: i,
          dangerouslySetInnerHTML: { __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }
        })
      } catch { return React.createElement('span', { key: i }, part) }
    }
    return React.createElement('span', { key: i }, part)
  })
}
