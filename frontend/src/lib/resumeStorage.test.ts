import { afterEach, describe, expect, test, vi } from "vitest"
import { memoryStorage } from "./memoryStorage"
import {
  BACKUP_KEY,
  changedPaths,
  deleteKeptAside,
  EVERY_FIELD,
  getStorage,
  idOf,
  isKeptAside,
  LEGACY_KEY,
  loadSaved,
  mergeResume,
  readKeptAside,
  readResume,
  removeResume,
  RESUME_PREFIX,
  saveResume,
  UNREADABLE_PREFIX,
} from "./resumeStorage"

const ada = { id: "a", resumeTitle: "Ada", profileSection: { fullName: "Ada Lovelace" } }
const grace = { id: "g", resumeTitle: "Grace", profileSection: { fullName: "Grace Hopper" } }

const quotaError = () => new DOMException("The quota has been exceeded.", "QuotaExceededError")
const deniedError = () => new DOMException("Access is denied for this document.", "SecurityError")

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("what the editor can show of a saved resume", () => {
  test.each([
    ["cut-off JSON", '{"resumeTitle": "Ada'],
    ["not JSON", "hello"],
    ["null", "null"],
    ["a list", "[]"],
    ["a number", "42"],
  ])("is nothing if it isn't a resume (%s)", (_, text) => {
    expect(readResume(text)).toEqual({ resume: null, complete: false })
  })

  test.each<[string, string, unknown]>([
    ["a section that isn't a list", "educationSection", { schoolName: "MIT" }],
    ["a profile that isn't an object", "profileSection", "Ada Lovelace"],
    ["a section order that isn't a list", "sectionOrder", "Work"],
    ["checker settings that aren't an object", "check", ["B1|a|b"]],
    ["a mark that the sections were chosen that isn't true", "sectionsChosen", "yes"],
  ])("leaves out a field in a shape it can't show (%s)", (_, field, value) => {
    const { resume, complete } = readResume(JSON.stringify({ ...ada, [field]: value }))
    expect(complete).toBe(false)
    expect(resume).not.toHaveProperty(field)
    expect(resume?.resumeTitle).toBe("Ada")
  })

  test("leaves out list entries it can't show, and keeps the rest of the list", () => {
    const text = JSON.stringify({
      ...ada,
      educationSection: [{ schoolName: "MIT" }, null, "junk"],
      sectionOrder: ["Work", 7, "Education"],
    })
    const { resume, complete } = readResume(text)
    expect(complete).toBe(false)
    expect(resume?.educationSection).toEqual([{ schoolName: "MIT" }])
    expect(resume?.sectionOrder).toEqual(["Work", "Education"])
  })

  test("is all of an older resume that lacks newer fields, or has them empty", () => {
    const old = { id: "o", resumeTitle: "Old", profileSection: { fullName: "Ada" }, educationSection: null, headings: null }
    expect(readResume(JSON.stringify(old))).toEqual({ resume: old, complete: true })
  })
})

describe("saved data that can't be read", () => {
  // Loading keeps aside a resume it can't read, so these load some.
  const unreadable = (...texts: string[]) => Object.fromEntries(texts.map((text, i) => [`${RESUME_PREFIX}x${i}`, text]))

  test("is kept once, however often it's found", () => {
    const storage = memoryStorage(unreadable("hello"))
    loadSaved(storage)
    storage.setItem(`${RESUME_PREFIX}x0`, "hello")
    loadSaved(storage)
    expect(readKeptAside(storage)).toEqual(["hello"])
  })

  test("found later is kept as well, without replacing what was kept before", () => {
    let now = 1_000
    vi.spyOn(Date, "now").mockImplementation(() => now++)
    const storage = memoryStorage()
    for (const text of ["first", "second", "third"]) {
      storage.setItem(`${RESUME_PREFIX}x`, text)
      loadSaved(storage)
    }
    expect(readKeptAside(storage)).toEqual(["first", "second", "third"])
  })

  test("kept at the same moment gets a key each, so no copy is saved over", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000)
    const storage = memoryStorage(unreadable("one tab's", "another tab's"))
    loadSaved(storage)
    expect(readKeptAside(storage).sort()).toEqual(["another tab's", "one tab's"])
  })

  test("is kept under keys that can be told apart from resumes", () => {
    const storage = memoryStorage(unreadable("hello"))
    loadSaved(storage)
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i) ?? "")
    expect(keys.filter(isKeptAside)).toHaveLength(1)
    expect(keys.filter((key) => idOf(key) !== null)).toEqual([])
  })

  test("can be deleted once it's been kept aside", () => {
    const storage = memoryStorage(unreadable("first", "second"))
    loadSaved(storage)
    deleteKeptAside(storage)
    expect(readKeptAside(storage)).toEqual([])
    expect(storage.length).toBe(0)
  })
})

