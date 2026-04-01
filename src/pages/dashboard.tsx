import { useNavigate } from "react-router"
import { Hero } from "@/components/dashboard/hero"
import { ProgressOverview } from "@/components/dashboard/progress-overview"
import { useProgress } from "@/lib/progress"
import { getFirstIncompleteLesson, totalLessons } from "@/lib/lessons"
import { modules } from "@/data/lessons"
import type { Lesson } from "@/types/learning"

export function DashboardPage() {
  const navigate = useNavigate()
  const { completedLessons } = useProgress()

  function handleStartLearning() {
    const lesson = getFirstIncompleteLesson(completedLessons)
    navigate(`/lesson/${lesson.id}`)
  }

  function handleSelectLesson(lesson: Lesson) {
    navigate(`/lesson/${lesson.id}`)
  }

  return (
    <div className="space-y-8">
      <Hero
        totalLessons={totalLessons}
        completedCount={completedLessons.length}
        onStartLearning={handleStartLearning}
      />
      <div>
        <h2 className="mb-2 text-lg font-bold text-foreground">
          Course Content
        </h2>
        <ProgressOverview
          modules={modules}
          completedLessons={completedLessons}
          onSelectLesson={handleSelectLesson}
        />
      </div>
    </div>
  )
}
