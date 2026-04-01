import { createHighlighter, type Highlighter } from "shiki"

let highlighter: Highlighter | null = null
let loading: Promise<Highlighter> | null = null

export async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter
  if (!loading) {
    loading = createHighlighter({
      themes: ["github-dark"],
      langs: ["java", "sql", "yaml", "properties", "dockerfile", "xml", "json", "bash"],
    }).then((h) => {
      highlighter = h
      return h
    })
  }
  return loading
}
