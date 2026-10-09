"use client"

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { DraggableProvided, DropResult } from "@hello-pangea/dnd"
import { GripVertical, Plus } from "lucide-react"
import { useOpenResume, useResumeField } from "@/context/ResumeContext"
import { isLeftOut } from "@/lib/leftOut"
import type { Entry } from "@/lib/resume"
import { useCheckActions, useCheckTarget } from "./CheckContext"
import { loadDragAndDrop, loadedDragAndDrop } from "./dragAndDrop"
import { DoneIcon, EyeIcon, PencilIcon, RowAction, RowToggle, TrashIcon } from "@/components/dashboard/RowActions"
import { BulletsField, Field, FlagNote, SectionHeading, selectLine } from "./fields"
import { reducedMotion, reveal, scrollerOf } from "./layout"
import DeleteSection from "./DeleteSection"
import PaperFromLink from "./PaperFromLink"
import { FIELD_SPAN, type ChoiceDef, type ChoiceKey, type FieldKey, type SectionDef } from "./sections"

interface SectionFormProps {
  section: SectionDef
  /** e.g. "03 / 08" */
  position: string
  /** Takes the section off the resume, for one that's optional. */
  onDelete?: () => void
}

// How long an entry takes to slide open, closed or away (matches duration-300).
const SLIDE_MS = 300

// How long a dragged entry takes to slide to its new place, then how long it
// stays lit up after, to show which one moved.
const MOVE_MS = 200
const LIT_MS = 900
// The id of those animations, to tell them from the CSS transitions on the same elements.
const MOVING = "moving"

/** Lit up, an entry sits on a sheet a little wider than its words. It covers the entry it slides past. */
const litUp = (color: string): Keyframe => ({ backgroundColor: color, boxShadow: `-12px 0 ${color}, 12px 0 ${color}` })

// An entry being dragged sits on the same sheet, lifted off the page.
const LIFTED = "bg-sheet shadow-[-12px_0_var(--color-sheet),12px_0_var(--color-sheet),0_16px_32px_-12px_rgb(17_19_24/0.3)]"

// Where a field is typed in: not the Include boxes in an entry's heading, or
// in a bullets field being arranged.
const TYPED = ':is(input:not([type="checkbox"]), textarea)'
const FIRST_FIELD = `[data-field] ${TYPED}`

/** Moves the cursor to what the checker points at (one bullet, if `line` is given) and scrolls it into view. */
function pointAt(target: HTMLElement | null | undefined, line?: number, view: HTMLElement | null | undefined = target) {
  if (!target) return
  target.focus({ preventScroll: true })
  if (line !== undefined && target instanceof HTMLTextAreaElement) selectLine(target, line)
  view?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" })
}

/** Where each entry is drawn, mid-slide or not, from the top of their list. */
function placesOf(entries: Map<number, HTMLElement>, list: HTMLElement | null): Map<number, number> {
  const top = list?.getBoundingClientRect().top ?? 0
  return new Map([...entries].map(([id, element]) => [id, element.getBoundingClientRect().top - top]))
}

/** Stops the entries' slides and lights, so the next move can start them afresh. */
function stopMoving(entries: Map<number, HTMLElement>) {
  for (const element of entries.values()) {
    for (const animation of element.getAnimations()) if (animation.id === MOVING) animation.cancel()
  }
}

/**
 * Slides each entry from where it was drawn (`from`) to its place now, and
 * lights up the one that moved. With less motion, it only lights up.
 */
