import { afterEach, describe, expect, test, vi } from "vitest"
import { CORE_SECTIONS } from "@/components/editor/sections"
import { memoryStorage } from "./memoryStorage"
import { printedResume, hasLeftOut } from "./leftOut"
import { AttachmentError, fromAttachment, MAX_ENTRIES, toAttachment, TooLongError } from "./resumeFile"
import { changedPaths, keyOf, readKeptAside, readResume, readSaved } from "./resumeStorage"
import { createResumeStore } from "./resumeStore"
import type { Resume } from "./resume"
import { extraHasBody, extrasOf, readExtraSections, resolveSections, type ExtraSection, type ExtraSections } from "./resumeSections"
import { asSaved } from "./testResume"

const a = "11111111-1111-4111-8111-111111111111"
const b = "22222222-2222-4222-8222-222222222222"
const c = "33333333-3333-4333-8333-333333333333"
const note = { kind: "text", heading: "Note", text: "Hello" } as const satisfies ExtraSection
const text = { kind: "text", heading: "Other", text: "First paragraph.\n\n○ Literal prose." } as const satisfies ExtraSection
const resume: Resume = {
  id: "r",
  resumeTitle: "Example",
  profileSection: { fullName: "Ada" },
  extraSections: {
    [c]: note,
    [a]: text,
    [b]: { kind: "list", heading: "Other", bullets: "• Public\n○ SECRET\n• Last" },
  },
  sectionOrder: ["Work", `extra:${b}`, `extra:${c}`, `extra:${a}`],
}
const envelope = (content: unknown, version = 2) => JSON.stringify({ format: "resumezip", version, resume: content })
const tabs = (content: Record<string, unknown> = resume) => {
  const storage = memoryStorage({ [keyOf("r")]: JSON.stringify(content) })
  const first = createResumeStore()
  first.load(storage)
  const second = createResumeStore()
  second.load(storage)
  return { storage, first, second, saved: () => readResume(storage.getItem(keyOf("r"))!).resume! }
}
afterEach(() => vi.useRealTimers())

// A section by its key, as the kind the test expects it to be.
function extra<Kind extends ExtraSection["kind"]>(resume: { extraSections?: ExtraSections } | null | undefined, key: string, kind: Kind) {
  const section = resume?.extraSections?.[key]
  if (section?.kind !== kind) throw new Error(`expected a ${kind} section at ${key}`)
  return section as ExtraSection & { kind: Kind }
}

describe("section identity and validation", () => {
  test("resolves a view without mutating saved order or creating optional sections", () => {
    const input = { sectionOrder: ["Work", "Work", "extra:missing", `extra:${a}`], extraSections: { [a]: text, [c]: note } }
    const before = JSON.stringify(input)
    expect(resolveSections(input)).toEqual(["Work", `extra:${a}`, ...CORE_SECTIONS.filter((name) => name !== "Work"), `extra:${c}`])
    expect(JSON.stringify(input)).toBe(before)
    expect(resolveSections({})).toEqual(CORE_SECTIONS)
  })
  test("an optional section shows when it's in the saved order or has entries, and a new resume starts without them", () => {
    expect(resolveSections({ sectionOrder: ["Awards"] })).toEqual(["Awards", ...CORE_SECTIONS])
    expect(resolveSections({ publicationsSection: [{ id: 1 }] })).toEqual([...CORE_SECTIONS, "Publications"])
    expect(resolveSections({ publicationsSection: [] })).toEqual(CORE_SECTIONS)
    const store = createResumeStore()
    store.load(memoryStorage({}))
    const id = store.create("New", "professional")
    expect(resolveSections(store.getState().resumes[id])).toEqual(CORE_SECTIONS)
  })
  test("normalizes missing strings while rejecting invalid structures and identities", () => {
    expect(readExtraSections({ [c]: { kind: "text" } })).toEqual({
      complete: true,
      sections: { [c]: { kind: "text", heading: "", text: "" } },
    })
    for (const bad of [
      null,
      [],
      { summary: { kind: "text", text: "x" } },
      // The summary was a section of its own once; it's the profile's now.
      { summary: { kind: "summary", heading: "Summary", text: "x" } },
      { [a]: { kind: "summary", text: "x" } },
      { bad: text },
      { [c]: { ...note, text: 4 } },
      { certifications: { kind: "certifications", heading: "Certifications", entries: [] } },
    ])
      expect(readExtraSections(bad).complete).toBe(false)
  })
  test("each map of sections is read once, and a new map afresh", () => {
    const read = extrasOf(resume)
    expect(extrasOf(resume)).toBe(read)
    expect(extrasOf({ ...resume, extraSections: { ...resume.extraSections } })).not.toBe(read)
    expect(extrasOf({ extraSections: "damaged" })).toEqual({})
  })
  test("empty and hidden-only bodies do not print", () => {
    expect(extraHasBody({ kind: "list", heading: "x", bullets: "○ Secret\n• " })).toBe(false)
    expect(extraHasBody({ kind: "text", heading: "x", text: "○ Literal" })).toBe(true)
  })
})

