import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { memoryStorage } from "./memoryStorage"
import type { Resume } from "./resume"
import { createResumeStore, SAVE_DELAY } from "./resumeStore"
import { keyOf, LEGACY_KEY, readResume } from "./resumeStorage"

const ada = { id: "a", resumeTitle: "Ada", profileSection: { fullName: "Ada Lovelace" }, updatedAt: "2026-10-06T10:00:00.000Z" }
const grace = { id: "g", resumeTitle: "Grace", profileSection: { fullName: "Grace Hopper" }, updatedAt: "2026-10-06T10:00:00.000Z" }

/** localStorage contents with these resumes saved, each under its own key. */
const saved = (...resumes: { id: string; [field: string]: unknown }[]) =>
  Object.fromEntries(resumes.map((resume) => [keyOf(resume.id), JSON.stringify(resume)]))
const stored = (storage: Storage, id: string) => readResume(storage.getItem(keyOf(id)) ?? "").resume

/**
 * A tab: a store that has read `storage`. A save in another tab reaches it
 * only when a test calls receive, as late as the test likes.
 */
function openTab(storage: Storage | null) {
  const store = createResumeStore()
  store.load(storage)
  return store
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("typing", () => {
  test("is saved once it pauses, not on every keystroke", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    const setItem = vi.spyOn(storage, "setItem")
    for (const name of ["A", "Ad", "Ada", "Ada K", "Ada King"]) {
      tab.edit("a", "profileSection", { fullName: name })
      vi.advanceTimersByTime(SAVE_DELAY / 4)
    }
    expect(setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(SAVE_DELAY)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(stored(storage, "a")?.profileSection).toEqual({ fullName: "Ada King" })
  })

  test("counts as unsaved until it's saved", () => {
    const tab = openTab(memoryStorage(saved(ada)))
    expect(tab.getState().unsaved).toBe(false)
    tab.edit("a", "profileSection", { fullName: "Ada King" })
    expect(tab.getState().unsaved).toBe(true)
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(tab.getState().unsaved).toBe(false)
  })

  test("is saved straight away when the page is hidden or closed", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    tab.edit("a", "profileSection", { fullName: "Ada King" })
    tab.flush()
    expect(stored(storage, "a")?.profileSection).toEqual({ fullName: "Ada King" })

    const setItem = vi.spyOn(storage, "setItem")
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(setItem).not.toHaveBeenCalled()
  })

  test("saves only the resume that changed", () => {
    const storage = memoryStorage(saved(ada, grace))
    const tab = openTab(storage)
    const setItem = vi.spyOn(storage, "setItem")
    tab.edit("a", "resumeTitle", "Ada's")
    tab.flush()
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([keyOf("a")])
  })

  test("isn't needed just to open a page: nothing is saved", () => {
    const storage = memoryStorage(saved(ada, grace))
    const setItem = vi.spyOn(storage, "setItem")
    const tab = openTab(storage)
    vi.advanceTimersByTime(SAVE_DELAY * 2)
    tab.flush()
    expect(setItem).not.toHaveBeenCalled()
    expect(tab.getState()).toMatchObject({ loaded: true, saveStatus: "saved", resumes: { a: ada, g: grace } })
  })

  test("notes when a change was written, for the editor to say it's saved", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    tab.flush()
    expect(tab.getState().savedAt).toBe(0)

    tab.edit("a", "resumeTitle", "Ada's")
    expect(tab.getState().savedAt).toBe(0)
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(tab.getState().savedAt).toBe(Date.now())

    // A change that couldn't be written isn't saved.
    const before = tab.getState().savedAt
    vi.advanceTimersByTime(1000)
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    tab.edit("a", "resumeTitle", "Ada's resume")
    tab.flush()
    expect(tab.getState()).toMatchObject({ saveStatus: "full", savedAt: before })
  })
})

