import { useEffect, useState } from "react"
import { reducedMotion } from "@/components/editor/layout"

/**
 * Keeps something on the page for `ms` after it's closed, so it can animate
 * away rather than vanish: whether it's shown, and whether it's on its way
 * out (when it shouldn't take clicks). With less motion it goes at once.
 */
export function useLinger(open: boolean, ms: number) {
  const [lingering, setLingering] = useState(false)
  useEffect(() => {
    if (open) {
      setLingering(true)
      return
    }
    if (!lingering) return
    const timer = setTimeout(() => setLingering(false), reducedMotion() ? 0 : ms)
    return () => clearTimeout(timer)
  }, [open, lingering, ms])
  return { shown: open || lingering, closing: !open && lingering }
}
