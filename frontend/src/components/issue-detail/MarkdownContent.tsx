import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import type { PluginSimple } from 'markdown-it'

// ---------- Lazy Shiki plugin ----------

let resolvedPlugin: PluginSimple | null = null
let pluginLoading: Promise<PluginSimple> | null = null

function loadShikiPlugin(): Promise<PluginSimple> {
  if (resolvedPlugin) return Promise.resolve(resolvedPlugin)
  if (!pluginLoading) {
    pluginLoading = (async () => {
      const { default: Shiki } = await import('@shikijs/markdown-it')
      const plugin = await Shiki({
        themes: {
          light: 'github-light-default',
          dark: 'github-dark-default',
        },
        defaultColor: false,
        fallbackLanguage: 'text',
      })
      resolvedPlugin = plugin
      return plugin
    })()
  }
  return pluginLoading
}

// ---------- markdown-it (zero mode: table + fence only) ----------

const ENABLED_RULES = [
  // block
  'table',
  'fence',
  'code',
  // inline (needed by table cells)
  'text',
  'newline',
  'escape',
  'backticks',
  'emphasis',
  'strikethrough',
]

function renderMarkdown(content: string): string {
  const md = new MarkdownIt('zero')
  md.enable(ENABLED_RULES)
  if (resolvedPlugin) md.use(resolvedPlugin)
  return md.render(content)
}

// ---------- Component ----------

export function MarkdownContent({
  content,
  className: containerClassName = '',
}: {
  content: string
  className?: string
}) {
  const [shikiReady, setShikiReady] = useState(!!resolvedPlugin)

  useEffect(() => {
    if (shikiReady) return
    let cancelled = false
    loadShikiPlugin().then(() => {
      if (!cancelled) setShikiReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [shikiReady])

  const html = useMemo(
    () => renderMarkdown(content),
    [content, shikiReady],
  )

  if (!html.trim()) {
    return (
      <div className={`markdown-rendered ${containerClassName}`}>
        <span className="whitespace-pre-wrap break-words">{content}</span>
      </div>
    )
  }

  return (
    <div
      className={`markdown-rendered ${containerClassName}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  )
}
