import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { TOPIC_TREE as FALLBACK_TOPIC_TREE, PROBLEM_NATURE } from './constants'

export type TopicTree = {
  label: string
  color: string
  subs: string[]
}

export type DiagramConfig = {
  topicTree: TopicTree[]
  natureTags: string[]
}

const FALLBACK: DiagramConfig = {
  topicTree: FALLBACK_TOPIC_TREE,
  natureTags: [...PROBLEM_NATURE],
}

// 앱 내 캐시 — 페이지 이동해도 재fetch 안 함
let cache: DiagramConfig | null = null

export function useDiagramConfig() {
  const [config, setConfig] = useState<DiagramConfig>(cache ?? FALLBACK)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) return
    supabase
      .from('diagram_config')
      .select('topic_tree, nature_tags')
      .eq('id', 'default')
      .single()
      .then(({ data }) => {
        if (data) {
          cache = {
            topicTree: data.topic_tree as TopicTree[],
            natureTags: data.nature_tags as string[],
          }
          setConfig(cache)
        }
        setLoading(false)
      })
  }, [])

  const save = async (next: DiagramConfig) => {
    cache = next
    setConfig(next)
    await supabase.from('diagram_config').upsert({
      id: 'default',
      topic_tree: next.topicTree,
      nature_tags: next.natureTags,
      updated_at: new Date().toISOString(),
    })
  }

  return { config, loading, save }
}
