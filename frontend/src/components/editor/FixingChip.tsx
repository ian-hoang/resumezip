"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { sheetPill } from "@/components/pills"
import { useFixing } from "./CheckContext"

const SMALL = "h-8 px-3.5 text-[13px] font-medium"

/**
 * Over the form while a finding opened from the ATS checks or AI review is
 * being fixed, on wide screens, where those lists take the form's place: back
 * to the list, and for the ATS checks, on to the next finding. It stays at the
 * top as the form scrolls to the field.
 */
export default function FixingChip() {
  const fixing = useFixing()
  if (!fixing) return null
  return (
    <div className="sticky top-0 z-10 -mx-2 mb-4 flex items-center gap-2 bg-sheet/90 px-2 py-2 backdrop-blur-sm">
      <button type="button" onClick={fixing.back} className={sheetPill("white", SMALL)}>
        <ArrowLeft aria-hidden="true" />
        Back to {fixing.from === "ai" ? "AI review" : "ATS checks"}
      </button>
      {fixing.next && (
        <>
          <span className="ml-auto text-[13px] tabular-nums text-ink-3">{fixing.more} more</span>
          <button type="button" onClick={fixing.next} className={sheetPill("white", SMALL)}>
            Next
            <ArrowRight aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
