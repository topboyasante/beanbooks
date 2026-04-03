import { useParams, useNavigate, Navigate } from "react-router"
import { ProgressProvider, useProgress } from "@/lib/progress"
import { findLessonById, getNextLesson } from "@/lib/lessons"
import { findCourseById } from "@/data/courses"
import { LocalChallenge } from "@/components/challenge/local-challenge"

export function ChallengePage() {
  const { courseId } = useParams()
  const course = courseId ? findCourseById(courseId) : undefined

  if (!course) return <Navigate to="/" replace />

  return (
    <ProgressProvider courseId={course.id}>
      <ChallengePageInner />
    </ProgressProvider>
  )
}

function ChallengePageInner() {
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const { markComplete } = useProgress()
  const result = lessonId ? findLessonById(lessonId) : null
  const course = courseId ? findCourseById(courseId) : undefined

  if (!result || !course || !result.lesson.challenge) {
    return <Navigate to={`/course/${courseId}`} replace />
  }

  function handleMarkComplete() {
    markComplete(result!.lesson.id)
    const next = getNextLesson(course!, result!.lesson)
    if (next) {
      navigate(`/course/${courseId}/lesson/${next.id}`)
    } else {
      navigate(`/course/${courseId}`)
    }
  }

  return (
    <LocalChallenge
      lessonTitle={result.lesson.title}
      challenge={result.lesson.challenge}
      onMarkComplete={handleMarkComplete}
      onBack={() => navigate(`/course/${courseId}/lesson/${result!.lesson.id}`)}
    />
  )
}
