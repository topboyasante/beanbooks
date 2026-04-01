import { GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface HeroProps {
  totalLessons: number
  completedCount: number
  onStartLearning: () => void
}

export function Hero({ totalLessons, completedCount, onStartLearning }: HeroProps) {
  const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  return (
    <div className="py-4 sm:py-6 lg:py-8">
      <div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-violet-600">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-medium">Interactive Learning</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            Welcome to JavaBank Lab
          </h1>
          <p className="mb-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Learn Java backend development through real banking scenarios. Build a
            digital bank from the ground up while mastering core Java concepts.
          </p>

          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} of {totalLessons} lessons completed
            </span>
            <span className="font-medium text-foreground">{percentage}%</span>
          </div>
          <Progress value={percentage} className="mb-6" />

          <Button onClick={onStartLearning} className="bg-violet-600 hover:bg-violet-700">
            {completedCount > 0 ? "Continue Learning" : "Start Learning"}
          </Button>
        </div>
      </div>
    </div>
  )
}
