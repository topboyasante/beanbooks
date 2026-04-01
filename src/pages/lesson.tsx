import { useParams, useNavigate, Navigate } from "react-router"
import { LessonViewer } from "@/components/lesson/lesson-viewer"
import { findLessonById } from "@/lib/lessons"

export function LessonPage() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const lesson = lessonId ? findLessonById(lessonId) : null

  if (!lesson) return <Navigate to="/" replace />

  return (
    <LessonViewer
      lesson={lesson}
      onStartChallenge={() => navigate(`/lesson/${lesson.id}/challenge`)}
    />
  )
}
