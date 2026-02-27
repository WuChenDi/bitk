import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

// ---------- markdown-it (zero mode: table + fence only, fully sync) ----------

const md = new MarkdownIt('zero')
md.enable([
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
])

// ---------- Component ----------

export function MarkdownContent({
  content,
  className: containerClassName = '',
}: {
  content: string
  className?: string
}) {
  const html = useMemo(() => md.render(content), [content])

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