describe("atomic section actions and cross-tab merging", () => {
  test("opening old data performs no writes and leaves optional sections absent", () => {
    vi.useFakeTimers()
    const { first, storage } = tabs({ id: "r", sectionOrder: ["Work"] })
    const write = vi.spyOn(storage, "setItem")
    first.flush()
    vi.runAllTimers()
    expect(first.getState().resumes.r).not.toHaveProperty("extraSections")
    expect(write).not.toHaveBeenCalled()
  })
  test("each section added has a key of its own, and each change updates once", () => {
    const { first } = tabs({ id: "r" })
    const listener = vi.fn()
    first.subscribe(listener)
    const one = first.addSection("r", "text")!
    const two = first.addSection("r", "text")!
    expect(two).not.toBe(one)
    expect(listener).toHaveBeenCalledTimes(2)
    const key = one.slice("extra:".length)
    first.editSection("r", key, { text: "Registered", leftOut: true })
    expect(listener).toHaveBeenCalledTimes(3)
    expect(extra(first.getState().resumes.r, key, "text")).toMatchObject({ text: "Registered", leftOut: true })
    first.deleteSection("r", key)
    expect(first.getState().resumes.r.extraSections).not.toHaveProperty(key)
    expect(resolveSections(first.getState().resumes.r)).not.toContain(one)
    first.flush()
  })
  test("an optional section is added at the end once, and removing it takes its entries and title", () => {
    const { first } = tabs({ id: "r", sectionOrder: [...CORE_SECTIONS] })
    expect(first.addSection("r", "Awards")).toBe("Awards")
    expect(first.addSection("r", "Awards")).toBe("Awards")
    expect(resolveSections(first.getState().resumes.r)).toEqual([...CORE_SECTIONS, "Awards"])
    first.edit("r", "awardsSection", [{ id: 1, awardName: "Prize" }])
    first.edit("r", "headings", { awards: "Honors" })
    first.removeSection("r", "Awards")
    const resume = first.getState().resumes.r
    expect(resolveSections(resume)).toEqual(CORE_SECTIONS)
    expect(resume.awardsSection).toEqual([])
    expect(resume.headings).toEqual({})
    // A core section stays.
    first.removeSection("r", "Work")
    expect(resolveSections(first.getState().resumes.r)).toEqual(CORE_SECTIONS)
    first.flush()
  })
  test("preserves untouched member references and exact dirty paths", () => {
    const { first } = tabs()
    const before = first.getState().resumes.r.extraSections
    first.editSection("r", a, { heading: "Renamed" })
    const after = first.getState().resumes.r.extraSections
    expect(after?.[c]).toBe(before?.[c])
    expect(changedPaths("extraSections", before, after)).toEqual([`extraSections.${a}`])
    first.flush()
  })
  test("different member edits merge; same member is last-save wins", () => {
    const { first, second, saved } = tabs()
    first.editSection("r", a, { text: "A" })
    second.editSection("r", b, { bullets: "• B" })
    first.flush()
    second.flush()
    expect(extra(saved(), a, "text").text).toBe("A")
    expect(extra(saved(), b, "list").bullets).toBe("• B")
    first.editSection("r", a, { text: "First" })
    second.editSection("r", a, { text: "Second" })
    first.flush()
    second.flush()
    expect(extra(saved(), a, "text").text).toBe("Second")
  })
  test("concurrent additions survive last-save ordering", () => {
    const { first, second, saved } = tabs({ id: "r" })
    const one = first.addSection("r", "text")!
    const two = second.addSection("r", "list")!
    first.flush()
    second.flush()
    expect(resolveSections(saved())).toContain(one)
    expect(resolveSections(saved())).toContain(two)
  })
  test("unrelated stale changes cannot resurrect deletion; a pending same-member edit can", () => {
    const { first, second, saved } = tabs()
    first.deleteSection("r", a)
    first.flush()
    second.editSection("r", b, { heading: "New" })
    second.flush()
    expect(saved().extraSections).not.toHaveProperty(a)
    const other = tabs()
    other.second.editSection("r", a, { text: "pending" })
    other.first.deleteSection("r", a)
    other.first.flush()
    other.second.flush()
    expect(extra(other.saved(), a, "text").text).toBe("pending")
  })
  test("every replacement clears extensions absent from the new file", () => {
    const { first } = tabs()
    first.replace("r", fromAttachment(envelope({ profileSection: {} }, 1))!)
    expect(first.getState().resumes.r.extraSections).toEqual({})
    first.replace("r", resume)
    first.replace("r", fromAttachment(envelope({ extraSections: { [c]: note } }))!)
    expect(Object.keys(first.getState().resumes.r?.extraSections ?? {})).toEqual([c])
  })
})

