import type { Report } from "@/lib/check/engine"

/**
 * What the checker found on the resume, in the left bar's Check mode. For
 * now it only says how much; the findings themselves come next (issue #61).
 */
export default function CheckPanel({ report }: { report: Report }) {
  const open = report.findings.length
  return (
    <div className="flex flex-col gap-3 px-5 py-4 lg:p-0">
      <span className="label-mono hidden px-2 text-ink-2 lg:block">Check</span>
      <p className="px-2 text-sm leading-relaxed text-ink-2">{open === 0 ? "Nothing to fix." : `${open} to look at.`}</p>
    </div>
  )
}
