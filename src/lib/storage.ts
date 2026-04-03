function keys(courseId: string) {
  return {
    COMPLETED: `beanbooks-${courseId}-completed`,
    ACTIVE: `beanbooks-${courseId}-active`,
    CODE: `beanbooks-${courseId}-code`,
  } as const
}

export function getCompletedLessons(courseId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(keys(courseId).COMPLETED) || "[]")
  } catch {
    return []
  }
}

export function markLessonComplete(courseId: string, lessonId: string): void {
  const completed = new Set(getCompletedLessons(courseId))
  completed.add(lessonId)
  localStorage.setItem(keys(courseId).COMPLETED, JSON.stringify([...completed]))
}

export function isLessonCompleted(courseId: string, lessonId: string): boolean {
  return getCompletedLessons(courseId).includes(lessonId)
}

export function getActiveLessonId(courseId: string): string | null {
  return localStorage.getItem(keys(courseId).ACTIVE)
}

export function setActiveLessonId(courseId: string, lessonId: string): void {
  localStorage.setItem(keys(courseId).ACTIVE, lessonId)
}

export function getSavedCode(courseId: string, lessonId: string): string | null {
  return localStorage.getItem(`${keys(courseId).CODE}-${lessonId}`)
}

export function saveCode(courseId: string, lessonId: string, code: string): void {
  localStorage.setItem(`${keys(courseId).CODE}-${lessonId}`, code)
}

export function clearCourseProgress(courseId: string): void {
  const prefix = `beanbooks-${courseId}-`
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}
