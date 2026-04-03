import { useMemo, useEffect, useState, useRef, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Landmark, Lightbulb, List, Code2, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "./mermaid-diagram"
import { ReviewQuestions } from "./review-questions"
import { CodeBlock } from "./code-block"
import { Tooltip } from "@/components/ui/tooltip"
import { lookupGlossary } from "@/data/glossary"
import type { Lesson } from "@/types/learning"

interface TocEntry {
  level: number
  text: string
  id: string
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  const lines = markdown.split("\n")
  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/[`*_]/g, "")
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
      entries.push({ level, text, id })
    }
  }
  return entries
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
}

interface LessonViewerProps {
  lesson: Lesson
  onStartChallenge: () => void
}

function useActiveHeading(ids: string[]) {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)
  const idsRef = useRef(ids)
  idsRef.current = ids

  useEffect(() => {
    setActiveId(ids[0] ?? null)
  }, [ids])

  useEffect(() => {
    let raf = 0

    function compute() {
      const offset = 100
      let current: string | null = null
      const currentIds = idsRef.current

      for (const id of currentIds) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= offset) {
          current = id
        } else {
          break
        }
      }

      setActiveId(current ?? currentIds[0] ?? null)
    }

    function onScroll() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }

    const scrollParent = document.querySelector("main") ?? window
    scrollParent.addEventListener("scroll", onScroll, { passive: true })
    compute()

    return () => {
      scrollParent.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return activeId
}

function buildLessonMarkdown(lesson: Lesson): string {
  const parts: string[] = []

  parts.push(`# ${lesson.title}`)
  parts.push("")
  parts.push(lesson.description)
  parts.push("")

  if (lesson.bankingScenario) {
    parts.push("## Banking Scenario")
    parts.push("")
    parts.push(lesson.bankingScenario.trim())
    parts.push("")
  }

  if (lesson.content) {
    parts.push(lesson.content.trim())
    parts.push("")
  }

  if (lesson.whyItMatters) {
    parts.push("## Why It Matters")
    parts.push("")
    parts.push(lesson.whyItMatters.trim())
    parts.push("")
  }

  return parts.join("\n")
}

export function LessonViewer({ lesson, onStartChallenge }: LessonViewerProps) {
  const toc = useMemo(() => extractToc(lesson.content), [lesson.content])
  const tocIds = useMemo(() => toc.map((e) => e.id), [toc])
  const activeId = useActiveHeading(tocIds)

  const [copied, setCopied] = useState(false)

  const copyAsMarkdown = useCallback(() => {
    const md = buildLessonMarkdown(lesson)
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [lesson])

  return (
    <div className="flex gap-6 lg:gap-10">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
              {lesson.title}
            </h1>
            <p className="text-base text-muted-foreground">
              {lesson.description}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyAsMarkdown}
            className="shrink-0 gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy as Markdown
              </>
            )}
          </Button>
        </div>

        {/* Banking Scenario */}
        <section className="rounded-lg bg-violet-50 p-4 dark:bg-violet-950/30 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-violet-700 dark:text-violet-400">
            <Landmark className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Banking Scenario
            </span>
          </div>
          <div className="markdown-body text-violet-900/80 dark:text-violet-200/80">
            <MarkdownContent content={lesson.bankingScenario} />
          </div>
        </section>

        {/* Main Content */}
        <div className="markdown-body">
          <MarkdownContent content={lesson.content} />
        </div>

        {/* Why It Matters */}
        <section className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950/30 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Lightbulb className="h-4 w-4" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Why It Matters
            </span>
          </div>
          <div className="markdown-body text-amber-900/80 dark:text-amber-200/80">
            <MarkdownContent content={lesson.whyItMatters} />
          </div>
        </section>

        {/* Review Questions */}
        {lesson.questions.length > 0 && (
          <ReviewQuestions questions={lesson.questions} lessonId={lesson.id} />
        )}

        {/* Start Challenge CTA */}
        <div className="rounded-lg bg-[#1e1e1e] p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">
                Ready to code?
              </h3>
              <p className="mt-1 text-sm text-gray-400">
                Put what you learned into practice with the challenge.
              </p>
            </div>
            <Button
              onClick={onStartChallenge}
              className="gap-2 bg-violet-600 hover:bg-violet-700"
            >
              <Code2 className="h-4 w-4" />
              Start Challenge
            </Button>
          </div>
        </div>
      </div>

      {/* TOC sidebar */}
      {toc.length > 1 && (
        <nav className="sticky top-8 hidden h-fit w-56 shrink-0 lg:block">
          <div className="mb-3 flex items-center gap-2 text-foreground">
            <List className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              In This Lesson
            </span>
          </div>
          <ul className="space-y-1 border-l border-border pl-3">
            {toc.map((entry) => {
              const isActive = activeId === entry.id
              return (
                <li key={entry.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[13px] top-1 h-4 w-0.5 rounded-full transition-all duration-200",
                      isActive
                        ? "bg-violet-600 opacity-100"
                        : "bg-transparent opacity-0",
                    )}
                  />
                  <a
                    href={`#${entry.id}`}
                    className={cn(
                      "block text-[13px] leading-6 transition-all duration-200",
                      isActive
                        ? "font-medium text-violet-600"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    style={{ paddingLeft: `${(entry.level - 2) * 12}px` }}
                  >
                    {entry.text}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2({ children }) {
          const text = String(children)
          return (
            <h2
              id={slugify(text)}
              className="mb-3 mt-8 text-xl font-bold text-foreground first:mt-0"
            >
              {children}
            </h2>
          )
        },
        h3({ children }) {
          const text = String(children)
          return (
            <h3
              id={slugify(text)}
              className="mb-2 mt-6 text-lg font-semibold text-foreground"
            >
              {children}
            </h3>
          )
        },
        h4({ children }) {
          const text = String(children)
          return (
            <h4
              id={slugify(text)}
              className="mb-2 mt-4 text-base font-semibold text-foreground"
            >
              {children}
            </h4>
          )
        },
        p({ children }) {
          return (
            <p className="mb-4 leading-7 text-muted-foreground">{children}</p>
          )
        },
        ul({ children }) {
          return (
            <ul className="mb-4 ml-1 list-inside list-disc space-y-1.5 text-muted-foreground marker:text-muted-foreground/50">
              {children}
            </ul>
          )
        },
        ol({ children }) {
          return (
            <ol className="mb-4 ml-1 list-inside list-decimal space-y-1.5 text-muted-foreground marker:text-muted-foreground/50">
              {children}
            </ol>
          )
        },
        li({ children }) {
          return <li className="leading-7">{children}</li>
        },
        strong({ children }) {
          const text = String(children)
          const definition = lookupGlossary(text)
          if (definition) {
            return (
              <Tooltip content={definition}>
                <strong className="font-semibold text-foreground">
                  {children}
                </strong>
              </Tooltip>
            )
          }
          return (
            <strong className="font-semibold text-foreground">{children}</strong>
          )
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "")
          if (match) {
            const lang = match[1]
            if (lang === "mermaid") {
              return <MermaidDiagram chart={String(children).trim()} />
            }
            return (
              <CodeBlock
                code={String(children).trimEnd()}
                language={lang}
              />
            )
          }

          // Inline code
          return (
            <code
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre({ children }) {
          // If CodeBlock/MermaidDiagram already handled the code child, pass through
          const child = Array.isArray(children) ? children[0] : children
          if (
            child &&
            typeof child === "object" &&
            "props" in child &&
            child.props?.className &&
            /language-/.test(child.props.className)
          ) {
            return <>{children}</>
          }
          // Plain code blocks without a language get basic styling
          return (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-[#24292e] p-4 font-mono text-sm leading-6 text-gray-100">
              {children}
            </pre>
          )
        },
        blockquote({ children }) {
          return (
            <blockquote className="mb-4 border-l-4 border-violet-300 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          )
        },
        table({ children }) {
          return (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">{children}</table>
            </div>
          )
        },
        th({ children }) {
          return (
            <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">
              {children}
            </th>
          )
        },
        td({ children }) {
          return (
            <td className="border-b border-border/50 px-3 py-2 text-muted-foreground">
              {children}
            </td>
          )
        },
        hr() {
          return <hr className="my-6 border-border" />
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
