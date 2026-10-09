"use client"
import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { keepSavedData } from "@/lib/keepSavedData"
import type { Resume, ResumeContent, ResumeField } from "@/lib/resume"
import { getStorage } from "@/lib/resumeKeys"
import { createResumeStore, INITIAL_STATE, resumeOf, type ResumeState, type ResumeStore } from "@/lib/resumeStore"

/** What changes the resumes. Each keeps the same identity until the page leaves the dashboard and editor. */
interface ResumeActions extends Pick<
  ResumeStore,
  "addSection" | "editSection" | "includeSection" | "removeSection" | "deleteSection" | "reorderSections"
> {
  createNewResume: (title: string, tag: string, template?: string) => string
  importResume: (content: ResumeContent, title: string, options?: { keepId?: boolean; tag?: string }) => string
  /** Adds the resumes from a JSON file of them all. */
  importAll: ResumeStore["importAll"]
  replaceResume: ResumeStore["replace"]
  undoReplace: (id: string) => void
  /** Adds a copy of a resume, and returns its id. */
  duplicateResume: (id: string) => string | undefined
  /** Renames a resume, numbering the name if it's taken. */
  renameResume: (id: string, title: string) => void
  /** Changes one field of a resume. */
  editResume: <Field extends ResumeField>(id: string, field: Field, value: Resume[Field]) => void
  deleteResume: (id: string) => void
  deleteUnreadable: () => void
  /** The resumes as they are now, for event handlers that don't need to re-render with every change. */
  getState: () => ResumeState
  /** Calls `listener` after every change, until the function it gives back is called. */
  subscribe: (listener: () => void) => () => void
}

type ResumeContextValue = ResumeState & ResumeActions

const ResumeContext = createContext<ResumeContextValue | null>(null)
const ResumeActionsContext = createContext<ResumeActions | null>(null)

const getInitialState = () => INITIAL_STATE

// Resumes only live in this browser's localStorage; there are no accounts.
// lib/resumeStore.ts keeps them, and decides when to save them. The page has
// one store, from the first time it needs the resumes until it's closed, so
// going to another page keeps what isn't saved yet, as when the browser won't
// save anything. The server renders with an empty store of its own.
let pageStore: ResumeStore | null = null
const storeOfPage = () => (typeof window === "undefined" ? createResumeStore() : (pageStore ??= createResumeStore()))

/**
 * The page's resumes, read from storage the first time they're needed: by
 * the dashboard or the editor, or by a link that starts a new resume. Only in
 * the browser.
 */
export function openResumes(): ResumeStore {
  const store = storeOfPage()
  if (store.getState().loaded) return store
  const storage = getStorage()
  store.load(storage)

  // Take in what other tabs save, and save what's waiting before the page is
  // closed or hidden (as when switching apps on a phone).
  window.addEventListener("storage", (event) => {
    // Only localStorage; sessionStorage changes in a same-origin frame fire this too.
    if (storage && event.storageArea === storage) store.receive(event.key, event.newValue)
  })
  const flush = () => store.flush()
  window.addEventListener("pagehide", flush)
  // And when the window loses focus, as when clicking into another window
  // with the same resume open, so its changes are saved before typing there.
  window.addEventListener("blur", flush)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") store.flush()
  })

  // Closing or reloading the page with changes not saved yet saves them first,
  // and asks if that fails. The listener is only there while something is
  // unsaved, as some browsers can't keep a page that has one for the back
  // button. It follows the store as it changes, not a render later, so a
  // change made just before closing is covered.
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    store.flush()
    if (!store.getState().unsaved) return
    event.preventDefault()
    // What browsers before Chrome 119 need to ask.
    event.returnValue = true
  }
  let listening = false
  // Once there's a resume, ask the browser not to delete it to make room;
  // once a page is enough.
  let askedToKeep = false
  const follow = () => {
    const { unsaved, resumes } = store.getState()
    if (unsaved !== listening) {
      listening = unsaved
      if (unsaved) window.addEventListener("beforeunload", onBeforeUnload)
      else window.removeEventListener("beforeunload", onBeforeUnload)
    }
    if (!askedToKeep && storage && Object.keys(resumes).length > 0) {
      askedToKeep = true
      void keepSavedData(storage)
    }
  }
  follow()
  store.subscribe(follow)
  return store
}

