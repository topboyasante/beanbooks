import { useParams, useNavigate, Navigate } from "react-router"
import { LessonViewer } from "@/components/lesson/lesson-viewer"
import { findLessonById } from "@/lib/lessons"
import { findCourseById } from "@/data/courses"

export function LessonPage() {
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const result = lessonId ? findLessonById(lessonId) : null
  const course = courseId ? findCourseById(courseId) : undefined

  if (!result || !course) return <Navigate to="/" replace />

  return (
    <LessonViewer
      lesson={result.lesson}
      course={course}
      onStartChallenge={() =>
        navigate(`/course/${courseId}/lesson/${result.lesson.id}/challenge`)
      }
    />
  )
}
