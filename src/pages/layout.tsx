import { useState, useEffect, useCallback } from "react"
import { Outlet, useNavigate, useParams, Navigate, Link } from "react-router"
import { Menu, Building2 } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { SearchDialog } from "@/components/search/search-dialog"
import { ProgressProvider, useProgress } from "@/lib/progress"
import { findLessonById } from "@/lib/lessons"
import { findCourseById } from "@/data/courses"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">
                    <Building2 className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {activeLesson ? (
                  <BreadcrumbLink asChild>
                    <Link to={`/course/${courseId}`}>{course.title}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{course.title}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {activeLesson && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeLesson.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
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
