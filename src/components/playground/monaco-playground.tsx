import { useState, useCallback } from "react"
import Editor from "@monaco-editor/react"
import {
  Play,
  RotateCcw,
  Lightbulb,
  Eye,
  CheckCircle2,
  Terminal,
  ArrowLeft,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { simulateJava } from "@/lib/java-simulator"
import { buildOnlineCompilerUrl, canSimulateLocally } from "@/lib/external-compiler"
import type { Challenge } from "@/types/learning"

interface MonacoPlaygroundProps {
  lessonTitle: string
  moduleId: string
  challenge: Challenge
  savedCode?: string | null
  isCompleted: boolean
  onCodeChange: (code: string) => void
  onMarkComplete: () => void
  onBack: () => void
}

export function MonacoPlayground({
  lessonTitle,
  moduleId,
  challenge,
  savedCode,
  isCompleted,
  onCodeChange,
  onMarkComplete,
  onBack,
}: MonacoPlaygroundProps) {
  const [code, setCode] = useState(savedCode || challenge.starterCode)
  const [output, setOutput] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newCode = value || ""
      setCode(newCode)
      onCodeChange(newCode)
    },
    [onCodeChange],
  )

  function handleRun() {
    const result = simulateJava(code, challenge.expectedOutput)
    setOutput(result.output)
    setIsCorrect(result.isCorrect)
    setFeedback(result.feedback)
  }

  function handleReset() {
    setCode(challenge.starterCode)
    onCodeChange(challenge.starterCode)
    setOutput(null)
    setIsCorrect(null)
    setFeedback(null)
    setShowHint(false)
    setShowSolution(false)
  }

  function handleShowSolution() {
    setShowSolution(true)
    setCode(challenge.solution)
    onCodeChange(challenge.solution)
  }

  return (
    <div className="flex h-screen flex-col bg-[#1e1e1e]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Lesson
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm font-medium text-white">{lessonTitle}</span>
          {isCompleted && (
            <Badge variant="success" className="ml-1">
              Completed
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white"
            onClick={() => setShowHint(!showHint)}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Hint
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white"
            onClick={handleShowSolution}
          >
            <Eye className="h-3.5 w-3.5" />
            Solution
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-gray-400 hover:text-white"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-green-600 text-xs text-white hover:bg-green-700"
            onClick={handleRun}
          >
            <Play className="h-3.5 w-3.5" />
            Run Code
          </Button>
          {!canSimulateLocally(moduleId) && (
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-violet-600 text-xs text-white hover:bg-violet-700"
              onClick={() => window.open(buildOnlineCompilerUrl(code), "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Run Online
            </Button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Instructions + Hint */}
        <div className="flex w-80 shrink-0 flex-col border-r border-white/10">
          <div className="flex-1 overflow-y-auto p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Challenge
            </h3>
            <p className="text-sm leading-relaxed text-gray-300">
              {challenge.instructions}
            </p>

            {showHint && (
              <div className="mt-5 rounded-lg bg-amber-500/10 p-4">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                  <Lightbulb className="h-4 w-4" />
                  Hint
                </div>
                <p className="text-sm text-amber-200/80">{challenge.hint}</p>
              </div>
            )}

            {challenge.expectedOutput && (
              <div className="mt-5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Expected Output
                </h4>
                <pre className="rounded-lg bg-white/5 p-3 font-mono text-xs leading-5 text-gray-400">
                  {challenge.expectedOutput}
                </pre>
              </div>
            )}
          </div>

          {!isCompleted && (
            <div className="border-t border-white/10 p-4">
              <Button
                onClick={onMarkComplete}
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Complete
              </Button>
            </div>
          )}
        </div>

        {/* Right: Editor + Output */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Editor */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-white/10 px-4 py-1.5">
              <span className="text-xs font-medium text-gray-500">
                Main.java
              </span>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="java"
                value={code}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                  fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
                }}
              />
            </div>
          </div>

          {/* Output panel */}
          {output !== null && (
            <div className="border-t border-white/10">
              <div className="flex items-center gap-2 px-4 py-1.5">
                <Terminal className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">
                  Output
                </span>
                {isCorrect !== null && (
                  <Badge
                    variant={isCorrect ? "success" : "destructive"}
                    className="ml-auto"
                  >
                    {isCorrect ? "Pass" : "Fail"}
                  </Badge>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto px-4 pb-4">
                <pre className="font-mono text-sm text-green-400">
                  {output || "(no output)"}
                </pre>
                {feedback && (
                  <p
                    className={cn(
                      "mt-2 text-sm font-medium",
                      isCorrect ? "text-green-400" : "text-red-400",
                    )}
                  >
                    {feedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
