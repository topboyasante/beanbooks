const KEYS = {
  COMPLETED: "javabank-completed-lessons",
  ACTIVE: "javabank-active-lesson",
  CODE: "javabank-saved-code",
} as const

export function getCompletedLessons(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.COMPLETED) || "[]")
  } catch {
    return []
  }
}

export function markLessonComplete(lessonId: string): void {
  const completed = new Set(getCompletedLessons())
  completed.add(lessonId)
  localStorage.setItem(KEYS.COMPLETED, JSON.stringify([...completed]))
}

export function isLessonCompleted(lessonId: string): boolean {
  return getCompletedLessons().includes(lessonId)
}

export function getActiveLessonId(): string | null {
  return localStorage.getItem(KEYS.ACTIVE)
}

export function setActiveLessonId(lessonId: string): void {
  localStorage.setItem(KEYS.ACTIVE, lessonId)
}

export function getSavedCode(lessonId: string): string | null {
  return localStorage.getItem(`${KEYS.CODE}-${lessonId}`)
}

export function saveCode(lessonId: string, code: string): void {
  localStorage.setItem(`${KEYS.CODE}-${lessonId}`, code)
}

export function clearAllProgress(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith("javabank-")) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}