function slide(entries: Map<number, HTMLElement>, list: HTMLElement | null, moved: number, from: Map<number, number>) {
  const to = placesOf(entries, list)
  const still = reducedMotion()
  // The sheet's color as a color, so the keyframes don't rely on var() in script animations.
  const lit = litUp(getComputedStyle(document.documentElement).getPropertyValue("--color-sheet").trim())
  const unlit = litUp("transparent")
  for (const [id, element] of entries) {
    const start = from.get(id)
    const by = start === undefined || still ? 0 : start - (to.get(id) ?? start)
    const sliding = Math.abs(by) >= 1
    if (id === moved) {
      const keyframes = sliding
        ? [
            { ...lit, transform: `translateY(${by}px)`, zIndex: 1, easing: "ease-out" },
            { ...lit, transform: "none", zIndex: 1, offset: MOVE_MS / (MOVE_MS + LIT_MS), easing: "ease-in" },
            { ...unlit, transform: "none" },
          ]
        : [{ ...lit, easing: "ease-in" }, unlit]
      element.animate(keyframes, { id: MOVING, duration: (sliding ? MOVE_MS : 0) + LIT_MS })
    } else if (sliding) {
      element.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], { id: MOVING, duration: MOVE_MS, easing: "ease-out" })
    }
  }
}

