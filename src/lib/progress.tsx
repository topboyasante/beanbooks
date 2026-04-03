import { createContext, useContext, useState, useCallback, useEffect } from "react"
import {
  getCompletedLessons,
  markLessonComplete as storageMarkComplete,
} from "@/lib/storage"

interface ProgressContextValue {
  courseId: string
  completedLessons: string[]
  markComplete: (lessonId: string) => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({
  courseId,
  children,
}: {
  courseId: string
  children: React.ReactNode
}) {
  const [completedLessons, setCompletedLessons] = useState<string[]>([])

  useEffect(() => {
    setCompletedLessons(getCompletedLessons(courseId))
  }, [courseId])

  const markComplete = useCallback(
    (lessonId: string) => {
      storageMarkComplete(courseId, lessonId)
      setCompletedLessons(getCompletedLessons(courseId))
    },
    [courseId],
  )

  return (
    <ProgressContext.Provider value={{ courseId, completedLessons, markComplete }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider")
  return ctx
}
