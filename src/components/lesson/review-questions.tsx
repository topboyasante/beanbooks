import { useState } from "react"
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Question } from "@/types/learning"

interface ReviewQuestionsProps {
  questions: Question[]
  lessonId: string
}

export function ReviewQuestions({ questions, lessonId: _lessonId }: ReviewQuestionsProps) {
  const [selected, setSelected] = useState<Map<number, number>>(new Map())
  const [checked, setChecked] = useState<Set<number>>(new Set())

  function selectOption(questionIdx: number, optionIdx: number) {
    if (checked.has(questionIdx)) return
    setSelected((prev) => new Map(prev).set(questionIdx, optionIdx))
  }

  function checkAnswer(questionIdx: number) {
    if (!selected.has(questionIdx)) return
    setChecked((prev) => new Set(prev).add(questionIdx))
  }

  function checkAll() {
    const newChecked = new Set(checked)
    for (let i = 0; i < questions.length; i++) {
      if (selected.has(i)) newChecked.add(i)
    }
    setChecked(newChecked)
  }

  const answeredCount = checked.size
  const correctCount = Array.from(checked).filter(
    (i) => selected.get(i) === questions[i].correctIndex,
  ).length

  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-foreground">
        <HelpCircle className="h-4 w-4" />
        <span className="text-sm font-semibold uppercase tracking-wide">
          Review Questions
        </span>
      </div>

      <div className="space-y-6">
        {questions.map((q, qi) => {
          const isChecked = checked.has(qi)
          const selectedOpt = selected.get(qi)
          const isCorrect = selectedOpt === q.correctIndex

          return (
            <div key={qi}>
              <p className="mb-3 text-sm font-medium text-foreground">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected = selectedOpt === oi
                  const isAnswer = q.correctIndex === oi

                  let optionStyle = "border-border text-muted-foreground hover:bg-muted/50"
                  if (isChecked) {
                    if (isAnswer) {
                      optionStyle = "border-green-300 bg-green-50 text-green-800"
                    } else if (isSelected && !isAnswer) {
                      optionStyle = "border-red-300 bg-red-50 text-red-800"
                    } else {
                      optionStyle = "border-border text-muted-foreground/50"
                    }
                  } else if (isSelected) {
                    optionStyle = "border-violet-300 bg-violet-50 text-violet-800"
                  }

                  return (
                    <button
                      key={oi}
                      onClick={() => selectOption(qi, oi)}
                      disabled={isChecked}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors",
                        optionStyle,
                      )}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isChecked && isAnswer && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      )}
                      {isChecked && isSelected && !isAnswer && (
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" />
                      )}
                    </button>
                  )
                })}
              </div>
              {!isChecked && selected.has(qi) && (
                <button
                  onClick={() => checkAnswer(qi)}
                  className="mt-2 text-xs font-medium text-violet-600 hover:text-violet-700"
                >
                  Check Answer
                </button>
              )}
              {isChecked && (
                <p
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isCorrect ? "text-green-600" : "text-red-600",
                  )}
                >
                  {isCorrect ? "Correct!" : `Incorrect — the answer is ${String.fromCharCode(65 + q.correctIndex)}.`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 flex items-center justify-between">
        {answeredCount < questions.length && (
          <button
            onClick={checkAll}
            className="text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            Check All
          </button>
        )}
        {answeredCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {correctCount}/{answeredCount} correct
          </p>
        )}
      </div>
    </section>
  )
}
