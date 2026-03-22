import type { ContactType } from '@/types/trainer'

// 공개도면 001-A 실제 심볼 기준
// 수직 방향: 위아래 도선 + 접점 심볼
// 위아래에 작은 원(단자), 사이에 접점 표시

export function symNO(color = 'currentColor') {
  // a접점: 위 단자원 - 짧은 가로선 - 아래 단자원
  return `<svg viewBox="0 0 24 56" width="24" height="56">
    <line x1="12" y1="0" x2="12" y2="16" stroke="${color}" stroke-width="1.5"/>
    <circle cx="12" cy="16" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <circle cx="12" cy="40" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <line x1="12" y1="43" x2="12" y2="56" stroke="${color}" stroke-width="1.5"/>
    <line x1="4" y1="28" x2="20" y2="28" stroke="${color}" stroke-width="1.5"/>
  </svg>`
}

export function symNC(color = 'currentColor') {
  // b접점: a접점 + 대각선
  return `<svg viewBox="0 0 24 56" width="24" height="56">
    <line x1="12" y1="0" x2="12" y2="16" stroke="${color}" stroke-width="1.5"/>
    <circle cx="12" cy="16" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <circle cx="12" cy="40" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <line x1="12" y1="43" x2="12" y2="56" stroke="${color}" stroke-width="1.5"/>
    <line x1="4" y1="28" x2="20" y2="28" stroke="${color}" stroke-width="1.5"/>
    <line x1="4" y1="20" x2="20" y2="36" stroke="${color}" stroke-width="1.5"/>
  </svg>`
}

export function symTNO(color = 'currentColor') {
  // 한시 a접점: a접점 + 오른쪽에 삼각 화살표(▷)
  return `<svg viewBox="0 0 32 56" width="32" height="56">
    <line x1="12" y1="0" x2="12" y2="16" stroke="${color}" stroke-width="1.5"/>
    <circle cx="12" cy="16" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <circle cx="12" cy="40" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <line x1="12" y1="43" x2="12" y2="56" stroke="${color}" stroke-width="1.5"/>
    <line x1="4" y1="28" x2="20" y2="28" stroke="${color}" stroke-width="1.5"/>
    <polygon points="22,22 22,34 30,28" fill="${color}"/>
  </svg>`
}

export function symTNC(color = 'currentColor') {
  // 한시 b접점: b접점 + 삼각 화살표
  return `<svg viewBox="0 0 32 56" width="32" height="56">
    <line x1="12" y1="0" x2="12" y2="16" stroke="${color}" stroke-width="1.5"/>
    <circle cx="12" cy="16" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <circle cx="12" cy="40" r="3" stroke="${color}" stroke-width="1.5" fill="white"/>
    <line x1="12" y1="43" x2="12" y2="56" stroke="${color}" stroke-width="1.5"/>
    <line x1="4" y1="28" x2="20" y2="28" stroke="${color}" stroke-width="1.5"/>
    <line x1="4" y1="20" x2="20" y2="36" stroke="${color}" stroke-width="1.5"/>
    <polygon points="22,22 22,34 30,28" fill="${color}"/>
  </svg>`
}

export function symCoil(color = 'currentColor') {
  // 코일: 위아래 도선 + 원
  return `<svg viewBox="0 0 32 56" width="32" height="56">
    <line x1="16" y1="0" x2="16" y2="12" stroke="${color}" stroke-width="1.5"/>
    <circle cx="16" cy="28" r="14" stroke="${color}" stroke-width="1.5" fill="none"/>
    <line x1="16" y1="42" x2="16" y2="56" stroke="${color}" stroke-width="1.5"/>
  </svg>`
}

export function getSymSvg(type: ContactType, color = 'currentColor'): string {
  switch (type) {
    case 'NO':   return symNO(color)
    case 'NC':   return symNC(color)
    case 'tNO':  return symTNO(color)
    case 'tNC':  return symTNC(color)
    case 'coil': return symCoil(color)
    default:     return ''
  }
}

export const TYPE_LABEL: Record<ContactType, string> = {
  NO:   'a접점',
  NC:   'b접점',
  tNO:  '한시a',
  tNC:  '한시b',
  coil: '코일',
}
