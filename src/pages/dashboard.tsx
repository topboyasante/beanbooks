import { useNavigate, useParams } from "react-router"
import { Hero } from "@/components/dashboard/hero"
import { ProgressOverview } from "@/components/dashboard/progress-overview"
import { useProgress } from "@/lib/progress"
import { getFirstIncompleteLesson, getTotalLessons } from "@/lib/lessons"
import { findCourseById } from "@/data/courses"
import type { Lesson } from "@/types/learning"

export function DashboardPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const { completedLessons } = useProgress()
  const course = findCourseById(courseId!)!

  function handleStartLearning() {
    const lesson = getFirstIncompleteLesson(course, completedLessons)
    navigate(`/course/${courseId}/lesson/${lesson.id}`)
  }

  function handleSelectLesson(lesson: Lesson) {
    navigate(`/course/${courseId}/lesson/${lesson.id}`)
  }

  return (
    <div className="space-y-8">
      <Hero
        courseTitle={course.title}
        courseDescription={course.description}
        totalLessons={getTotalLessons(course)}
        completedCount={completedLessons.length}
        onStartLearning={handleStartLearning}
      />
      <div>
        <h2 className="mb-2 text-lg font-bold text-foreground">
          Course Content
        </h2>
        <ProgressOverview
          modules={course.modules}
          completedLessons={completedLessons}
          onSelectLesson={handleSelectLesson}
        />
      </div>
    </div>
  )
}
