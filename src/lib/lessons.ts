import { courses } from "@/data/courses"
import type { Lesson, Module, Course } from "@/types/learning"

export function findLessonById(id: string): { lesson: Lesson; course: Course; module: Module } | null {
  for (const course of courses) {
    for (const mod of course.modules) {
      const lesson = mod.lessons.find((l) => l.id === id)
      if (lesson) return { lesson, course, module: mod }
    }
  }
  return null
}

export function getFirstIncompleteLesson(course: Course, completed: string[]): Lesson {
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (!completed.includes(lesson.id)) return lesson
    }
  }
  return course.modules[0].lessons[0]
}

export function getNextLesson(course: Course, currentLesson: Lesson): Lesson | null {
  const mod = course.modules.find((m) => m.id === currentLesson.moduleId)
  if (!mod) return null
  const idx = mod.lessons.findIndex((l) => l.id === currentLesson.id)
  if (idx < mod.lessons.length - 1) return mod.lessons[idx + 1]
  const modIdx = course.modules.indexOf(mod)
  if (modIdx < course.modules.length - 1) return course.modules[modIdx + 1].lessons[0]
  return null
}

export function getTotalLessons(course: Course): number {
  return course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
}

export interface SearchResult {
  lesson: Lesson
  module: Module
  course: Course
  matchContext: string
}

export function searchLessons(query: string, course?: Course): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const titleMatches: SearchResult[] = []
  const descMatches: SearchResult[] = []
  const contentMatches: SearchResult[] = []

  const searchCourses = course ? [course] : courses

  for (const c of searchCourses) {
    for (const mod of c.modules) {
      for (const lesson of mod.lessons) {
        if (lesson.title.toLowerCase().includes(q)) {
          titleMatches.push({ lesson, module: mod, course: c, matchContext: lesson.description })
        } else if (lesson.description.toLowerCase().includes(q)) {
          descMatches.push({ lesson, module: mod, course: c, matchContext: lesson.description })
        } else if (lesson.content.toLowerCase().includes(q)) {
          const idx = lesson.content.toLowerCase().indexOf(q)
          const start = Math.max(0, idx - 40)
          const end = Math.min(lesson.content.length, idx + query.length + 40)
          const snippet =
            (start > 0 ? "..." : "") +
            lesson.content.slice(start, end).replace(/\n/g, " ") +
            (end < lesson.content.length ? "..." : "")
          contentMatches.push({ lesson, module: mod, course: c, matchContext: snippet })
        }
      }
    }
  }

  return [...titleMatches, ...descMatches, ...contentMatches].slice(0, 20)
}
