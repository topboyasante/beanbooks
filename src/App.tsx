import { useEffect } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router"
import { getHighlighter } from "@/lib/highlighter"
import { ProgressProvider } from "@/lib/progress"

// Preload shiki so it's ready before any lesson renders
getHighlighter()
import { SidebarLayout } from "@/pages/layout"
import { DashboardPage } from "@/pages/dashboard"
import { LessonPage } from "@/pages/lesson"
import { ChallengePage } from "@/pages/challenge"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // The scrollable container is <main>, not window (body has overflow-hidden)
    const main = document.querySelector("main")
    if (main) {
      main.scrollTo(0, 0)
    }
  }, [pathname])
  return null
}

export default function App() {
  return (
    <ProgressProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Challenge gets its own full-screen layout (no sidebar) */}
          <Route path="/lesson/:lessonId/challenge" element={<ChallengePage />} />

          {/* Everything else uses sidebar layout */}
          <Route element={<SidebarLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/lesson/:lessonId" element={<LessonPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ProgressProvider>
  )
}