describe("two tabs", () => {
  test("editing different resumes keep both edits, even if each saves before hearing of the other", () => {
    const storage = memoryStorage(saved(ada, grace))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "resumeTitle", "Ada, edited in one")
    two.edit("g", "resumeTitle", "Grace, edited in two")
    one.flush()
    two.flush()
    // Each hears of the other's save only now.
    two.receive(keyOf("a"))
    one.receive(keyOf("g"))

    for (const tab of [one, two, openTab(storage)]) {
      expect(tab.getState().resumes.a.resumeTitle).toBe("Ada, edited in one")
      expect(tab.getState().resumes.g.resumeTitle).toBe("Grace, edited in two")
    }
  })

  test("editing different fields of the same resume keep both", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "profileSection", { fullName: "Ada King" })
    two.edit("a", "workExperienceSection", [{ id: 1, companyName: "Analytical Engines" }])
    one.flush()
    two.flush()
    one.receive(keyOf("a"))

    const both = { profileSection: { fullName: "Ada King" }, workExperienceSection: [{ companyName: "Analytical Engines" }] }
    expect(stored(storage, "a")).toMatchObject(both)
    expect(one.getState().resumes.a).toMatchObject(both)
    expect(two.getState().resumes.a).toMatchObject(both)
  })

  test("editing the same field at once keep the one saved last", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "resumeTitle", "From one")
    two.edit("a", "resumeTitle", "From two")
    one.flush()
    two.flush()
    one.receive(keyOf("a"))

    expect(stored(storage, "a")?.resumeTitle).toBe("From two")
    expect(one.getState().resumes.a.resumeTitle).toBe("From two")
  })

  test("taking in another tab's save doesn't save it again", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "resumeTitle", "Ada's")
    one.flush()

    const setItem = vi.spyOn(storage, "setItem")
    two.receive(keyOf("a"))
    vi.advanceTimersByTime(SAVE_DELAY * 2)
    two.flush()
    expect(setItem).not.toHaveBeenCalled()
    expect(two.getState().resumes.a.resumeTitle).toBe("Ada's")
  })

  test("a late event doesn't undo what this tab saved since", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "profileSection", { fullName: "Ada King" })
    one.flush()
    // Two saves before hearing of one's save, so its save takes one's in.
    two.edit("a", "resumeTitle", "Ada's")
    two.flush()
    two.receive(keyOf("a"))
    one.receive(keyOf("a"))

    const both = { resumeTitle: "Ada's", profileSection: { fullName: "Ada King" } }
    expect(two.getState().resumes.a).toMatchObject(both)
    expect(one.getState().resumes.a).toMatchObject(both)
  })

  test("changes not saved yet stay when another tab's save comes in, and are saved after", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "profileSection", { fullName: "Ada King" })
    one.flush()
    two.edit("a", "resumeTitle", "Ada's")
    two.receive(keyOf("a"))

    const both = { resumeTitle: "Ada's", profileSection: { fullName: "Ada King" } }
    expect(two.getState().resumes.a).toMatchObject(both)
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(stored(storage, "a")).toMatchObject(both)
  })
})

describe("two tabs editing the profile", () => {
  test("keep different values changed in each", () => {
    const storage = memoryStorage(saved({ ...ada, profileSection: { fullName: "Ada Lovelace", email: "" } }))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "profileSection", { fullName: "Ada King", email: "" })
    two.edit("a", "profileSection", { fullName: "Ada Lovelace", email: "ada@example.com" })
    one.flush()
    two.receive(keyOf("a"))
    two.flush()
    one.receive(keyOf("a"))

    const both = { fullName: "Ada King", email: "ada@example.com" }
    expect(stored(storage, "a")?.profileSection).toEqual(both)
    expect(one.getState().resumes.a.profileSection).toEqual(both)
    expect(two.getState().resumes.a.profileSection).toEqual(both)
  })
})

describe("deleting", () => {
  test("a resume deleted in another tab goes from this one too", () => {
    const storage = memoryStorage(saved(ada, grace))
    const one = openTab(storage)
    const two = openTab(storage)
    one.remove("a")
    expect(storage.getItem(keyOf("a"))).toBeNull()

    two.receive(keyOf("a"))
    expect(Object.keys(two.getState().resumes)).toEqual(["g"])
  })

  test("a resume this tab has unsaved changes to stays, and is saved again", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    two.edit("a", "resumeTitle", "Still writing")
    one.remove("a")
    two.receive(keyOf("a"))
    expect(two.getState().resumes.a.resumeTitle).toBe("Still writing")

    vi.advanceTimersByTime(SAVE_DELAY)
    expect(stored(storage, "a")?.resumeTitle).toBe("Still writing")
  })

  test("a deletion that couldn't be finished says so, and is tried again", () => {
    const storage = memoryStorage(saved(ada, grace))
    const tab = openTab(storage)
    // An earlier version still has it, and there's no room to change that.
    storage.setItem(LEGACY_KEY, JSON.stringify({ a: ada }))
    const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    tab.remove("a")
    expect(tab.getState().saveStatus).toBe("full")
    expect(tab.getState().unsaved).toBe(true)

    setItem.mockRestore()
    tab.flush()
    expect(tab.getState().saveStatus).toBe("saved")
    expect(tab.getState().unsaved).toBe(false)
    expect(storage.getItem(LEGACY_KEY)).toBe("{}")
    expect(Object.keys(openTab(storage).getState().resumes)).toEqual(["g"])
  })

  test("if another tab clears storage, a resume this tab has unsaved changes to is saved again", () => {
    const storage = memoryStorage(saved(ada, grace))
    const tab = openTab(storage)
    tab.edit("a", "resumeTitle", "Still writing")
    storage.clear()
    tab.receive(null)
    expect(Object.keys(tab.getState().resumes)).toEqual(["a"])

    vi.advanceTimersByTime(SAVE_DELAY)
    expect(stored(storage, "a")?.resumeTitle).toBe("Still writing")
  })
})

