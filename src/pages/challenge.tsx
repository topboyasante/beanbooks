import { useParams, useNavigate, Navigate } from "react-router"
import { MonacoPlayground } from "@/components/playground/monaco-playground"
import { useProgress } from "@/lib/progress"
import { findLessonById, getNextLesson } from "@/lib/lessons"
import { getSavedCode, saveCode } from "@/lib/storage"

export function ChallengePage() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const { completedLessons, markComplete } = useProgress()
  const lesson = lessonId ? findLessonById(lessonId) : null

  if (!lesson) return <Navigate to="/" replace />

  function handleCodeChange(code: string) {
    saveCode(lesson!.id, code)
  }

  function handleMarkComplete() {
    markComplete(lesson!.id)
    const next = getNextLesson(lesson!)
    if (next) {
      navigate(`/lesson/${next.id}`)
    } else {
      navigate("/")
    }
  }

  return (
    <MonacoPlayground
      lessonTitle={lesson.title}
      moduleId={lesson.moduleId}
      challenge={lesson.challenge}
      savedCode={getSavedCode(lesson.id)}
      isCompleted={completedLessons.includes(lesson.id)}
      onCodeChange={handleCodeChange}
      onMarkComplete={handleMarkComplete}
      onBack={() => navigate(`/lesson/${lesson.id}`)}
    />
  )
}
