import { useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"

interface TooltipProps {
  content: string
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [coords, setCoords] = useState<{ x: number; y: number; above: boolean } | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const above = rect.top > 100
    setCoords({
      x: rect.left + rect.width / 2,
      y: above ? rect.top - 8 : rect.bottom + 8,
      above,
    })
  }, [])

  const hide = useCallback(() => setCoords(null), [])

  return (
    <span
      ref={triggerRef}
      className="inline"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="cursor-help border-b border-dashed border-violet-400/50">
        {children}
      </span>
      {coords &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              left: `${coords.x}px`,
              top: coords.above ? undefined : `${coords.y}px`,
              bottom: coords.above ? `${window.innerHeight - coords.y}px` : undefined,
              transform: "translateX(-50%)",
            }}
            className="z-[9999] w-64 rounded-lg bg-[#1c1d1f] px-3 py-2 text-xs font-normal leading-relaxed text-gray-200 shadow-lg"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  )
}
