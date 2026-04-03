import type { Course } from "@/types/learning"
import { javaBankingCourse } from "./courses/java-banking"
import { goSystemsCourse } from "./courses/go-systems"

export const courses: Course[] = [javaBankingCourse, goSystemsCourse]

export function findCourseById(id: string): Course | undefined {
  return courses.find((c) => c.id === id)
}
