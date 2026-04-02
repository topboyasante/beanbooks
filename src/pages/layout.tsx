import { useState, useEffect, useCallback } from "react"
import { Outlet, useNavigate, useParams } from "react-router"
import { Menu, Building2 } from "lucide-react"
import { Sidebar } from "@/components/layout/sidebar"
import { SearchDialog } from "@/components/search/search-dialog"
import { useProgress } from "@/lib/progress"
import { findLessonById } from "@/lib/lessons"
import { modules } from "@/data/lessons"
import type { Lesson } from "@/types/learning"

export function SidebarLayout() {
  const navigate = useNavigate()
  const { lessonId } = useParams()
  const { completedLessons } = useProgress()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const activeLesson = lessonId ? findLessonById(lessonId) : null

  // Cmd+K / Ctrl+K shortcut
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
    (lesson: Lesson) => navigate(`/lesson/${lesson.id}`),
    [navigate],
  )

  const handleSearchSelect = useCallback(
    (id: string) => navigate(`/lesson/${id}`),
    [navigate],
  )

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        modules={modules}
        activeLesson={activeLesson}
        completedLessons={completedLessons}
        onSelectLesson={handleSelectLesson}
        onGoHome={() => navigate("/")}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSearchOpen={() => setSearchOpen(true)}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Building2 className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold text-foreground">
            Beanbooks
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
