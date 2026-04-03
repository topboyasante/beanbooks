export interface Course {
  id: string
  title: string
  description: string
  icon: string
  scenarioLabel: string
  scenarioIcon: string
  modules: Module[]
}

export interface Module {
  id: string
  title: string
  description: string
  icon: string
  lessons: Lesson[]
}

export interface Lesson {
  id: string
  courseId: string
  moduleId: string
  title: string
  description: string
  content: string
  scenario: string
  whyItMatters: string
  challenge?: Challenge
  questions: Question[]
  order: number
}

export interface Challenge {
  instructions: string
  starterCode: string
  expectedOutput: string
  hint: string
  solution: string
}

export interface Question {
  question: string
  options: string[]
  correctIndex: number
}

export interface LessonProgress {
  lessonId: string
  completed: boolean
  savedCode?: string
}
