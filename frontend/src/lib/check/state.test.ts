import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { memoryStorage } from "@/lib/memoryStorage"
import { toAttachment } from "@/lib/resumeFile"
import { createResumeStore } from "@/lib/resumeStore"
import { runChecks, type Finding, type Rule } from "./engine"
import { MAX_DISMISSED, MAX_WORD_LENGTH, MAX_WORDS } from "./settings"
import { addWord, CHECK_FIELD, dismiss, readCheckState, removeWord, restore } from "./state"

const sample = JSON.parse(readFileSync(path.resolve("src/lib/typst/preview-samples/jake.json"), "utf8"))

const suggestion = (key: string, rule = "B1"): Finding => ({
  rule,
  level: "look",
  category: "bullets",
  place: { kind: "profile", field: "fullName" },
  message: "Something",
  why: "Because",
  text: "",
  key,
  dismissed: false,
})

describe("what the checker saves on a resume", () => {
  test("is nothing dismissed and no words when there's none, or it's in another shape", () => {
    for (const check of [undefined, null, "B1", ["B1|x|y"], { dismissed: "B1|x|y", words: { Kubernetes: true } }]) {
      expect(readCheckState({ [CHECK_FIELD]: check })).toEqual({ dismissed: [], words: [] })
    }
  })

  test("keeps only text, and only the latest when there's too much", () => {
    const state = readCheckState({
      [CHECK_FIELD]: {
        dismissed: ["B1|a|b", 7, null, "", ...Array.from({ length: MAX_DISMISSED }, (_, i) => `B2|a|${i}`)],
        words: ["Kubernetes", 42, "x".repeat(MAX_WORD_LENGTH + 1)],
      },
    })
    expect(state.dismissed).toHaveLength(MAX_DISMISSED)
    expect(state.dismissed[0]).toBe("B2|a|0")
    expect(state.words).toEqual(["Kubernetes"])
  })

  test("isn't put in downloaded PDFs", () => {
    const resume = { ...sample, [CHECK_FIELD]: { dismissed: ["B1|a|b"], words: ["Kubernetes"] } }
    expect(JSON.parse(toAttachment(resume)).resume).not.toHaveProperty(CHECK_FIELD)
    expect(toAttachment(resume)).toBe(toAttachment(sample))
  })

  test("is read back with the resume after a reload", () => {
    const storage = memoryStorage()
    const tab = createResumeStore()
    tab.load(storage)
    const id = tab.create("Ada", "professional")
    tab.edit(id, CHECK_FIELD, { dismissed: ["B1|a|b"], words: ["Kubernetes"] })
    tab.flush()

    const reloaded = createResumeStore()
    reloaded.load(storage)
    expect(readCheckState(reloaded.getState().resumes[id])).toEqual({ dismissed: ["B1|a|b"], words: ["Kubernetes"] })
  })

})

describe("dismissing and restoring", () => {
  const empty = { dismissed: [], words: [] }

  test("adds a suggestion once, and gives back the same state if nothing changed", () => {
    const once = dismiss(empty, suggestion("B1|a|b"))
    expect(once.dismissed).toEqual(["B1|a|b"])
    expect(dismiss(once, suggestion("B1|a|b"))).toBe(once)
    expect(dismiss(empty, { ...suggestion("C2|a|b"), level: "fix" })).toBe(empty)
  })

  test("drops dismissals that no longer match anything their rules found, but not those of rules that didn't run", () => {
    const rule = (id: string, reads: "form" | "pdf"): Rule =>
      reads === "pdf"
        ? { id, category: "length", level: "look", title: id, why: id, reads, check: () => ({ checked: 1, problems: [] }) }
        : { id, category: "bullets", level: "look", title: id, why: id, reads, check: () => ({ checked: 1, problems: [] }) }
    // B1 ran and found nothing, so its old dismissal is stale. L1 waited for the PDF, so its dismissal stays.
    const report = runChecks(sample, { rules: [rule("B1", "form"), rule("L1", "pdf")] })
    const state = { dismissed: ["B1|old|text", "L1|page|text"], words: [] }
    expect(dismiss(state, suggestion("B5|a|b", "B5"), report).dismissed).toEqual(["L1|page|text", "B5|a|b"])
  })

  test("keeps the latest when there are too many", () => {
    const full = { dismissed: Array.from({ length: MAX_DISMISSED }, (_, i) => `B2|a|${i}`), words: [] }
    const next = dismiss(full, suggestion("B1|new|one"))
    expect(next.dismissed).toHaveLength(MAX_DISMISSED)
    expect(next.dismissed.at(-1)).toBe("B1|new|one")
    expect(next.dismissed[0]).toBe("B2|a|1")
  })

  test("restores a dismissed finding", () => {
    const state = { dismissed: ["B1|a|b", "B2|c|d"], words: [] }
    expect(restore(state, "B1|a|b").dismissed).toEqual(["B2|c|d"])
    expect(restore(state, "B9|x|y")).toBe(state)
  })
})

describe("added words", () => {
  const empty = { dismissed: [], words: [] }

  test("are kept as typed, once, whatever their case", () => {
    const added = addWord(empty, "  Kubernetes ")
    expect(added.words).toEqual(["Kubernetes"])
    expect(addWord(added, "kubernetes")).toBe(added)
  })

  test("aren't empty or too long to be a word", () => {
    expect(addWord(empty, "   ")).toBe(empty)
    expect(addWord(empty, "x".repeat(MAX_WORD_LENGTH + 1))).toBe(empty)
  })

  test("keep the latest when there are too many", () => {
    const full = { dismissed: [], words: Array.from({ length: MAX_WORDS }, (_, i) => `word${i}`) }
    const next = addWord(full, "Kubernetes")
    expect(next.words).toHaveLength(MAX_WORDS)
    expect(next.words.at(-1)).toBe("Kubernetes")
  })

  test("can be removed, whatever their case", () => {
    const state = { dismissed: [], words: ["Kubernetes", "Typst"] }
    expect(removeWord(state, "kubernetes").words).toEqual(["Typst"])
    expect(removeWord(state, "Rust")).toBe(state)
  })

  test("reach the rules in lower case", () => {
    const seen: string[][] = []
    const spy: Rule = {
      id: "G1",
      category: "spelling",
      level: "fix",
      title: "Spelling",
      why: "Typos stand out.",
      reads: "form",
      check: ({ words }) => {
        seen.push([...words])
        return null
      },
    }
    runChecks({ ...sample, [CHECK_FIELD]: { dismissed: [], words: ["Kubernetes", "TypST"] } }, { rules: [spy] })
    expect(seen).toEqual([["kubernetes", "typst"]])
  })
})
