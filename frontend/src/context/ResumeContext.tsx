"use client"
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { keepSavedData } from "@/lib/keepSavedData"
import type { Resume, ResumeContent, ResumeField } from "@/lib/resume"
import { createResumeStore, INITIAL_STATE, type ResumeState } from "@/lib/resumeStore"
import { getStorage } from "@/lib/resumeStorage"

/** What changes the resumes. Each keeps the same identity for as long as the page is open. */
interface ResumeActions {
  setCurrentResumeId: (id: string | null) => void
  createNewResume: (title: string, tag: string, template?: string) => string
  importResume: (content: ResumeContent, title: string, options?: { keepId?: boolean }) => string
  replaceResume: (id: string, content: ResumeContent) => void
  /** Puts back the resume replaceResume last replaced (see ResumeState.replaced). */
  undoReplace: () => void
  deleteResume: (id: string) => void
  deleteUnreadable: () => void
  /** The resumes as they are now, for event handlers that don't need to re-render with every change. */
  getState: () => ResumeState
}

interface ResumeContextValue extends ResumeState, ResumeActions {
  currentResumeId: string | null
  /** The open resume, or {} when none is open. */
  formData: Resume
  /** Changes a field of the open resume. */
  updateFormData: <Field extends ResumeField>(field: Field, value: Resume[Field]) => void
}

const ResumeContext = createContext<ResumeContextValue | null>(null)
const ResumeActionsContext = createContext<ResumeActions | null>(null)

const getInitialState = () => INITIAL_STATE

export const FormProvider = ({ children }: { children: React.ReactNode }) => {
  // Resumes only live in this browser's localStorage; there are no accounts.
  // lib/resumeStore.ts keeps them, and decides when to save them.
  const [store] = useState(() => createResumeStore())
  const state = useSyncExternalStore(store.subscribe, store.getState, getInitialState)
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null)

  // Read the saved resumes once the page is in the browser, take in what
  // other tabs save, and save what's waiting before the page is closed or
  // hidden (as when switching apps on a phone).
  useEffect(() => {
    const storage = getStorage()
    store.load(storage)
    const onStorage = (event: StorageEvent) => {
      // Only localStorage; sessionStorage changes in a same-origin frame fire this too.
      if (storage && event.storageArea === storage) store.receive(event.key, event.newValue)
    }
    const flush = () => store.flush()
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") store.flush()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("pagehide", flush)
    // And when the window loses focus, as when clicking into another window
    // with the same resume open, so its changes are saved before typing there.
    window.addEventListener("blur", flush)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("blur", flush)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      store.flush()
    }
  }, [store])

  // Closing or reloading the page with changes not saved yet saves them first,
  // and asks if that fails. The listener is only there while something is
  // unsaved, as some browsers can't keep a page that has one for the back
  // button. It follows the store as it changes, not a render later, so a
  // change made just before closing is covered.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      store.flush()
      if (!store.getState().unsaved) return
      event.preventDefault()
      // What browsers before Chrome 119 need to ask.
      event.returnValue = true
    }
    let listening = false
    const follow = () => {
      const { unsaved } = store.getState()
      if (unsaved === listening) return
      listening = unsaved
      if (unsaved) window.addEventListener("beforeunload", onBeforeUnload)
      else window.removeEventListener("beforeunload", onBeforeUnload)
    }
    follow()
    const unsubscribe = store.subscribe(follow)
    return () => {
      unsubscribe()
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [store])

  // Once there's a resume, ask the browser not to delete it to make room;
  // once a page is enough.
  const hasResumes = Object.keys(state.resumes).length > 0
  const askedToKeep = useRef(false)
  useEffect(() => {
    const storage = getStorage()
    if (!hasResumes || !storage || askedToKeep.current) return
    askedToKeep.current = true
    void keepSavedData(storage)
  }, [hasResumes])

  const actions = useMemo<ResumeActions>(
    () => ({
      setCurrentResumeId,
      createNewResume: (title, tag, template) => {
        const id = store.create(title, tag, template)
        setCurrentResumeId(id)
        return id
      },
      importResume: store.importResume,
      replaceResume: store.replace,
      undoReplace: store.undoReplace,
      deleteResume: (id) => {
        store.remove(id)
        setCurrentResumeId((current) => (current === id ? null : current))
      },
      deleteUnreadable: store.deleteUnreadable,
      getState: store.getState,
    }),
    [store],
  )

  const formData = useMemo<Resume>(
    () => (currentResumeId && Object.hasOwn(state.resumes, currentResumeId) ? state.resumes[currentResumeId] : {}),
    [currentResumeId, state.resumes],
  )

  const updateFormData = useCallback(
    <Field extends ResumeField>(field: Field, value: Resume[Field]) => {
      if (currentResumeId) store.edit(currentResumeId, field, value)
    },
    [store, currentResumeId],
  )

  const value = useMemo<ResumeContextValue>(
    () => ({ ...state, ...actions, currentResumeId, formData, updateFormData }),
    [state, actions, currentResumeId, formData, updateFormData],
  )

  return (
    <ResumeActionsContext.Provider value={actions}>
      <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>
    </ResumeActionsContext.Provider>
  )
}

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