describe("something another tab saved that can't be read", () => {
  test("is kept aside, and this tab saves its own version back", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    storage.setItem(keyOf("a"), "not json")
    tab.receive(keyOf("a"))
    expect(tab.getState().resumes.a).toEqual(ada)

    vi.advanceTimersByTime(SAVE_DELAY)
    expect(stored(storage, "a")).toEqual(ada)
    expect(tab.getState().unreadable).toEqual(["not json"])
  })
})

describe("a resume another tab saved that can't all be read", () => {
  test("shows why when it can't be kept aside, and loads what can be read", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    storage.setItem(keyOf("x"), JSON.stringify({ id: "x", resumeTitle: "X", educationSection: { schoolName: "MIT" } }))
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    tab.receive(keyOf("x"))
    expect(tab.getState().resumes.x).toEqual({ id: "x", resumeTitle: "X" })
    expect(tab.getState().saveStatus).toBe("full")
  })
})

describe("when storage doesn't work", () => {
  test("blocked, resumes still work in memory and the status says so", () => {
    const tab = openTab(null)
    const id = tab.create("Untitled resume", "personal")
    tab.edit(id, "resumeTitle", "Mine")
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(tab.getState()).toMatchObject({ loaded: true, saveStatus: "blocked" })
    expect(tab.getState().resumes[id].resumeTitle).toBe("Mine")
    expect(tab.getState().unsaved).toBe(true)
  })

  test("full, the status says so, and the changes are saved once there's room", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    vi.spyOn(storage, "setItem").mockImplementationOnce(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    tab.edit("a", "resumeTitle", "Ada's")
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(tab.getState().saveStatus).toBe("full")
    expect(tab.getState().unsaved).toBe(true)

    tab.edit("a", "resumeTitle", "Ada's resume")
    vi.advanceTimersByTime(SAVE_DELAY)
    expect(tab.getState().saveStatus).toBe("saved")
    expect(stored(storage, "a")?.resumeTitle).toBe("Ada's resume")
    expect(tab.getState().unsaved).toBe(false)
  })
})

describe("resumes saved by earlier versions", () => {
  test("are moved to keys of their own when the page opens", () => {
    const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify({ a: ada, g: grace }) })
    expect(openTab(storage).getState().resumes).toEqual({ a: ada, g: grace })
    expect(stored(storage, "a")).toEqual(ada)
    expect(storage.getItem(LEGACY_KEY)).toBeNull()
  })

  test("saved by a tab still on an earlier version are taken in", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    const newer = { ...ada, resumeTitle: "Saved by an older tab", updatedAt: "2026-10-06T13:00:00.000Z" }
    storage.setItem(LEGACY_KEY, JSON.stringify({ a: newer }))
    tab.receive(LEGACY_KEY, storage.getItem(LEGACY_KEY))

    expect(tab.getState().resumes.a.resumeTitle).toBe("Saved by an older tab")
    expect(stored(storage, "a")?.resumeTitle).toBe("Saved by an older tab")
    expect(storage.getItem(LEGACY_KEY)).toBeNull()
  })
})

describe("a tab still on an earlier version", () => {
  const newer = { ...ada, resumeTitle: "Saved by an older tab", updatedAt: "2026-10-06T13:00:00.000Z" }

  test("saving just after this tab moved everything still has its save moved", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    // It saved, and the key was removed again before this tab heard of it.
    const value = JSON.stringify({ a: newer })
    tab.receive(LEGACY_KEY, value)
    expect(tab.getState().resumes.a.resumeTitle).toBe("Saved by an older tab")
    expect(stored(storage, "a")?.resumeTitle).toBe("Saved by an older tab")
  })

  test("saving when there's no room to move it has its save taken in, and saved once there's room", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    const value = JSON.stringify({ a: newer })
    storage.setItem(LEGACY_KEY, value)
    const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    tab.receive(LEGACY_KEY, value)
    expect(tab.getState().resumes.a.resumeTitle).toBe("Saved by an older tab")

    setItem.mockRestore()
    tab.flush()
    expect(stored(storage, "a")?.resumeTitle).toBe("Saved by an older tab")
  })
})