/** The form for one list section (education, experience, ...): its title and entries. */
function SectionForm({ section, position, onDelete }: SectionFormProps) {
  const { read, update: updateResume } = useOpenResume()
  const saved = useResumeField(section.dataKey)
  const headings = useResumeField("headings")
  const entries = Array.isArray(saved) ? saved : []
  const latest = useRef(entries)
  latest.current = entries

  // One entry is open at a time; the rest collapse to a one-line summary.
  const [openId, setOpenId] = useState<number | null>(entries[0]?.id ?? null)
  // Follows openId a frame later, so a newly added entry slides open too.
  const [shownId, setShownId] = useState<number | null>(openId)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const elements = useRef(new Map<number, HTMLElement>())
  const list = useRef<HTMLElement | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  const opened = useRef(openId)
  opened.current = openId
  // A drop that hasn't lit up yet: which entry moved, and where each entry was drawn before it.
  const moving = useRef<{ id: number; from: Map<number, number>; frame?: number } | null>(null)
  const [dnd, setDnd] = useState(loadedDragAndDrop)

  // Drag and drop puts the entries on the page anew as it arrives, so it
  // waits while the person is in one of them: they'd lose the cursor, and
  // what Ctrl+Z would take back.
  useEffect(() => {
    if (dnd) return
    let live = true
    let stop = () => {}
    loadDragAndDrop().then(
      (module) => {
        if (!live) return
        if (!list.current?.contains(document.activeElement)) return setDnd(module)
        const leave = (event: FocusEvent) => {
          if (event.relatedTarget instanceof Node && list.current?.contains(event.relatedTarget)) return
          stop()
          setDnd(module)
        }
        document.addEventListener("focusout", leave)
        stop = () => document.removeEventListener("focusout", leave)
      },
      () => {},
    )
    return () => {
      live = false
      stop()
    }
  }, [dnd])

  // What the checker points at in this section, while the person fixes it.
  const target = useCheckTarget()
  const { pending, claim } = useCheckActions()
  const place = target?.finding.place
  const here = place && "section" in place && place.section === section.name ? place : null
  const flagAt = (index: number, field?: string) =>
    here?.kind === "entry" && here.entry === index && here.field === field ? target!.finding : null

  // When the person chooses a finding here, open its entry, then move to its
  // field once the entry has slid open: just once, not each time it's shown.
  useEffect(() => {
    const place = target?.finding.place
    if (!target || !place || !("section" in place) || place.section !== section.name) return
    if (!pending(target.request)) return
    const entry = place.kind === "entry" ? latest.current[place.entry] : undefined
    if (place.kind === "entry" && !entry) return
    const sliding = entry !== undefined && entry.id !== opened.current && !reducedMotion()
    if (entry) {
      setConfirmingId(null)
      setOpenId(entry.id)
      setShownId(entry.id)
    }
    const timer = setTimeout(
      () => {
        if (!claim(target.request)) return
        if (place.kind === "heading") {
          pointAt(heading.current?.querySelector<HTMLElement>('button[aria-label="Rename section"]'), undefined, heading.current)
        } else if (place.kind === "section") {
          pointAt(addButton.current, undefined, heading.current)
        } else if (entry) {
          const fields = elements.current.get(entry.id)
          const selector = place.field ? `[data-field="${place.field}"] ${TYPED}` : FIRST_FIELD
          pointAt(fields?.querySelector<HTMLElement>(selector), place.line)
        }
      },
      sliding ? SLIDE_MS : 0,
    )
    return () => clearTimeout(timer)
  }, [target, pending, claim, section.name])

  // Asking to confirm a delete moves focus to Cancel, so Escape or Enter backs out.
  useEffect(() => {
    if (confirmingId !== null) cancelButton.current?.focus()
  }, [confirmingId])

  const cancelDelete = (id: number) => {
    setConfirmingId(null)
    requestAnimationFrame(() => elements.current.get(id)?.querySelector<HTMLElement>("[data-delete]")?.focus())
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShownId(openId))
    return () => cancelAnimationFrame(frame)
  }, [openId])

  // A dropped entry lights up a frame after it's put on the page, where it ends up.
  useLayoutEffect(() => {
    const waiting = moving.current
    if (!waiting || waiting.frame !== undefined) return
    waiting.frame = requestAnimationFrame(() => {
      moving.current = null
      slide(elements.current, list.current, waiting.id, waiting.from)
    })
  }, [saved])

  const save = (next: Entry[]) => updateResume(section.dataKey, next)

  /**
   * Puts the cursor in an entry's first field, except on touch screens where it
   * would pop up the keyboard, and except when it's already in one of the
   * entry's fields: someone who clicked into a field while the entry slid
   * open keeps typing there.
   */
  const focusFirstField = (id: number) => {
    if (!window.matchMedia("(pointer: fine)").matches) return
    const element = elements.current.get(id)
    if (document.activeElement?.matches(FIRST_FIELD) && element?.contains(document.activeElement)) return
    element?.querySelector<HTMLElement>(FIRST_FIELD)?.focus({ preventScroll: true })
  }

  /**
   * Opens one entry (or closes them all), keeping the entry that was clicked
   * still on screen while the entries around it slide open or closed.
   */
  const open = (id: number | null, clicked: number) => {
    setConfirmingId(null)
    setOpenId(id)
    // One entry closes as the other opens, in the same frame, so the page's height barely changes.
    setShownId(id)
    const element = elements.current.get(clicked)
    if (!element) return
    // Hold it in place while things move (instantly, with reduced motion), then
    // bring the opened entry's first fields into view if they ran off the bottom.
    // The browser's own scroll anchoring would fight this, so it's off meanwhile.
    const reduced = reducedMotion()
    const scroller = scrollerOf(element)
    const anchoring = scroller.style.overflowAnchor
    scroller.style.overflowAnchor = "none"
    const top = element.getBoundingClientRect().top
    const start = performance.now()
    const hold = () => {
      scroller.scrollTop += element.getBoundingClientRect().top - top
      if (performance.now() - start < (reduced ? 0 : SLIDE_MS) + 60) {
        requestAnimationFrame(hold)
        return
      }
      scroller.style.overflowAnchor = anchoring
      if (id !== null) reveal(element, scroller, reduced)
    }
    requestAnimationFrame(hold)
    if (id !== null) requestAnimationFrame(() => focusFirstField(id))
  }

  /**
   * Adds entries at the end and opens the first. It builds on the latest
   * entries, so nothing typed while a paper was being looked up is lost.
   * `show` brings the opened entry into view and puts the cursor in it.
   */
  const addEntries = (values: Partial<Record<FieldKey, string>>[], show = true) => {
    const current = latest.current
    const id = current.length > 0 ? Math.max(...current.map((entry) => entry.id)) + 1 : 1
    const blank = Object.fromEntries(section.fields.map((field) => [field.key, ""]))
    save([...current, ...values.map((value, index): Entry => ({ ...blank, ...value, id: id + index }))])
    setConfirmingId(null)
    setOpenId(id)
    if (!show) return
    // Once it has slid open, bring it into view.
    setTimeout(
      () => {
        const element = elements.current.get(id)
        if (element) reveal(element, scrollerOf(element), reducedMotion())
        focusFirstField(id)
      },
      reducedMotion() ? 0 : SLIDE_MS,
    )
  }

  const add = () => addEntries([{}])

  // The others keep their ids, so React doesn't give the next entry what was
  // the deleted one's: its place in the slide, or a bullets field's mode.
  const remove = (id: number) => {
    const hadFocus = elements.current.get(id)?.contains(document.activeElement) ?? false
    save(latest.current.filter((entry) => entry.id !== id))
    setRemovingId(null)
    setOpenId((current) => (current === id ? null : current))
    if (hadFocus) addButton.current?.focus({ preventScroll: true })
  }

  // The entry slides away, then it's deleted.
  const confirmRemove = (id: number) => {
    setConfirmingId(null)
    if (reducedMotion()) return remove(id)
    setRemovingId(id)
    setTimeout(() => remove(id), SLIDE_MS)
  }

  const update = (id: number, key: FieldKey, value: string) =>
    save(entries.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)))

  /**
   * Puts a dragged entry where it was dropped, and lights it up there. Drag
   * and drop has moved it there already, and tells screen readers where.
   */
  const onDragEnd = ({ draggableId, destination }: DropResult) => {
    const current = latest.current
    const id = Number(draggableId)
    const from = current.findIndex((entry) => entry.id === id)
    if (!destination || from < 0 || destination.index === from) return
    const next = [...current]
    next.splice(destination.index, 0, ...next.splice(from, 1))
    moving.current = { id, from: new Map() }
    save(next)
    setConfirmingId(null)
  }

  /** Leaves an entry out of the PDF, or puts it back. An entry that's in has no `leftOut` at all. */
  const setLeftOut = (id: number, leftOut: boolean) =>
    save(
      latest.current.map((entry) => {
        if (entry.id !== id) return entry
        const { leftOut: _, ...rest } = entry
        return leftOut ? { ...rest, leftOut: true } : rest
      }),
    )

  const title = headings?.[section.headingKey] || section.title
  // "Add experience", or "Add to Work History" once the person has renamed the section.
  const addLabel = title === section.title ? section.addLabel : `Add to ${title}`
  const quiet = "py-2 text-sm text-ink-2 transition-colors hover:text-ink"

  const addButtonElement = (
    <button
      ref={addButton}
      type="button"
      onClick={add}
      className="inline-flex h-10 items-center gap-2 self-start rounded-[4px] border border-rule-strong px-3.5 text-sm text-ink transition-colors hover:border-ink"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      {addLabel}
    </button>
  )

  /** An entry, the same with drag and drop or without, so it doesn't move as drag and drop arrives. */
  const renderEntry = (entry: Entry, index: number, drag?: DraggableProvided, dragging = false) => {
    const isOpen = entry.id === openId
    const confirming = entry.id === confirmingId
    // Its first filled field stands in when the usual ones are empty, like a paper's link added by hand.
    const summary =
      section.summary
        .map((key) => entry[key]?.trim())
        .filter(Boolean)
        .join(", ") || section.fields.map((field) => entry[field.key]?.trim()).find(Boolean)
    const name = `entry ${index + 1}`
    const leftOut = isLeftOut(entry)

    return (
      <div
        key={entry.id}
        ref={(element) => {
          drag?.innerRef(element)
          if (element) elements.current.set(entry.id, element)
          else elements.current.delete(entry.id)
        }}
        {...drag?.draggableProps}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          entry.id === removingId ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
        } ${dragging ? LIFTED : ""}`}
      >
        {/* Room on the sides so focus outlines aren't clipped while it slides. */}
        <section className="-mx-1 min-h-0 overflow-hidden px-1">
          <div className={`border-t pb-7 pt-4 transition-colors duration-300 ${isOpen ? "border-ink" : "border-rule"}`}>
            <div className="flex items-start justify-between gap-4">
              {/* A click on an entry's heading also opens it, or closes it if it's open. From the keyboard, it's Edit and Done. */}
              <div
                className="group flex min-w-0 flex-1 cursor-pointer flex-col gap-1"
                onClick={() => open(isOpen ? null : entry.id, entry.id)}
              >
                <span className={`label-mono text-ink-2 ${isOpen ? "transition-colors group-hover:text-ink" : ""}`}>
                  Entry {index + 1}
                  {leftOut && " · Left out"}
                </span>
                {!isOpen && (
                  <span
                    className={`truncate text-[15px] underline-offset-4 group-hover:underline ${summary && !leftOut ? "text-ink" : "text-ink-2"}`}
                  >
                    {summary || "Empty entry"}
                  </span>
                )}
              </div>

              <div
                className="-my-1.5 flex shrink-0 flex-wrap items-center justify-end gap-0.5"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && confirming) {
                    event.stopPropagation()
                    cancelDelete(entry.id)
                  }
                }}
              >
                {!confirming && (
                  <>
                    <span
                      key="move"
                      {...drag?.dragHandleProps}
                      aria-label={drag && `Reorder ${name}`}
                      className="rounded-[4px] p-1.5 text-ink-2 transition-colors hover:text-ink"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <RowToggle
                      key="include"
                      label={`Include ${name} in the PDF`}
                      tip={leftOut ? "Put back in the PDF" : "Leave out of the PDF"}
                      checked={!leftOut}
                      onChange={(checked) => setLeftOut(entry.id, !checked)}
                      tipBelow
                    >
                      <EyeIcon shut={leftOut} />
                    </RowToggle>
                  </>
                )}
                {!isOpen ? (
                  <RowAction key="edit" label={`Edit ${name}`} tip="Edit" onClick={() => open(entry.id, entry.id)} tipBelow tipAtEnd>
                    <PencilIcon />
                  </RowAction>
                ) : confirming ? (
                  // The question fades in where the buttons were (`starting:` is CSS @starting-style), as tall as them.
                  <span
                    key="confirming"
                    className="flex h-10 items-center gap-4 transition-opacity duration-200 motion-reduce:transition-none starting:opacity-0"
                  >
                    <span className="py-2 text-sm text-ink" role="status">
                      Delete this entry?
                    </span>
                    <button ref={cancelButton} type="button" onClick={() => cancelDelete(entry.id)} className={quiet}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmRemove(entry.id)}
                      className="py-2 text-sm font-medium text-[#b42318] underline-offset-4 hover:underline"
                    >
                      Delete
                    </button>
                  </span>
                ) : (
                  <>
                    <RowAction
                      key="delete"
                      data-delete=""
                      label={`Delete ${name}`}
                      tip="Delete"
                      danger
                      onClick={() => setConfirmingId(entry.id)}
                      tipBelow
                    >
                      <TrashIcon />
                    </RowAction>
                    <RowAction key="done" label={`Done editing ${name}`} tip="Done" onClick={() => open(null, entry.id)} tipBelow tipAtEnd>
                      <DoneIcon />
                    </RowAction>
                  </>
                )}
              </div>
            </div>

            {/* The fields slide open and closed. */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                entry.id === shownId && isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              {/* The container whose width lays out the fields (FIELD_SPAN). It's here rather than
                  around the whole form: Safari before 26 doesn't place a fixed element inside a
                  query container right (WebKit bug 284945), and an entry being dragged is fixed. */}
              <div className="@container -mx-1 min-h-0 overflow-hidden px-1" inert={!isOpen}>
                <div className="grid grid-cols-2 gap-x-7 gap-y-6 pb-1 pt-5 @lg:grid-cols-4">
                  {leftOut && (
                    <p className="col-span-2 text-[13px] leading-normal text-ink-2 @lg:col-span-4">
                      Left out of the PDF, and of the copy of the resume inside it. It stays here, in this browser.
                    </p>
                  )}
                  {flagAt(index) && (
                    <div className="col-span-2 @lg:col-span-4">
                      <FlagNote finding={flagAt(index)!} />
                    </div>
                  )}
                  {section.fields.map((field) => {
                    const Input = field.type === "bullets" ? BulletsField : Field
                    const flag = flagAt(index, field.key)
                    return (
                      <Input
                        key={field.key}
                        name={field.key}
                        label={field.label}
                        placeholder={field.placeholder}
                        value={entry[field.key] ?? ""}
                        onChange={(value) => update(entry.id, field.key, value)}
                        className={FIELD_SPAN[field.size]}
                        flag={flag}
                        request={flag ? target!.request : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div ref={heading}>
        <SectionHeading
          position={position}
          title={title}
          onRename={(name) => updateResume("headings", { ...headings, [section.headingKey]: name })}
          flag={here?.kind === "heading" || here?.kind === "section" ? target!.finding : null}
        />
      </div>

      {onDelete && (
        <div className="flex justify-end">
          <DeleteSection onDelete={onDelete} />
        </div>
      )}

      {section.choice && <SectionChoice choice={section.choice} />}

      {entries.length === 0 && <p className="border-t border-ink pt-5 text-[15px] text-ink-2">Nothing here yet.</p>}

      {entries.length > 0 &&
        (dnd ? (
          <dnd.DragDropContext onBeforeCapture={() => stopMoving(elements.current)} onDragEnd={onDragEnd}>
            <dnd.Droppable droppableId="entries">
              {(drop) => (
                <div
                  ref={(element) => {
                    drop.innerRef(element)
                    list.current = element
                  }}
                  {...drop.droppableProps}
                  className="flex flex-col"
                >
                  {entries.map((entry, index) => (
                    <dnd.Draggable key={entry.id} draggableId={String(entry.id)} index={index} isDragDisabled={entry.id === confirmingId}>
                      {(drag, snapshot) => renderEntry(entry, index, drag, snapshot.isDragging)}
                    </dnd.Draggable>
                  ))}
                  {drop.placeholder}
                </div>
              )}
            </dnd.Droppable>
          </dnd.DragDropContext>
        ) : (
          <div
            ref={(element) => {
              list.current = element
            }}
            className="flex flex-col"
          >
            {entries.map((entry, index) => renderEntry(entry, index))}
          </div>
        ))}

      {section.fromPaperLink ? (
        <PaperFromLink entries={() => latest.current} owner={() => read()?.profileSection?.fullName ?? ""} onAdd={addEntries}>
          {addButtonElement}
        </PaperFromLink>
      ) : (
        addButtonElement
      )}
    </div>
  )
}

// Re-renders with its own fields and the finding being fixed, not with a new preview.
export default memo(SectionForm)

/** A choice that applies to the whole section, like how project links are printed. */
function SectionChoice({ choice }: { choice: ChoiceDef<ChoiceKey> }) {
  const { update } = useOpenResume()
  const value = useResumeField(choice.key)
  const selected = choice.options.find((option) => option.value === value) ?? choice.options[0]
  return (
    <div className="-mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span id={`${choice.key}-label`} className="label-mono text-ink-2">
          {choice.label}
        </span>
        <div role="radiogroup" aria-labelledby={`${choice.key}-label`} className="flex flex-wrap gap-2">
          {choice.options.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-[4px] border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                option === selected ? "border-ink bg-ink text-white" : "border-rule-strong text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name={choice.key}
                value={option.value}
                checked={option === selected}
                onChange={() => update(choice.key, option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      <p className="text-[13px] leading-normal text-ink-2">{selected.hint}</p>
    </div>
  )
}
