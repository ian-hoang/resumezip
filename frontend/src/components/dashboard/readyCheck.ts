// Whether a resume is ready to send, as far as the dashboard can honestly
// tell. The checker's rules that read the PDF, and spelling and grammar,
// need the preview and the grammar checker (lib/check/README.md), which only
// load in the editor; here runChecks leaves them waiting, and they count for
// nothing. So "ready" means only: there's enough of the resume to check, and
// the rules that read what's written find nothing that must be fixed.
// Suggestions don't count against it, as they don't hold the score down.

import { runChecks } from "@/lib/check/engine"
import { hasEnoughToCheck } from "@/lib/check/labels"
import type { Resume } from "@/lib/resume"

export function isReady(resume: Resume): boolean {
  const report = runChecks(resume)
  return hasEnoughToCheck(report.view) && !report.findings.some((finding) => finding.level === "fix")
}