describe("when the browser won't let the site save anything", () => {
  test("getStorage gives null instead of throwing", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw deniedError()
      },
    })
    expect(getStorage()).toBeNull()
  })

  test("getStorage gives null in browsers without localStorage", () => {
    vi.stubGlobal("window", { localStorage: null })
    expect(getStorage()).toBeNull()
  })

  test("getStorage gives localStorage when it can be used", () => {
    const storage = memoryStorage()
    vi.stubGlobal("window", { localStorage: storage })
    expect(getStorage()).toBe(storage)
  })

  test("there's no data kept aside to read or delete", () => {
    expect(readKeptAside(null)).toEqual([])
    expect(() => deleteKeptAside(null)).not.toThrow()
  })
})

describe("a resume saved under its own key", () => {
  const all = new Set([EVERY_FIELD])
  const text = (resume: object) => JSON.stringify(resume)
  const stored = (storage: Storage, id: string) => readResume(storage.getItem(RESUME_PREFIX + id) ?? "").resume

  test("is read back as it was saved, and doesn't touch other resumes", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}g`]: text(grace) })
    const saved = saveResume(storage, "a", ada, all, null)
    expect(saved).toEqual({ status: "saved", text: text(ada), resume: ada })
    expect(stored(storage, "a")).toEqual(ada)
    expect(storage.getItem(`${RESUME_PREFIX}g`)).toBe(text(grace))
    expect(idOf(`${RESUME_PREFIX}a`)).toBe("a")
    expect(idOf("allResumes")).toBeNull()
  })

  test("keeps another tab's changes to other fields when this tab saves", () => {
    const before = { ...ada, updatedAt: "2026-10-06T10:00:00.000Z" }
    const theirs = { ...before, profileSection: { fullName: "Ada King" }, updatedAt: "2026-10-06T10:00:05.000Z" }
    const ours = { ...before, workExperienceSection: [{ id: 1, companyName: "Analytical Engines" }], updatedAt: "2026-10-06T10:00:03.000Z" }
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(theirs) })

    const saved = saveResume(storage, "a", ours, new Set(["workExperienceSection", "updatedAt"]), text(before))
    expect(saved.status).toBe("saved")
    expect(stored(storage, "a")).toEqual({ ...theirs, workExperienceSection: ours.workExperienceSection })
    expect(saved.resume).toEqual(stored(storage, "a"))
  })

  test("keeps this tab's version of a field that both tabs changed", () => {
    const theirs = { ...ada, profileSection: { fullName: "Ada King" } }
    const ours = { ...ada, profileSection: { fullName: "Ada Byron" } }
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(theirs) })
    saveResume(storage, "a", ours, new Set(["profileSection"]), text(ada))
    expect(stored(storage, "a")?.profileSection).toEqual({ fullName: "Ada Byron" })
  })

  test("is saved again with this tab's changes if another tab deleted it", () => {
    const storage = memoryStorage()
    expect(saveResume(storage, "a", ada, new Set(["profileSection"]), text(ada)).status).toBe("saved")
    expect(stored(storage, "a")).toEqual(ada)
  })

  test("that another tab saved in a shape the editor can't show is kept aside before it's saved over", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: "not json" })
    expect(saveResume(storage, "a", ada, all, text(ada)).status).toBe("saved")
    expect(readKeptAside(storage)).toEqual(["not json"])
    expect(stored(storage, "a")).toEqual(ada)
  })

  test("isn't saved over text it can't read if that can't be kept aside", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: "not json" })
    const setItem = storage.setItem
    vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
      if (key.startsWith(UNREADABLE_PREFIX)) throw quotaError()
      setItem(key, value)
    })
    expect(saveResume(storage, "a", ada, all, null)).toEqual({ status: "full" })
    expect(storage.getItem(`${RESUME_PREFIX}a`)).toBe("not json")
  })

  test("says why it wasn't saved when storage is blocked or full", () => {
    expect(saveResume(null, "a", ada, all, null)).toEqual({ status: "blocked" })
    const storage = memoryStorage()
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw quotaError()
    })
    expect(saveResume(storage, "a", ada, all, null)).toEqual({ status: "full" })
  })

  test("says it failed for any other error", () => {
    const storage = memoryStorage()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("disk error")
    })
    expect(saveResume(storage, "a", ada, new Set([EVERY_FIELD]), null)).toEqual({ status: "failed" })
  })

  test("can be removed, also from where an earlier version saved it", () => {
    const legacy = JSON.stringify({ a: ada, g: grace })
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(ada), [LEGACY_KEY]: legacy })
    expect(removeResume(storage, "a")).toBe("saved")
    expect(storage.getItem(`${RESUME_PREFIX}a`)).toBeNull()
    expect(storage.getItem(LEGACY_KEY)).toBe(JSON.stringify({ g: grace }))
  })

  test("says so when it can't be removed from where an earlier version saved it", () => {
    const legacy = JSON.stringify({ a: ada, g: grace })
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(ada), [LEGACY_KEY]: legacy })
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw quotaError()
    })
    expect(removeResume(storage, "a")).toBe("full")
    expect(storage.getItem(LEGACY_KEY)).toBe(legacy)
  })

  test("can be removed", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(ada) })
    expect(removeResume(storage, "a")).toBe("saved")
    expect(storage.length).toBe(0)
    expect(removeResume(null, "a")).toBe("blocked")
  })
})

describe("mergeResume", () => {
  test("takes the changed fields from this tab, and the rest from the other", () => {
    const theirs = { ...ada, resumeTitle: "Theirs", updatedAt: "2026-10-06T10:00:05.000Z" }
    const ours = { ...ada, resumeTitle: "Ours", profileSection: { fullName: "Ours" }, updatedAt: "2026-10-06T10:00:01.000Z" }
    expect(mergeResume(theirs, ours, new Set(["profileSection"]))).toEqual({
      ...theirs,
      profileSection: { fullName: "Ours" },
    })
  })

  test("takes single changed values inside the profile from this tab, and the other values from the other", () => {
    const theirs = { ...ada, profileSection: { fullName: "Ada Lovelace", email: "ada@theirs.example" } }
    const ours = { ...ada, profileSection: { fullName: "Ada King", email: "ada@example.com" } }
    expect(mergeResume(theirs, ours, new Set(["profileSection.fullName"])).profileSection).toEqual({
      fullName: "Ada King",
      email: "ada@theirs.example",
    })
  })

  test("takes everything from this tab for a new or replaced resume", () => {
    expect(mergeResume(grace, ada, new Set([EVERY_FIELD]))).toBe(ada)
  })

  test("keeps the later edit time", () => {
    const merged = mergeResume({ updatedAt: "2026-10-06T10:00:00.000Z" }, { updatedAt: "2026-10-06T11:00:00.000Z" }, new Set(["updatedAt"]))
    expect(merged.updatedAt).toBe("2026-10-06T11:00:00.000Z")
  })
})

describe("changedPaths", () => {
  test("names each value that changed inside the profile or the headings", () => {
    expect(changedPaths("profileSection", { fullName: "Ada", email: "a@x" }, { fullName: "Ada King", email: "a@x" })).toEqual([
      "profileSection.fullName",
    ])
    expect(changedPaths("headings", {}, { Work: "Experience" })).toEqual(["headings.Work"])
  })

  test("counts an object field that wasn't there as empty", () => {
    expect(changedPaths("profileSection", undefined, { fullName: "Ada" })).toEqual(["profileSection.fullName"])
    expect(changedPaths("headings", null, { Work: "Experience" })).toEqual(["headings.Work"])
  })

  test("names the whole field otherwise", () => {
    expect(changedPaths("workExperienceSection", [], [{ companyName: "Acme" }])).toEqual(["workExperienceSection"])
    expect(changedPaths("workExperienceSection", undefined, [{ companyName: "Acme" }])).toEqual(["workExperienceSection"])
    expect(changedPaths("profileSection", "Ada", { fullName: "Ada" })).toEqual(["profileSection"])
    expect(changedPaths("profileSection", { fullName: "Ada" }, undefined)).toEqual(["profileSection"])
  })
})

describe("loading resumes saved under keys of their own", () => {
  const text = (resume: object) => JSON.stringify(resume)

  test("reads every one, and saves nothing", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(ada), [`${RESUME_PREFIX}g`]: text(grace), other: "x" })
    const setItem = vi.spyOn(storage, "setItem")
    const loaded = loadSaved(storage)
    expect(loaded.resumes).toEqual({ a: ada, g: grace })
    expect(loaded.texts).toEqual(
      new Map([
        ["a", text(ada)],
        ["g", text(grace)],
      ]),
    )
    expect(loaded.status).toBe("saved")
    expect(setItem).not.toHaveBeenCalled()
  })

  test("says it's blocked when storage can't be read", () => {
    expect(loadSaved(null).status).toBe("blocked")
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(ada) })
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw deniedError()
    })
    expect(loadSaved(storage)).toEqual({ resumes: {}, texts: new Map(), status: "blocked" })
  })

  test("keeps aside one that can't be read at all, and removes it", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: text(ada), [`${RESUME_PREFIX}x`]: "not json" })
    expect(loadSaved(storage).resumes).toEqual({ a: ada })
    expect(readKeptAside(storage)).toEqual(["not json"])
    expect(storage.getItem(`${RESUME_PREFIX}x`)).toBeNull()
  })

  test("keeps aside one with a field the editor can't show, and saves the rest of it once", () => {
    const original = text({ ...ada, educationSection: { schoolName: "MIT" } })
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: original })
    const loaded = loadSaved(storage)
    expect(loaded.resumes).toEqual({ a: ada })
    expect(loaded.texts.get("a")).toBe(text(ada))
    expect(storage.getItem(`${RESUME_PREFIX}a`)).toBe(text(ada))
    expect(readKeptAside(storage)).toEqual([original])

    loadSaved(storage)
    expect(readKeptAside(storage)).toEqual([original])
  })

  test("leaves one that can't be read as it is if it can't be kept aside", () => {
    const original = text({ ...ada, educationSection: { schoolName: "MIT" } })
    const storage = memoryStorage({ [`${RESUME_PREFIX}a`]: original })
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw quotaError()
    })
    const loaded = loadSaved(storage)
    expect(loaded.resumes).toEqual({ a: ada })
    expect(loaded.texts.get("a")).toBe(original)
    expect(loaded.status).toBe("full")
    expect(storage.getItem(`${RESUME_PREFIX}a`)).toBe(original)
  })

  test("keeps an id that's special in JavaScript, like __proto__, as an ordinary resume", () => {
    const storage = memoryStorage({ [`${RESUME_PREFIX}__proto__`]: text({ id: "__proto__", resumeTitle: "Ada" }) })
    expect(Object.keys(loadSaved(storage).resumes)).toEqual(["__proto__"])
  })
})

describe("resumes saved by earlier versions, all under one key", () => {
  const text = (resume: object) => JSON.stringify(resume)
  const older = { ...ada, profileSection: { fullName: "Ada Byron" }, updatedAt: "2026-10-01T00:00:00.000Z" }
  const newer = { ...ada, profileSection: { fullName: "Ada King" }, updatedAt: "2026-10-05T00:00:00.000Z" }

  test("are moved to keys of their own, with a backup, and then nothing is moved again", () => {
    const legacy = text({ a: ada, g: grace })
    const storage = memoryStorage({ [LEGACY_KEY]: legacy })
    expect(loadSaved(storage).resumes).toEqual({ a: ada, g: grace })
    expect(storage.getItem(`${RESUME_PREFIX}a`)).toBe(text(ada))
    expect(storage.getItem(`${RESUME_PREFIX}g`)).toBe(text(grace))
    expect(storage.getItem(LEGACY_KEY)).toBeNull()
    expect(storage.getItem(BACKUP_KEY)).toBe(legacy)

    const setItem = vi.spyOn(storage, "setItem")
    expect(loadSaved(storage).resumes).toEqual({ a: ada, g: grace })
    expect(setItem).not.toHaveBeenCalled()
  })

  test("get no backup when there were none", () => {
    const storage = memoryStorage({ [LEGACY_KEY]: "{}" })
    expect(loadSaved(storage).resumes).toEqual({})
    expect(storage.length).toBe(0)
  })

  test("don't replace a newer copy already under its own key, but do replace an older one", () => {
    const storage = memoryStorage({ [LEGACY_KEY]: text({ a: older }), [`${RESUME_PREFIX}a`]: text(newer) })
    expect(loadSaved(storage).resumes.a).toEqual(newer)

    // A tab still on an earlier version saved later.
    storage.setItem(LEGACY_KEY, text({ a: { ...newer, resumeTitle: "Later", updatedAt: "2026-10-06T00:00:00.000Z" } }))
    expect(loadSaved(storage).resumes.a.resumeTitle).toBe("Later")
  })

  test("replace a copy edited at the same moment if they differ, as the earlier version saved last", () => {
    const sameTime = { ...newer, resumeTitle: "Saved by an earlier version" }
    const storage = memoryStorage({ [LEGACY_KEY]: text({ a: sameTime }), [`${RESUME_PREFIX}a`]: text(newer) })
    expect(loadSaved(storage).resumes.a.resumeTitle).toBe("Saved by an earlier version")
  })

  test("still load when newer than the copy under its own key, if there's no room to move them", () => {
    const storage = memoryStorage({ [LEGACY_KEY]: text({ a: newer }), [`${RESUME_PREFIX}a`]: text(older) })
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw quotaError()
    })
    const loaded = loadSaved(storage)
    expect(loaded.resumes.a).toEqual(newer)
    expect(loaded.texts.get("a")).toBe(text(older))
  })

  test("that can't all be read are kept aside, and the rest moved", () => {
    const legacy = text({ a: ada, x: "junk" })
    const storage = memoryStorage({ [LEGACY_KEY]: legacy })
    expect(loadSaved(storage).resumes).toEqual({ a: ada })
    expect(readKeptAside(storage)).toEqual([legacy])
    expect(storage.getItem(LEGACY_KEY)).toBeNull()
    expect(storage.getItem(BACKUP_KEY)).toBeNull()
  })

  test("move one saved under an id that's special in JavaScript, like __proto__, as an ordinary resume", () => {
    const storage = memoryStorage({ [LEGACY_KEY]: '{"__proto__": {"id": "__proto__", "resumeTitle": "Ada"}}' })
    expect(Object.keys(loadSaved(storage).resumes)).toEqual(["__proto__"])
    expect(storage.getItem(`${RESUME_PREFIX}__proto__`)).not.toBeNull()
  })

  test("stay where they are, and still load, if storage is too full to move them", () => {
    const legacy = text({ a: ada, g: grace })
    const storage = memoryStorage({ [LEGACY_KEY]: legacy })
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw quotaError()
    })
    const loaded = loadSaved(storage)
    expect(loaded.resumes).toEqual({ a: ada, g: grace })
    expect(loaded.status).toBe("full")
    expect(storage.getItem(LEGACY_KEY)).toBe(legacy)
  })
})
