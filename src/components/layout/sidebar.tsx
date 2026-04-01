import { useState } from "react"
import {
  Building2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Code2,
  Rocket,
  X,
  Cpu,
  Boxes,
  TestTube,
  Leaf,
  Zap,
  Server,
  Search,
  Trophy,
  GitBranch,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Module, Lesson } from "@/types/learning"

const iconMap: Record<string, React.ElementType> = {
  cpu: Cpu,
  "code-2": Code2,
  boxes: Boxes,
  rocket: Rocket,
  "test-tube": TestTube,
  leaf: Leaf,
  zap: Zap,
  server: Server,
  trophy: Trophy,
  "git-branch": GitBranch,
}

interface SidebarProps {
  modules: Module[]
  activeLesson: Lesson | null
  completedLessons: string[]
  onSelectLesson: (lesson: Lesson) => void
  onGoHome: () => void
  open: boolean
  onClose: () => void
  onSearchOpen: () => void
}

export function Sidebar({
  modules,
  activeLesson,
  completedLessons,
  onSelectLesson,
  onGoHome,
  open,
  onClose,
  onSearchOpen,
}: SidebarProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map((m) => m.id)),
  )

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  function handleSelectLesson(lesson: Lesson) {
    onSelectLesson(lesson)
    onClose()
  }

  function handleGoHome() {
    onGoHome()
    onClose()
  }

  return (
    <>
      {/* Backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] shrink-0 flex-col bg-[#1c1d1f] text-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <button
            onClick={handleGoHome}
            className="flex items-center gap-2.5 text-left hover:opacity-80"
          >
            <Building2 className="h-5 w-5 text-violet-400" />
            <span className="text-base font-semibold">JavaBank Lab</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={onSearchOpen}
          className="mx-3 mt-3 flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search lessons...</span>
          <kbd className="text-[10px] text-gray-600">⌘K</kbd>
        </button>

        <nav className="flex-1 overflow-y-auto py-2">
          {modules.map((mod) => {
            const Icon = iconMap[mod.icon] ?? Code2
            const completedCount = mod.lessons.filter((l) =>
              completedLessons.includes(l.id),
            ).length
            const isExpanded = expandedModules.has(mod.id)

            return (
              <div key={mod.id}>
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="flex w-full items-center gap-2.5 px-5 py-3 text-left text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                  )}
                  <Icon className="h-4 w-4 shrink-0 text-violet-400" />
                  <span className="flex-1 truncate">{mod.title}</span>
                  <span className="text-xs text-gray-500">
                    {completedCount}/{mod.lessons.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="pb-1">
                    {mod.lessons.map((lesson) => {
                      const isActive = activeLesson?.id === lesson.id
                      const isCompleted = completedLessons.includes(lesson.id)

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => handleSelectLesson(lesson)}
                          className={cn(
                            "flex w-full items-center gap-2.5 py-2 pl-12 pr-5 text-left text-sm transition-colors",
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-gray-600" />
                          )}
                          <span className="truncate">{lesson.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
