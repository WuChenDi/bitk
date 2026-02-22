import { useEffect, useState } from 'react'

import type MarkdownIt from 'markdown-it'

let mdInstance: MarkdownIt | null = null
let mdLoading: Promise<MarkdownIt> | null = null

async function getMd(): Promise<MarkdownIt> {
  if (mdInstance) return mdInstance
  if (!mdLoading) {
    mdLoading = (async () => {
      const [{ default: MdIt }, { default: Shiki }] = await Promise.all([
        import('markdown-it'),
        import('@shikijs/markdown-it'),
      ])
      const md = MdIt({ linkify: true })

      md.use(
        await Shiki({
          themes: {
            light: 'github-light-default',
            dark: 'github-dark-default',
          },
        }),
      )

      // External links open in new tab
      const defaultRender =
        md.renderer.rules.link_open ??
        ((tokens, idx, options, _env, self) =>
          self.renderToken(tokens, idx, options))
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        tokens[idx].attrPush(['target', '_blank'])
        tokens[idx].attrPush(['rel', 'noreferrer'])
        return defaultRender(tokens, idx, options, env, self)
      }

      mdInstance = md
      return md
    })()
  }
  return mdLoading
}

export function MarkdownContent({
  content,
  className: containerClassName = '',
}: {
  content: string
  className?: string
}) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    getMd().then((md) => {
      if (!cancelled) setHtml(md.render(content))
    })
    return () => {
      cancelled = true
    }
  }, [content])

  if (!html) {
    return (
      <div
        className={`markdown-content text-sm leading-6 text-foreground ${containerClassName}`}
      >
        <p>{content}</p>
      </div>
    )
  }

  return (
    <div
      className={`markdown-content text-sm leading-6 text-foreground ${containerClassName}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
