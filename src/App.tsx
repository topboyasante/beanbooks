import { useEffect } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router"
import { getHighlighter } from "@/lib/highlighter"

getHighlighter()

import { SidebarLayout } from "@/pages/layout"
import { CoursePickerPage } from "@/pages/course-picker"
import { DashboardPage } from "@/pages/dashboard"
import { LessonPage } from "@/pages/lesson"
import { ChallengePage } from "@/pages/challenge"

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const main = document.querySelector("main")
    if (main) {
      main.scrollTo(0, 0)
    }
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route index element={<CoursePickerPage />} />

        <Route path="/course/:courseId/lesson/:lessonId/challenge" element={<ChallengePage />} />

        <Route path="/course/:courseId" element={<SidebarLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="lesson/:lessonId" element={<LessonPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