describe("public v1/v2 save files and local recovery", () => {
  test("keeps public identities/order including empty instances and private text stays local", () => {
    // With a field the editor doesn't save, which mustn't reach the file either.
    const attachment = toAttachment(asSaved({ ...resume, resumeTag: "SECRET", checker: { token: "SECRET" } }))
    expect(JSON.parse(attachment).version).toBe(2)
    expect(attachment).not.toContain("SECRET")
    expect(attachment).not.toContain("leftOut")
    expect(fromAttachment(attachment)?.extraSections?.[a]).toEqual(text)
    const empty = toAttachment({ extraSections: { [c]: { ...note, text: "" } } })
    expect(JSON.parse(empty).version).toBe(2)
    expect(extra(fromAttachment(empty), c, "text").text).toBe("")
  })
  test("left-out sections and lines are removed before the version is chosen", () => {
    const list: ExtraSection = { kind: "list", heading: "Other", bullets: "○ SECRET" }
    const input: Resume = { extraSections: { [c]: { ...note, leftOut: true }, [b]: list } }
    expect(hasLeftOut(input)).toBe(true)
    expect(toAttachment(input)).not.toContain("SECRET")
    expect(JSON.parse(toAttachment(input)).version).toBe(2)
    input.extraSections = { ...input.extraSections, [b]: { ...list, leftOut: true } }
    expect(JSON.parse(toAttachment(input)).version).toBe(1)
    expect(printedResume(input).extraSections).toEqual({})
  })
  test("duplicate valid refs canonicalize, dangling refs and future/damaged attachments error", () => {
    const content = fromAttachment(envelope({ extraSections: { [c]: note }, sectionOrder: [`extra:${c}`, `extra:${c}`, "Work"] }))!
    expect(content.sectionOrder?.slice(0, 2)).toEqual([`extra:${c}`, "Work"])
    for (const file of [
      envelope({}, 3),
      envelope({ extraSections: { [c]: { ...note, text: 4 } } }),
      envelope({ extraSections: {}, sectionOrder: [`extra:${a}`] }),
      '{"format":"resumezip","version":2,',
    ])
      expect(() => fromAttachment(file)).toThrow(AttachmentError)
  })
  test("the limit on entries counts sections too", () => {
    const extraSections = Object.fromEntries(
      Array.from({ length: MAX_ENTRIES + 1 }, (_, index) => [`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, text]),
    )
    expect(() => fromAttachment(envelope({ extraSections }))).toThrow(TooLongError)
  })
  test("malformed local data is kept aside before salvage; preservation failure leaves original", () => {
    const raw = JSON.stringify({ ...resume, extraSections: { [a]: text, [c]: { kind: "text", text: 4 } }, future: "kept" })
    const storage = memoryStorage({ [keyOf("r")]: raw })
    const saved = readSaved(storage, "r")
    expect(saved.resume).toHaveProperty("future", "kept")
    expect(saved.resume?.extraSections).toEqual({ [a]: text })
    expect(readKeptAside(storage)).toEqual([raw])
    const blocked = memoryStorage({ [keyOf("r")]: raw })
    vi.spyOn(blocked, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError")
    })
    expect(readSaved(blocked, "r").status).toBe("full")
    expect(blocked.getItem(keyOf("r"))).toBe(raw)
  })
  test("a section's fields from a later version are backed up before a narrower save", () => {
    const raw = JSON.stringify({ ...resume, extraSections: { [c]: { ...note, futureNotes: "saved information" } } })
    const storage = memoryStorage({ [keyOf("r")]: raw })
    expect(readResume(raw).complete).toBe(false)
    readSaved(storage, "r")
    expect(readKeptAside(storage)).toEqual([raw])
  })
})
