import { useNavigate } from "react-router"
import { Building2 } from "lucide-react"
import { courses } from "@/data/courses"
import { getCompletedLessons } from "@/lib/storage"
import { getTotalLessons } from "@/lib/lessons"
import { Progress } from "@/components/ui/progress"

export function CoursePickerPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="flex items-center gap-2.5 px-6 py-4">
          <Building2 className="h-5 w-5 text-violet-600" />
          <span className="text-base font-semibold text-foreground">Beanbooks</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
          Choose a course
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Pick a learning path to get started.
        </p>

        <div className="space-y-3">
          {courses.map((course) => {
            const completed = getCompletedLessons(course.id)
            const total = getTotalLessons(course)
            const percentage = total > 0 ? Math.round((completed.length / total) * 100) : 0

            return (
              <button
                key={course.id}
                onClick={() => navigate(`/course/${course.id}`)}
                className="flex w-full items-center gap-4 rounded-lg border border-border px-5 py-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-foreground">{course.title}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {course.description}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={percentage} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {completed.length}/{total}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
