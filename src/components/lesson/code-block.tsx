import { useEffect, useRef, useState } from "react"
import { getHighlighter } from "@/lib/highlighter"

interface CodeBlockProps {
  code: string
  language: string
}

const htmlCache = new Map<string, string>()

export function CodeBlock({ code, language }: CodeBlockProps) {
  const cacheKey = `${language}:${code}`
  const cached = htmlCache.get(cacheKey)
  const [html, setHtml] = useState<string | null>(cached ?? null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (html) return // already have it
    let cancelled = false

    getHighlighter()
      .then((highlighter) => {
        const langs = highlighter.getLoadedLanguages()
        const lang = langs.includes(language) ? language : "text"
        const result = highlighter.codeToHtml(code, {
          lang,
          theme: "github-dark",
        })
        htmlCache.set(cacheKey, result)
        if (!cancelled) setHtml(result)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [code, language, cacheKey, html])

  const content = html ? (
    <div
      className="[&_pre]:!m-0 [&_pre]:!overflow-x-auto [&_pre]:!rounded-lg [&_pre]:!p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <pre className="overflow-x-auto rounded-lg bg-[#24292e] p-4 font-mono text-sm leading-6 text-gray-100">
      <code>{code}</code>
    </pre>
  )

  return (
    <div ref={containerRef} className="mb-4 text-sm leading-6">
      {content}
    </div>
  )
}
