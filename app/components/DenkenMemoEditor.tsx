'use client'

import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import ResizeImage from 'tiptap-extension-resize-image'
import { compressToBase64 } from '@/lib/imageUtils'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// ── 수식 삽입 모달 ───────────────────────────────────────────────
function MathModal({ onInsert, onClose }: { onInsert: (tex: string) => void; onClose: () => void }) {
  const [tex, setTex] = useState('')
  let preview = ''
  try { preview = katex.renderToString(tex, { throwOnError: false, displayMode: false }) } catch { preview = '' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#0f1c2e] border border-white/10 rounded-2xl p-5 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold text-white mb-3">수식 입력 (LaTeX)</p>
        <input
          autoFocus
          value={tex}
          onChange={e => setTex(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && tex.trim()) { onInsert(tex.trim()); onClose() } if (e.key === 'Escape') onClose() }}
          placeholder="예: \frac{V}{I} = Z"
          className="w-full bg-[#1e3048] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/60 font-mono mb-3"
        />
        <div className="bg-[#050d1a] rounded-lg px-4 py-3 min-h-10 flex items-center justify-center mb-4">
          {tex ? <span dangerouslySetInnerHTML={{ __html: preview }} className="text-white" /> : <span className="text-gray-600 text-xs">미리보기</span>}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            ['분수', '\\frac{a}{b}'], ['제곱근', '\\sqrt{x}'], ['합', '\\sum_{i=1}^{n}'],
            ['적분', '\\int_{a}^{b}'], ['ω', '\\omega'], ['Δ', '\\Delta'],
            ['π', '\\pi'], ['θ', '\\theta'], ['∠', '\\angle'], ['±', '\\pm'],
          ].map(([label, val]) => (
            <button key={label} onClick={() => setTex(p => p + val)}
              className="text-[10px] bg-[#1e3048] hover:bg-[#253d5c] text-gray-300 px-2 py-1 rounded font-mono transition">
              {label}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-500 hover:text-white transition">취소</button>
          <button onClick={() => { if (tex.trim()) { onInsert(tex.trim()); onClose() } }}
            className="px-4 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition">삽입</button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  content: string
  onChange: (val: string) => void
  onBlur?: () => void
  placeholder?: string
  accentColor?: string
}

export default function DenkenMemoEditor({ content, onChange, onBlur, placeholder }: Props) {
  const [mathModal, setMathModal] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      ResizeImage,
      Placeholder.configure({ placeholder: placeholder || '오답 메모, 수식, 이미지...' }),
    ],
    content: '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find(item => item.type.startsWith('image'))
        if (imageItem) {
          const file = imageItem.getAsFile()
          if (!file) return false
          compressToBase64(file).then(base64 => {
            editor?.chain().focus().setImage({ src: base64 }).run()
          })
          return true
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content && current !== content) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
    if (!content && current !== '<p></p>') {
      editor.commands.clearContent(false)
    }
  }, [editor, content])

  const insertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await compressToBase64(file)
    editor?.chain().focus().setImage({ src: base64 }).run()
    e.target.value = ''
  }

  const insertMath = (tex: string) => {
    let rendered = tex
    try { rendered = katex.renderToString(tex, { throwOnError: false, displayMode: false }) } catch { rendered = tex }
    const encoded = encodeURIComponent(tex)
    editor?.chain().focus().insertContent(`<span data-math="${encoded}" class="katex-inline">${rendered}</span>&nbsp;`).run()
  }

  if (!editor) {
    return (
      <div className="flex-1 bg-[#0f1c2e] rounded-xl flex items-center justify-center text-gray-700 text-xs">
        에디터 로딩 중...
      </div>
    )
  }

  const btnBase = 'px-2 py-1 rounded text-xs font-bold transition'
  const btn = (active: boolean) => `${btnBase} ${active ? 'bg-blue-600 text-white' : 'bg-[#1e3048] text-gray-400 hover:text-white'}`

  return (
    <>
      {mathModal && <MathModal onInsert={insertMath} onClose={() => setMathModal(false)} />}
      <div className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden border border-white/5">
        <div className="flex gap-1 px-2 py-1.5 bg-[#0a1628] border-b border-white/5 flex-wrap shrink-0">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>B</button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn(editor.isActive('italic'))} italic`}>I</button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}>• 목록</button>
          <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(editor.isActive('codeBlock'))}>{'</>'}</button>
          <div className="w-px bg-white/10 mx-1" />
          <button type="button" onClick={() => setMathModal(true)} className={`${btnBase} bg-[#1e3048] text-yellow-400 hover:bg-[#253d5c]`} title="수식 삽입 (LaTeX)">Σ 수식</button>
          <label className={`${btnBase} bg-[#1e3048] text-gray-400 hover:text-white cursor-pointer`}>
            🖼️
            <input type="file" accept="image/*" className="hidden" onChange={insertImage} />
          </label>
        </div>
        <EditorContent
          editor={editor}
          className="flex-1 overflow-y-auto bg-[#0f1c2e] text-sm text-white
            [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:p-3 [&_.ProseMirror]:leading-relaxed
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-600
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
            [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-1
            [&_.katex-inline]:bg-[#1a2e47] [&_.katex-inline]:px-1.5 [&_.katex-inline]:py-0.5 [&_.katex-inline]:rounded [&_.katex-inline]:mx-0.5
            prose prose-invert max-w-none"
        />
      </div>
    </>
  )
}
