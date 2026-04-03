import { useState, useEffect, useCallback } from "react"
import { Outlet, useNavigate, useParams, Navigate } from "react-router"
import { Menu, Building2 } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { SearchDialog } from "@/components/search/search-dialog"
import { ProgressProvider, useProgress } from "@/lib/progress"
import { findLessonById } from "@/lib/lessons"
import { findCourseById } from "@/data/courses"
import type { Lesson } from "@/types/learning"

export function SidebarLayout() {
  const { courseId } = useParams()
  const course = courseId ? findCourseById(courseId) : undefined

  if (!course) return <Navigate to="/" replace />

  return (
    <ProgressProvider courseId={course.id}>
      <SidebarLayoutInner />
    </ProgressProvider>
  )
}

function SidebarLayoutInner() {
  const navigate = useNavigate()
  const { courseId, lessonId } = useParams()
  const { completedLessons } = useProgress()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const course = findCourseById(courseId!)!
  const activeLesson = lessonId ? findLessonById(lessonId)?.lesson ?? null : null

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelectLesson = useCallback(
    (lesson: Lesson) => navigate(`/course/${courseId}/lesson/${lesson.id}`),
    [navigate, courseId],
  )

  const handleSearchSelect = useCallback(
    (id: string) => navigate(`/course/${courseId}/lesson/${id}`),
    [navigate, courseId],
  )

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        modules={course.modules}
        courseTitle={course.title}
        activeLesson={activeLesson}
        completedLessons={completedLessons}
        onSelectLesson={handleSelectLesson}
        onGoHome={() => navigate(`/course/${courseId}`)}
        onGoBack={() => navigate("/")}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSearchOpen={() => setSearchOpen(true)}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        course={course}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Building2 className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold text-foreground">
            {course.title}
          </span>
        </div>

        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
