import { createContext, useContext, useState, useCallback, useEffect } from "react"
import {
  getCompletedLessons,
  markLessonComplete as storageMarkComplete,
} from "@/lib/storage"

interface ProgressContextValue {
  completedLessons: string[]
  markComplete: (lessonId: string) => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [completedLessons, setCompletedLessons] = useState<string[]>([])

  useEffect(() => {
    setCompletedLessons(getCompletedLessons())
  }, [])

  const markComplete = useCallback((lessonId: string) => {
    storageMarkComplete(lessonId)
    setCompletedLessons(getCompletedLessons())
  }, [])

  return (
    <ProgressContext.Provider value={{ completedLessons, markComplete }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider")
  return ctx
}
