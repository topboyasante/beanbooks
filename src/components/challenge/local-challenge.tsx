import { useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Terminal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/lesson/code-block"
import type { Challenge } from "@/types/learning"

interface LocalChallengeProps {
  lessonTitle: string
  challenge: Challenge
  onMarkComplete: () => void
  onBack: () => void
}

export function LocalChallenge({
  lessonTitle,
  challenge,
  onMarkComplete,
  onBack,
}: LocalChallengeProps) {
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyStarterCode() {
    navigator.clipboard.writeText(challenge.starterCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-semibold text-foreground">{lessonTitle}</p>
            <p className="text-xs text-muted-foreground">Challenge</p>
          </div>
        </div>
        <Button onClick={onMarkComplete} className="gap-2 bg-violet-600 hover:bg-violet-700">
          <CheckCircle2 className="h-4 w-4" />
          Mark Complete
        </Button>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Instructions */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-foreground">Instructions</h2>
          <p className="leading-7 text-muted-foreground">{challenge.instructions}</p>
        </section>

        {/* Starter Code */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Starter Code</h2>
            <Button variant="outline" size="sm" onClick={copyStarterCode} className="gap-1.5">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <CodeBlock code={challenge.starterCode} language="go" />
        </section>

        {/* Expected Output */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">Expected Output</h2>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-[#24292e] p-4 font-mono text-sm leading-6 text-gray-100">
            {challenge.expectedOutput}
          </pre>
        </section>

        {/* Hint */}
        <section>
          <button
            onClick={() => setShowHint(!showHint)}
            className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
          >
            {showHint ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {showHint ? "Hide Hint" : "Show Hint"}
          </button>
          {showHint && (
            <p className="mt-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              {challenge.hint}
            </p>
          )}
        </section>

        {/* Solution */}
        <section>
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
          >
            {showSolution ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {showSolution ? "Hide Solution" : "Show Solution"}
          </button>
          {showSolution && (
            <div className="mt-2">
              <CodeBlock code={challenge.solution} language="go" />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
