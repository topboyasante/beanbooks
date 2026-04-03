import { useState } from "react"
import {
  Code2,
  Rocket,
  ChevronDown,
  CheckCircle2,
  Circle,
  PlayCircle,
  Cpu,
  Boxes,
  TestTube,
  Leaf,
  Zap,
  Server,
  Trophy,
  GitBranch,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
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

interface ProgressOverviewProps {
  modules: Module[]
  completedLessons: string[]
  onSelectLesson: (lesson: Lesson) => void
}

export function ProgressOverview({
  modules,
  completedLessons,
  onSelectLesson,
}: ProgressOverviewProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set([modules[0]?.id]),
  )

  function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  return (
    <div className="space-y-0">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {modules.length} modules &middot;{" "}
          {modules.reduce((s, m) => s + m.lessons.length, 0)} lessons
        </p>
        <button
          onClick={() => {
            const allExpanded = modules.every((m) => expandedModules.has(m.id))
            setExpandedModules(
              allExpanded ? new Set() : new Set(modules.map((m) => m.id)),
            )
          }}
          className="text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          {modules.every((m) => expandedModules.has(m.id))
            ? "Collapse all"
            : "Expand all"}
        </button>
      </div>

      <div className="divide-y divide-border border-y border-border">
        {modules.map((mod) => {
          const Icon = iconMap[mod.icon] ?? Code2
          const completedCount = mod.lessons.filter((l) =>
            completedLessons.includes(l.id),
          ).length
          const percentage =
            mod.lessons.length > 0
              ? Math.round((completedCount / mod.lessons.length) * 100)
              : 0
          const isExpanded = expandedModules.has(mod.id)

          return (
            <div key={mod.id}>
              {/* Module header */}
              <button
                onClick={() => toggleModule(mod.id)}
                className="flex w-full items-center gap-4 bg-muted/40 px-5 py-4 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">
                      {mod.title}
                    </h3>
                    {percentage === 100 && (
                      <span className="text-xs font-medium text-green-600">
                        Complete
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {completedCount}/{mod.lessons.length} lessons &middot;{" "}
                    {mod.description}
                  </p>
                  <Progress value={percentage} className="mt-2 h-1" />
                </div>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>

              {/* Lesson list */}
              {isExpanded && (
                <div className="divide-y divide-border/50">
                  {mod.lessons.map((lesson) => {
                    const isCompleted = completedLessons.includes(lesson.id)

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => onSelectLesson(lesson)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm",
                              isCompleted
                                ? "text-muted-foreground"
                                : "text-foreground",
                            )}
                          >
                            {lesson.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {lesson.description}
                          </p>
                        </div>
                        <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
