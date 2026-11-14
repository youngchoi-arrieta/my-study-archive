'use client'

import { useMemo, useState } from 'react'

// zip 목차 → 폴더 나무. 압축은 풀지 않는다 (입고할 때 읽어 둔 이름 목록만).

interface Node { name: string; children: Map<string, Node>; file: boolean }

function build(names: string[]): Node {
  const root: Node = { name: '', children: new Map(), file: false }
  for (const full of names) {
    const parts = full.split('/').filter(Boolean)
    let cur = root
    parts.forEach((p, i) => {
      const isFile = i === parts.length - 1 && !full.endsWith('/')
      let nx = cur.children.get(p)
      if (!nx) { nx = { name: p, children: new Map(), file: isFile }; cur.children.set(p, nx) }
      cur = nx
    })
  }
  return root
}

const sorted = (n: Node) => [...n.children.values()].sort((a, b) =>
  Number(a.file) - Number(b.file) || a.name.localeCompare(b.name, 'ko'))

const countFiles = (n: Node): number => n.file ? 1 : sorted(n).reduce((s, c) => s + countFiles(c), 0)

function Branch({ node, depth }: { node: Node; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  if (node.file) {
    return (
      <li className="text-[12px] text-gray-400 font-mono truncate" style={{ paddingLeft: depth * 14 }}>
        <span className="text-gray-700">·</span> {node.name}
      </li>
    )
  }
  return (
    <li>
      <button onClick={() => setOpen(v => !v)} style={{ paddingLeft: depth * 14 }}
        className="text-[12px] text-blue-200/80 hover:text-blue-100 font-mono text-left w-full truncate">
        {open ? '▾' : '▸'} {node.name}/ <span className="text-gray-600">({countFiles(node)})</span>
      </button>
      {open && <ul>{sorted(node).map(c => <Branch key={c.name} node={c} depth={depth + 1} />)}</ul>}
    </li>
  )
}

export default function ZipTree({ names }: { names: string[] }) {
  const root = useMemo(() => build(names), [names])
  const top = sorted(root)
  // 최상위가 폴더 하나뿐이면 (프로젝트명/ …) 한 겹 벗겨 보여준다
  const shown = top.length === 1 && !top[0].file ? top[0] : root
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 max-h-[520px] overflow-auto">
      {shown !== root && <p className="text-[11px] text-gray-500 font-mono mb-1">{shown.name}/</p>}
      <ul className="space-y-0.5">{sorted(shown).map(c => <Branch key={c.name} node={c} depth={0} />)}</ul>
      <p className="text-[10px] text-gray-600 mt-2">파일 {countFiles(root)}개</p>
    </div>
  )
}
