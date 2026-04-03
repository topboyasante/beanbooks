import { useState, useEffect, useRef, useCallback } from "react"
import { Search, FileText, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { searchLessons, type SearchResult } from "@/lib/lessons"
import type { Course } from "@/types/learning"

interface SearchDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (lessonId: string) => void
  course: Course
}

export function SearchDialog({ open, onClose, onSelect, course }: SearchDialogProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    setSelectedIndex(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setResults(searchLessons(value, course))
    }, 150)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && results[selectedIndex]) {
      onSelect(results[selectedIndex].lesson.id)
      onClose()
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-0 top-[15%] z-[101] mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-lg bg-background">
          {/* Input */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search lessons..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={onClose}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {query && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No lessons found for "{query}"
              </div>
            )}
            {results.map((result, i) => (
              <button
                key={result.lesson.id}
                onClick={() => {
                  onSelect(result.lesson.id)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                  i === selectedIndex
                    ? "bg-violet-50 dark:bg-violet-950/20"
                    : "hover:bg-muted/50",
                )}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {result.lesson.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {result.module.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground/70">
                    {result.matchContext}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span className="mr-3">
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↑↓</kbd> navigate
            </span>
            <span className="mr-3">
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">↵</kbd> open
            </span>
            <span>
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
