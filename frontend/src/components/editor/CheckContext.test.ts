// The checker as the editor opens a resume. It's rendered as the server
// renders it, so without a browser: the first render, before any effect runs.

import { createElement, type ComponentProps, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"
import { runChecks, type Report } from "@/lib/check/engine"
import { printedOf } from "@/lib/typst/compile"
import { CheckProvider, useCheck } from "./CheckContext"

const ada = vi.hoisted(() => ({
  profileSection: { fullName: "Ada Lovelace" },
  workExperienceSection: [{ id: 1, workRole: "Analyst", companyName: "Analytical Engines", workDescription: "• Wrote the first program" }],
}))

vi.mock("@/context/ResumeContext", () => ({
  useOpenResume: () => ({ id: "ada", read: () => ada, update: () => {} }),
  useResumeActions: () => ({ subscribe: () => () => {} }),
}))
vi.mock("@/lib/check/engine", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@/lib/check/engine")>()
  return { ...engine, runChecks: vi.fn(engine.runChecks) }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(runChecks).mockClear()
})

/** Opens Ada's resume, with its preview on screen and the left bar on `mode`, as this visit last left it. */
function open(mode: string, editor: ReactNode = null) {
  vi.stubGlobal("window", { sessionStorage: { getItem: () => mode, setItem: () => {} } })
  const preview = { url: "blob:preview", printed: JSON.stringify(printedOf(ada)), checkerResume: ada }
  const props: ComponentProps<typeof CheckProvider> = { onSelect: () => {}, onPick: () => {}, preview, unbuilt: null, children: editor }
  renderToString(createElement(CheckProvider, props))
}

test("doesn't check the resume in Write or Style mode, before Check has been opened", () => {
  open("write")
  open("style")
  expect(runChecks).not.toHaveBeenCalled()
})

test("checks it from the first render when the editor opens in Check mode, so the panel has a report to show", () => {
  let shown: Report | undefined
  // Where the Check panel reads what was found.
  const Panel = () => {
    shown = useCheck().report
    return null
  }
  open("check", createElement(Panel))
  expect(runChecks).toHaveBeenCalledOnce()
  expect(shown).toBe(vi.mocked(runChecks).mock.results[0].value)
})
