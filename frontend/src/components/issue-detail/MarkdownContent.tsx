import { useEffect, useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import type Shiki from '@shikijs/markdown-it'

// ---------- Lazy Shiki plugin ----------

let shikiPlugin: ReturnType<typeof Shiki> | null = null
let shikiLoading: Promise<ReturnType<typeof Shiki>> | null = null

async function getShikiPlugin() {
  if (shikiPlugin) return shikiPlugin
  if (!shikiLoading) {
    shikiLoading = (async () => {
      const { default: fromHighlighter } = await import('@shikijs/markdown-it')
      const { createHighlighter } = await import('shiki')
      const hl = await createHighlighter({
        themes: ['github-light-default', 'github-dark-default'],
        langs: [],
      })
      const plugin = fromHighlighter(hl, {
        themes: {
          light: 'github-light-default',
          dark: 'github-dark-default',
        },
        defaultColor: false,
        fallbackLanguage: 'text',
      })
      shikiPlugin = plugin
      return plugin
    })()
  }
  return shikiLoading
}

// ---------- markdown-it (zero mode: table + fence only) ----------

function createBaseRenderer(): MarkdownIt {
  const md = new MarkdownIt('zero')
  md.enable([
    // block rules
    'table',
    'fence',
    'code',
    // inline rules needed by table cells
    'text',
    'newline',
    'escape',
    'backticks',
    'emphasis',
    'strikethrough',
  ])
  return md
}

// ---------- Component ----------

export function MarkdownContent({
  content,
  className: containerClassName = '',
}: {
  content: string
  className?: string
}) {
  const [shikiReady, setShikiReady] = useState(!!shikiPlugin)
  const [, bump] = useState(0)

  // Load Shiki plugin once
  useEffect(() => {
    if (shikiReady) return
    let cancelled = false
    getShikiPlugin().then(() => {
      if (!cancelled) {
        setShikiReady(true)
        bump((n) => n + 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shikiReady])

  const html = useMemo(() => {
    const md = createBaseRenderer()
    if (shikiPlugin) md.use(shikiPlugin)
    return md.render(content)
  }, [content, shikiReady])

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