/** Shares the resumes with the dashboard and the editor. */
export const FormProvider = ({ children }: { children: React.ReactNode }) => {
  const [store] = useState(storeOfPage)
  const state = useSyncExternalStore(store.subscribe, store.getState, getInitialState)

  // Read the saved resumes once the page is in the browser, unless a page before this one did.
  useEffect(() => void openResumes(), [])

  const actions = useMemo<ResumeActions>(
    () => ({
      createNewResume: store.create,
      importResume: store.importResume,
      importAll: store.importAll,
      replaceResume: store.replace,
      undoReplace: store.undoReplace,
      duplicateResume: store.duplicate,
      renameResume: store.rename,
      editResume: store.edit,
      deleteResume: store.remove,
      deleteUnreadable: store.deleteUnreadable,
      getState: store.getState,
      addSection: store.addSection,
      editSection: store.editSection,
      includeSection: store.includeSection,
      removeSection: store.removeSection,
      deleteSection: store.deleteSection,
      reorderSections: store.reorderSections,
      subscribe: store.subscribe,
    }),
    [store],
  )

  const value = useMemo<ResumeContextValue>(() => ({ ...state, ...actions }), [state, actions])

  return (
    <ResumeActionsContext.Provider value={actions}>
      <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>
    </ResumeActionsContext.Provider>
  )
}

/** Every resume and what changes them. A component using this re-renders with every change to any resume. */
export const useResumeContext = () => {
  const context = useContext(ResumeContext)
  if (!context) throw new Error("useResumeContext must be used inside FormProvider")
  return context
}

/** Only what changes the resumes. A component using just this doesn't re-render when a resume changes. */
export const useResumeActions = () => {
  const actions = useContext(ResumeActionsContext)
  if (!actions) throw new Error("useResumeActions must be used inside FormProvider")
  return actions
}

/**
 * Part of the resumes' state, as `pick` picks it. A component using this
 * re-renders only when what's picked changes (by Object.is), so `pick` gives
 * back a value kept in the state, or a primitive, never a new object.
 */
export function useResumeState<Picked>(pick: (state: ResumeState) => Picked): Picked {
  const { subscribe, getState } = useResumeActions()
  return useSyncExternalStore(
    subscribe,
    () => pick(getState()),
    () => pick(INITIAL_STATE),
  )
}

/** The resume the editor has open. Each keeps the same identity for as long as it's open. */
interface OpenResume {
  id: string
  /** The resume as it is now, for event handlers and effects that shouldn't re-render with each change; undefined while there's none under its id. */
  read: () => Resume | undefined
  /** Changes one of its fields. */
  update: <Field extends ResumeField>(field: Field, value: Resume[Field]) => void
}

const OpenResumeContext = createContext<OpenResume | null>(null)

/** Opens the resume saved under `id` for what's inside: the editor reads and changes it with the hooks below. */
export function OpenResumeProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const { getState, editResume } = useResumeActions()
  const value = useMemo<OpenResume>(
    () => ({
      id,
      read: () => resumeOf(getState(), id),
      update: (field, value) => editResume(id, field, value),
    }),
    [id, getState, editResume],
  )
  return <OpenResumeContext.Provider value={value}>{children}</OpenResumeContext.Provider>
}

/** The open resume's id, and how to read it and change it, none of which re-render with a change to it. */
export const useOpenResume = () => {
  const open = useContext(OpenResumeContext)
  if (!open) throw new Error("useOpenResume must be used inside OpenResumeProvider")
  return open
}

/**
 * One field of the open resume. A component using this re-renders only when
 * that field changes, so typing in one part of the form doesn't re-render the rest.
 */
export function useResumeField<Field extends ResumeField>(field: Field): Resume[Field] | undefined {
  const { id } = useOpenResume()
  return useResumeState((state) => resumeOf(state, id)?.[field])
}
