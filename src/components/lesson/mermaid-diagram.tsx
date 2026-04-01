import { useEffect, useRef, useState, useId } from "react"
import mermaid from "mermaid"

mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "Geist Variable, sans-serif",
})

// Serialize mermaid renders to avoid concurrent render crashes
let renderQueue = Promise.resolve()

function renderMermaid(id: string, chart: string): Promise<string> {
  return new Promise((resolve, reject) => {
    renderQueue = renderQueue.then(async () => {
      try {
        // Clean up any stale element from a previous failed render
        document.getElementById(id)?.remove()
        const { svg } = await mermaid.render(id, chart)
        resolve(svg)
      } catch (e) {
        // Clean up the failed render element
        document.getElementById(id)?.remove()
        reject(e)
      }
    })
  })
}

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const reactId = useId()
  const safeId = `mermaid-${reactId.replace(/:/g, "")}`

  useEffect(() => {
    let cancelled = false

    renderMermaid(safeId, chart)
      .then((svg) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram")
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, safeId])

  if (error) {
    return (
      <div className="my-4 rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
        Unable to render diagram
      </div>
    )
  }

  const hasContent = containerRef.current?.innerHTML

  return (
    <div
      ref={containerRef}
      className="my-4 flex min-h-[80px] items-center justify-center overflow-x-auto rounded-lg bg-muted/30 p-4"
    >
      {!hasContent && !error && (
        <span className="text-xs text-muted-foreground">Loading diagram...</span>
      )}
    </div>
  )
}
