'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import ResizeImage from 'tiptap-extension-resize-image'
import { supabase } from '../../lib/supabase'

type Props = {
  content: string
  onChange: (val: string) => void
  placeholder?: string
}

export default function RichEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({ inline: true }),
      ResizeImage,
      Placeholder.configure({ placeholder: placeholder || '내용을 입력하세요...' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find(item => item.type.startsWith('image'))
        if (imageItem) {
          const file = imageItem.getAsFile()
          if (!file) return false
          const ext = file.type.split('/')[1]
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          supabase.storage.from('card-images').upload(path, file).then(({ error }) => {
            if (!error) {
              const { data } = supabase.storage.from('card-images').getPublicUrl(path)
              editor?.chain().focus().setImage({ src: data.publicUrl }).run()
            }
          })
          return true
        }
        return false
      },
    },
  })

  const insertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('card-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('card-images').getPublicUrl(path)
      editor?.chain().focus().setImage({ src: data.publicUrl }).run()
    }
  }

  if (!editor) return null

  return (
    <div className="border border-gray-600 rounded-lg overflow-hidden">
      <div className="flex gap-1 p-2 bg-gray-900 border-b border-gray-600 flex-wrap">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-sm font-bold ${editor.isActive('bold') ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          B
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-sm italic ${editor.isActive('italic') ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          I
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-sm ${editor.isActive('bulletList') ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          • 목록
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-sm ${editor.isActive('orderedList') ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          1. 목록
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-sm ${editor.isActive('codeBlock') ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
          {'</>'}
        </button>
        <label className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 cursor-pointer">
          🖼️ 사진
          <input type="file" accept="image/*" className="hidden" onChange={insertImage} />
        </label>
        <span className="text-xs text-gray-500 flex items-center ml-2">Ctrl+V 붙여넣기 가능</span>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-invert max-w-none p-4 min-h-32 text-white focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-500 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  )
}