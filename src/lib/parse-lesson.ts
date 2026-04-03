import type { Lesson, Challenge, Question } from "@/types/learning"

interface LessonFrontmatter {
  id: string
  courseId: string
  moduleId: string
  title: string
  description: string
  order: number
}

export function parseLesson(raw: string): Lesson {
  const { frontmatter, body } = parseFrontmatter(raw)
  const sections = parseSections(body)

  const hasChallenge = !!(sections["Challenge"] || sections["Starter Code"])
  const challenge: Challenge | undefined = hasChallenge
    ? {
        instructions: sections["Challenge"] || "",
        starterCode: extractCodeBlock(sections["Starter Code"] || ""),
        expectedOutput: extractCodeBlock(sections["Expected Output"] || ""),
        hint: sections["Hint"] || "",
        solution: extractCodeBlock(sections["Solution"] || ""),
      }
    : undefined

  return {
    id: frontmatter.id,
    courseId: frontmatter.courseId || "",
    moduleId: frontmatter.moduleId,
    title: frontmatter.title,
    description: frontmatter.description,
    order: frontmatter.order,
    scenario: sections["Banking Scenario"] || sections["Scenario"] || "",
    content: sections["Content"] || "",
    whyItMatters: sections["Why It Matters"] || "",
    questions: parseQuestions(sections["Questions"] || ""),
    challenge,
  }
}

function parseFrontmatter(raw: string): {
  frontmatter: LessonFrontmatter
  body: string
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    throw new Error("Invalid lesson file: missing frontmatter")
  }

  const yamlBlock = match[1]
  const body = match[2]

  const frontmatter: Record<string, string | number> = {}
  for (const line of yamlBlock.split("\n")) {
    const kvMatch = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      frontmatter[key] = key === "order" ? parseInt(value, 10) : value
    }
  }

  return {
    frontmatter: frontmatter as unknown as LessonFrontmatter,
    body,
  }
}

function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const sectionHeaders = [
    "Banking Scenario",
    "Scenario",
    "Content",
    "Why It Matters",
    "Questions",
    "Challenge",
    "Starter Code",
    "Expected Output",
    "Hint",
    "Solution",
  ]

  const headerRegex = /^## (.+)$/gm
  const matches: { name: string; index: number }[] = []
  let m
  while ((m = headerRegex.exec(body)) !== null) {
    if (sectionHeaders.includes(m[1])) {
      matches.push({ name: m[1], index: m.index })
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].name.length + 4
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length
    sections[matches[i].name] = body.slice(start, end).trim()
  }

  return sections
}

function parseQuestions(section: string): Question[] {
  if (!section.trim()) return []

  const questions: Question[] = []
  const blocks = section.split(/^Q:\s*/m).filter(Boolean)

  for (const block of blocks) {
    const lines = block.trim().split("\n")
    const question = lines[0].trim()
    const options: string[] = []
    let correctIndex = 0

    for (const line of lines.slice(1)) {
      const optMatch = line.match(/^([A-D])\)\s*(.+)$/)
      if (optMatch) {
        options.push(optMatch[2].trim())
      }
      const correctMatch = line.match(/^Correct:\s*([A-D])$/i)
      if (correctMatch) {
        correctIndex = correctMatch[1].charCodeAt(0) - 65
      }
    }

    if (question && options.length >= 2) {
      questions.push({ question, options, correctIndex })
    }
  }

  return questions
}

function extractCodeBlock(section: string): string {
  const match = section.match(/```(?:\w*)\n([\s\S]*?)```/)
  if (match) return match[1].trimEnd()
  return section.trim()
}
