import { modules } from "@/data/lessons"
import type { Lesson, Module } from "@/types/learning"

export function findLessonById(id: string): Lesson | null {
  for (const mod of modules) {
    const lesson = mod.lessons.find((l) => l.id === id)
    if (lesson) return lesson
  }
  return null
}

export function getFirstIncompleteLesson(completed: string[]): Lesson {
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (!completed.includes(lesson.id)) return lesson
    }
  }
  return modules[0].lessons[0]
}

export function getNextLesson(currentLesson: Lesson): Lesson | null {
  const mod = modules.find((m) => m.id === currentLesson.moduleId)
  if (!mod) return null
  const idx = mod.lessons.findIndex((l) => l.id === currentLesson.id)
  if (idx < mod.lessons.length - 1) return mod.lessons[idx + 1]
  // Try first lesson of next module
  const modIdx = modules.indexOf(mod)
  if (modIdx < modules.length - 1) return modules[modIdx + 1].lessons[0]
  return null
}

export const totalLessons = modules.reduce(
  (sum, m) => sum + m.lessons.length,
  0,
)

export interface SearchResult {
  lesson: Lesson
  module: Module
  matchContext: string
}

export function searchLessons(query: string): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const titleMatches: SearchResult[] = []
  const descMatches: SearchResult[] = []
  const contentMatches: SearchResult[] = []

  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (lesson.title.toLowerCase().includes(q)) {
        titleMatches.push({ lesson, module: mod, matchContext: lesson.description })
      } else if (lesson.description.toLowerCase().includes(q)) {
        descMatches.push({ lesson, module: mod, matchContext: lesson.description })
      } else if (lesson.content.toLowerCase().includes(q)) {
        const idx = lesson.content.toLowerCase().indexOf(q)
        const start = Math.max(0, idx - 40)
        const end = Math.min(lesson.content.length, idx + query.length + 40)
        const snippet = (start > 0 ? "..." : "") + lesson.content.slice(start, end).replace(/\n/g, " ") + (end < lesson.content.length ? "..." : "")
        contentMatches.push({ lesson, module: mod, matchContext: snippet })
      }
    }
  }

  return [...titleMatches, ...descMatches, ...contentMatches].slice(0, 20)
}
