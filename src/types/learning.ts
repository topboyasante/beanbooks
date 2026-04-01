export interface Module {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  content: string; // markdown content
  bankingScenario: string; // markdown
  whyItMatters: string; // markdown
  challenge: Challenge;
  questions: Question[];
  order: number;
}

export interface Challenge {
  instructions: string; // markdown
  starterCode: string;
  expectedOutput: string;
  hint: string;
  solution: string;
}

export interface Question {
  question: string
  options: string[]
  correctIndex: number
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  savedCode?: string;
}

export interface SimulatorResult {
  output: string;
  expectedOutput: string;
  isCorrect: boolean;
  feedback: string;
}