describe("a late event from a tab on an earlier version", () => {
  test("doesn't bring back a resume deleted here since", () => {
    const storage = memoryStorage(saved(ada, grace))
    const tab = openTab(storage)
    tab.remove("a")
    // Saved before the deletion, but heard of only now.
    tab.receive(LEGACY_KEY, JSON.stringify({ a: ada, g: grace }))
    expect(storage.getItem(keyOf("a"))).toBeNull()
    expect(Object.keys(tab.getState().resumes)).toEqual(["g"])
  })

  test("doesn't take an older save over a newer one under the resume's own key that this tab hasn't heard of", () => {
    const storage = memoryStorage(saved(ada))
    const one = openTab(storage)
    const two = openTab(storage)
    one.edit("a", "resumeTitle", "Newest, from one")
    one.flush()
    // Saved between ada's version and one's, by a tab on the earlier version,
    // and heard of by two before one's save.
    const between = { ...ada, resumeTitle: "From an older tab", updatedAt: "2026-10-06T11:00:00.000Z" }
    two.receive(LEGACY_KEY, JSON.stringify({ a: between }))
    expect(two.getState().resumes.a.resumeTitle).toBe("Newest, from one")

    vi.advanceTimersByTime(SAVE_DELAY)
    two.flush()
    expect(stored(storage, "a")?.resumeTitle).toBe("Newest, from one")
  })

  test("that can't be read or kept aside says why", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    tab.receive(LEGACY_KEY, "not json")
    expect(tab.getState().saveStatus).toBe("full")
  })
})

describe("adding resumes", () => {
  test("a new resume is saved straight away, numbered if its name is taken", () => {
    const storage = memoryStorage()
    const tab = openTab(storage)
    const first = tab.create("Untitled resume", "personal")
    const second = tab.create("Untitled resume", "personal")
    expect(stored(storage, first)?.resumeTitle).toBe("Untitled resume")
    expect(stored(storage, second)?.resumeTitle).toBe("Untitled resume 2")
  })

  test("a resumezip PDF keeps its id, unless this browser already has that resume", () => {
    const tab = openTab(memoryStorage())
    expect(tab.importResume({ id: "from-pdf" }, "Ada.pdf")).toBe("from-pdf")
    expect(tab.importResume({ id: "from-pdf" }, "Ada.pdf")).not.toBe("from-pdf")
    expect(tab.importResume({ id: "other" }, "Grace.pdf", { keepId: false })).not.toBe("other")
  })

  test("replacing a resume with a file keeps the file's edit time, so the next file opened is compared with that", () => {
    const storage = memoryStorage(saved(ada))
    const tab = openTab(storage)
    tab.replace("a", { profileSection: { fullName: "Ada Byron" }, updatedAt: "2026-10-05T09:00:00.000Z" })
    expect(tab.getState().resumes.a.updatedAt).toBe("2026-10-05T09:00:00.000Z")
    expect(stored(storage, "a")).toMatchObject({
      resumeTitle: "Ada",
      profileSection: { fullName: "Ada Byron" },
      updatedAt: "2026-10-05T09:00:00.000Z",
    })

    // A file that doesn't say when it was edited counts as edited now.
    tab.replace("a", { profileSection: { fullName: "Ada King" } })
    expect(stored(storage, "a")?.updatedAt).toBe("2026-10-06T12:00:00.000Z")
  })

  test("replacing a resume with a file can be undone, which puts back and saves the resume as it was", () => {
    const storage = memoryStorage(saved(ada, grace))
    const tab = openTab(storage)
    tab.replace("a", { profileSection: { fullName: "Ada Byron" }, updatedAt: "2026-10-05T09:00:00.000Z" })
    expect(tab.getState().replaced).toEqual({ id: "a", before: ada })

    tab.undoReplace()
    expect(tab.getState().resumes.a).toEqual(ada)
    expect(tab.getState().replaced).toBeNull()
    expect(stored(storage, "a")).toEqual(ada)
    expect(openTab(storage).getState().resumes.a).toEqual(ada)
  })

  test("deleting a resume that was replaced means there's nothing to undo", () => {
    const tab = openTab(memoryStorage(saved(ada)))
    tab.replace("a", { profileSection: { fullName: "Ada Byron" } })
    tab.remove("a")
    expect(tab.getState().replaced).toBeNull()
  })

  test("resumes saved with the same name are numbered when the page opens, and that's saved", () => {
    const storage = memoryStorage(saved(ada, { ...grace, resumeTitle: "Ada" }))
    const tab = openTab(storage)
    const titles = (resumes: (Resume | null | undefined)[]) => resumes.map((resume) => resume?.resumeTitle).sort()
    expect(titles(Object.values(tab.getState().resumes))).toEqual(["Ada", "Ada 2"])

    vi.advanceTimersByTime(SAVE_DELAY)
    expect(titles([stored(storage, "a"), stored(storage, "g")])).toEqual(["Ada", "Ada 2"])
  })
})
