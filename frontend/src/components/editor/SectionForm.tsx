"use client"

import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import type { DraggableProvided, DropResult } from "@hello-pangea/dnd"
import { ChevronDown, GripVertical, Plus } from "lucide-react"
import { useOpenResume, useResumeField } from "@/context/ResumeContext"
import { isLeftOut } from "@/lib/leftOut"
import type { Entry } from "@/lib/resume"
import { EyeIcon, RowAction, RowToggle, TrashIcon } from "@/components/dashboard/RowActions"
import { useCheckActions, useCheckTarget, usePointer } from "./CheckContext"
import DeleteSection, { asked, deleteWhat } from "./DeleteSection"
import { loadDragAndDrop, loadedDragAndDrop } from "./dragAndDrop"
import { newestFirst } from "./entryCards"
import { BulletsField, Field, FlagNote, pointAt, SectionHeading } from "./fields"
import { reducedMotion, reveal, scrollerOf } from "./layout"
import PaperFromLink from "./PaperFromLink"
import { FIELD_SPAN, type ChoiceDef, type ChoiceKey, type FieldKey, type SectionDef, type SectionName } from "./sections"

/** An entry just deleted, with what Undo needs to put it back. */
export interface DeletedEntry {
  section: SectionName
  entry: Entry
  /** Where it was in its section. */
  index: number
  /** What the message calls it: its one-line summary, or "Entry 2" when it has none. */
  title: string
}

interface SectionFormProps {
  section: SectionDef
  /** Takes the section off the resume. */
  onDelete: () => void
  /** An entry was deleted, and can be put back. */
  onEntryDeleted: (deleted: DeletedEntry) => void
  /** An entry Undo put back, which its section opens again once it's shown. */
  restored: { section: SectionName; id: number } | null
  /** The section has opened the entry put back. */
  onRestored: () => void
}

// How long an entry takes to slide open, closed or away (matches duration-300).
const SLIDE_MS = 300

// How long a dragged entry stays lit up in its new place, to show which one moved.
const LIT_MS = 900
// The id of those animations, to tell them from the CSS transitions on the same elements.
const MOVING = "moving"

// An entry's card lit up: lifted off the sheet, as when it's picked up (--shadow-card-lifted in globals.css).
const LIT: Keyframe = {
  boxShadow: "0 2px 4px rgb(17 19 24 / 0.06), 0 8px 18px -4px rgb(17 19 24 / 0.08), 0 24px 48px -10px rgb(17 19 24 / 0.18)",
}

// The fields in an open card: closer together than the profile's, as there are several cards.
const CARD_GRID = "grid grid-cols-1 gap-x-6 gap-y-4 @sm:grid-cols-2"

// Where a field is typed in: not the Include boxes in an entry's heading.
// A bullets box is an editable div.
const TYPED = ':is(input:not([type="checkbox"]), [contenteditable="true"])'
const FIRST_FIELD = `[data-field] ${TYPED}`

/** Stops the entries' lights, so the next move can start them afresh. */
function stopMoving(entries: Map<number, HTMLElement>) {
  for (const element of entries.values()) {
    for (const animation of element.querySelector("[data-card]")?.getAnimations() ?? []) if (animation.id === MOVING) animation.cancel()
  }
}

/** Lights up the card of the entry that moved. */
function lightUp(entries: Map<number, HTMLElement>, moved: number) {
  const card = entries.get(moved)?.querySelector<HTMLElement>("[data-card]")
  if (!card) return
  // It settles back to the shadow it has at rest, an open card's or a folded one's.
  const unlit: Keyframe = { boxShadow: getComputedStyle(card).boxShadow }
  card.animate([LIT, LIT, unlit], { id: MOVING, duration: LIT_MS, easing: "ease-in" })
}

/** The fields that name an entry's card: the company alone, or a skill group and its skills. */
const cardFields = (section: SectionDef) => section.card ?? section.summary

/** An entry's one-line summary: its card's fields, or its first filled field when they're empty, like a paper's link added by hand. */
function summaryOf(section: SectionDef, entry: Entry): string {
  return (
    cardFields(section)
      .map((key) => entry[key]?.trim())
      .filter(Boolean)
      .join(", ") ||
    section.fields.map((field) => entry[field.key]?.trim()).find(Boolean) ||
    ""
  )
}

/**
 * The form for one list section (education, experience, ...): its title and
 * its entries, each a card. One card is open at a time, with its fields; the
 * rest are folded to a line naming them, as "Stanford University" or
 * "Languages · TypeScript, Go". An open card's name is its
 * first field, typed in where it's shown.
 */
function SectionForm({ section, onDelete, onEntryDeleted, restored, onRestored }: SectionFormProps) {
  const { read, update: updateResume } = useOpenResume()
  const saved = useResumeField(section.dataKey)
  const headings = useResumeField("headings")
  const entries = saved ?? []
  const latest = useRef(entries)
  latest.current = entries

  // One entry is open at a time; the rest fold to their name.
  const [openId, setOpenId] = useState<number | null>(entries[0]?.id ?? null)
  // Follows openId a frame later, so a newly added entry slides open too.
  const [shownId, setShownId] = useState<number | null>(openId)
  const [removingId, setRemovingId] = useState<number | null>(null)
  // Whether the section's Delete is armed, asking for a second click.
  const [asking, setAsking] = useState(false)
  const elements = useRef(new Map<number, HTMLElement>())
  const list = useRef<HTMLElement | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLDivElement>(null)
  // Ties each card's name to what the checker says about it, under it.
  const titleNotes = useId()
  const openRef = useRef(openId)
  openRef.current = openId
  // A drop that hasn't lit up yet: which entry moved.
  const moving = useRef<{ id: number; frame?: number } | null>(null)
  const [dnd, setDnd] = useState(loadedDragAndDrop)

  // The first field is the card's name: an open card's name is where it's
  // typed, and the rest of its fields are under it. The name's second part
  // ("TypeScript, Go") is the next field that sums the entry up, if any.
  const titleField = section.fields.find((field) => field.key === cardFields(section)[0])!
  const suffixKey = cardFields(section)[1]
  const fields = section.fields.filter((field) => field !== titleField)

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

  // When the person chooses a finding here, or picks words on the preview,
  // open its entry, then move to its field once the entry has slid open:
  // just once, not each time it's shown.
  const pointer = usePointer()
  useEffect(() => {
    const place = pointer?.place
    if (!pointer || !place || !("section" in place) || place.section !== section.name) return
    if (!pending(pointer.request)) return
    const entry = place.kind === "entry" ? latest.current[place.entry] : undefined
    if (place.kind === "entry" && !entry) return
    const sliding = entry !== undefined && entry.id !== openRef.current && !reducedMotion()
    if (entry) {
      setOpenId(entry.id)
      setShownId(entry.id)
    }
    const timer = setTimeout(
      () => {
        if (!claim(pointer.request)) return
        if (place.kind === "heading") {
          pointAt(heading.current?.querySelector<HTMLElement>('button[aria-label="Rename section"]'), undefined, heading.current)
        } else if (place.kind === "section") {
          pointAt(addButton.current, undefined, heading.current)
        } else if (entry) {
          const card = elements.current.get(entry.id)
          const selector = place.field ? `[data-field="${place.field}"] ${TYPED}` : FIRST_FIELD
          const field = card?.querySelector<HTMLElement>(selector)
          pointAt(field, place.line, field, pointer.words, pointer.look)
        }
      },
      sliding ? SLIDE_MS : 0,
    )
    return () => clearTimeout(timer)
  }, [pointer, pending, claim, section.name])

  // An entry Undo put back opens again, lit up like a moved one, with the
  // cursor in it, or on its Done button on a touch screen, where a field
  // would pop up the keyboard. The timer outlives the effect, which runs again
  // as the editor forgets the entry put back, so it checks the entry is still
  // on the page.
  const restoredDone = useRef(onRestored)
  restoredDone.current = onRestored
  useEffect(() => {
    if (!restored || restored.section !== section.name) return
    const { id } = restored
    restoredDone.current()
    setOpenId(id)
    setShownId(id)
    setTimeout(
      () => {
        const element = elements.current.get(id)
        if (!element?.isConnected) return
        lightUp(elements.current, id)
        reveal(element, scrollerOf(element))
        const first = element.querySelector<HTMLElement>(FIRST_FIELD)
        if (first && window.matchMedia("(pointer: fine)").matches) first.focus({ preventScroll: true })
        else element.querySelector<HTMLElement>("[data-done]")?.focus({ preventScroll: true })
      },
      reducedMotion() ? 0 : SLIDE_MS,
    )
  }, [restored, section.name])

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
      lightUp(elements.current, waiting.id)
    })
  }, [saved])

  const save = (next: Entry[]) => updateResume(section.dataKey, next)

  /**
   * Puts the cursor in an entry's first field, its name, except on touch
   * screens where it would pop up the keyboard, and except when it's already
   * in one of the entry's fields: someone who clicked into a field while the
   * entry slid open keeps typing there.
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
      if (id !== null) reveal(element, scroller)
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
    setOpenId(id)
    if (!show) return
    // Once it has slid open, bring it into view.
    setTimeout(
      () => {
        const element = elements.current.get(id)
        if (element) reveal(element, scrollerOf(element))
        focusFirstField(id)
      },
      reducedMotion() ? 0 : SLIDE_MS,
    )
  }

  const add = () => addEntries([{}])

  // The others keep their ids, so React doesn't give the next entry the
  // deleted one's place in the slide. Focus that was in it goes to Undo
  // (DeletedToast).
  const remove = (id: number) => {
    setRemovingId(null)
    const current = latest.current
    const index = current.findIndex((entry) => entry.id === id)
    if (index < 0) return
    save(current.filter((entry) => entry.id !== id))
    setOpenId((open) => (open === id ? null : open))
    const entry = current[index]
    onEntryDeleted({ section: section.name, entry, index, title: summaryOf(section, entry) || `Entry ${index + 1}` })
  }

  // The entry slides away, then it's deleted. It isn't asked about first: Undo puts it back.
  const slideAway = (id: number) => {
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
    moving.current = { id }
    save(next)
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
  const count = entries.length
  // Under the title: how many entries, and, where they have dates, whether the newest is first, as resumes put them.
  const order = count > 1 ? newestFirst(section.name, entries) : null
  const note =
    count === 0
      ? "No entries yet"
      : `${count} ${count === 1 ? "entry" : "entries"}${order ? " · newest first" : count > 1 ? " · drag to reorder" : ""}`

  const addButtonElement = (
    <button
      ref={addButton}
      type="button"
      onClick={add}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[#d4d7dd] text-[15px] font-medium tracking-[-0.01em] text-accent transition-colors duration-150 hover:border-[#b9bec7] hover:bg-[#f7f8fa] [&_svg]:size-4"
    >
      <Plus aria-hidden="true" />
      {addLabel}
    </button>
  )

  /** An entry, the same with drag and drop or without, so it doesn't move as drag and drop arrives. */
  const renderEntry = (entry: Entry, index: number, drag?: DraggableProvided, dragging = false) => {
    const isOpen = entry.id === openId
    const name = `entry ${index + 1}`
    const leftOut = isLeftOut(entry)
    const named = entry[titleField.key]?.trim() ?? ""
    const second = suffixKey ? (entry[suffixKey]?.trim() ?? "") : ""
    // Folded, a card with no name of its own goes by its next field, or else its first filled one.
    const folded = named || second || summaryOf(section, entry)
    const titleFlag = flagAt(index, titleField.key)
    const titleNote = `${titleNotes}-${entry.id}`

    return (
      <div
        key={entry.id}
        ref={(element) => {
          drag?.innerRef(element)
          if (element) elements.current.set(entry.id, element)
          else elements.current.delete(entry.id)
        }}
        {...drag?.draggableProps}
        // One column as wide as the list (grid-cols-1 is minmax(0, 1fr)). Its own width, an auto
        // column, would grow to fit a long name, and the card would run past the form.
        className={`grid grid-cols-1 pb-3 transition-[grid-template-rows,opacity,padding] duration-300 ease-out motion-reduce:transition-none ${
          entry.id === removingId ? "grid-rows-[0fr] pb-0 opacity-0" : "grid-rows-[1fr]"
        }`}
      >
        {/* Clipped only while it folds away, as clipping it always would cut its shadow off. The
            room round it keeps its ring and focus in view then. */}
        <section className={`-m-1.5 min-h-0 p-1.5 ${entry.id === removingId ? "overflow-hidden" : ""}`} inert={entry.id === removingId}>
          {/* The card is the entry's name alone, open or folded; open, its fields hang under it
              on the sheet. Open, it stands off the sheet; picked up, further. */}
          <div
            data-card
            className={`rounded-[18px] border bg-sheet transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none ${
              dragging
                ? "border-[#e3e5ea] shadow-card-lifted"
                : isOpen
                  ? "border-[#e3e5ea] shadow-card-open"
                  : "border-hairline shadow-card-rest hover:border-[#dcdfe5]"
            }`}
          >
            <div className="flex items-center gap-1 px-2 py-1.5">
              <span
                {...drag?.dragHandleProps}
                aria-label={drag && `Reorder ${name}`}
                className="flex h-9 w-7 shrink-0 items-center justify-center rounded-full text-[#a3a7af] transition-colors hover:text-ink-2 focus-visible:bg-ink/[0.06] focus-visible:text-ink focus-visible:outline-none"
              >
                <GripVertical className="h-4 w-4" aria-hidden="true" />
              </span>

              {isOpen ? (
                // Its name, to type in, as wide as what's typed (the unseen copy under it sets the
                // width), then the field after it. The copy isn't part of the field's name.
                <div className="flex min-w-0 flex-1 items-baseline">
                  <div data-field={titleField.key} className="ml-1.5 grid min-w-0 shrink text-[15px] font-medium tracking-[-0.01em]">
                    {/* 2px wider than its words, for the caret after the last letter. */}
                    <span
                      aria-hidden="true"
                      className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre border-b border-transparent py-0.5 pr-0.5"
                    >
                      {named || titleField.label}
                    </span>
                    <input
                      value={entry[titleField.key] ?? ""}
                      onChange={(event) => update(entry.id, titleField.key, event.target.value)}
                      aria-label={titleField.label}
                      placeholder={titleField.label}
                      size={1}
                      aria-invalid={titleFlag?.level === "fix" || undefined}
                      aria-describedby={titleFlag ? titleNote : undefined}
                      data-flagged={titleFlag ? "" : undefined}
                      // Underlined while pointed at or typed in, as the resume's name in the top bar is. A name
                      // too long for the line ends in "…" until it's typed in.
                      className={`col-start-1 row-start-1 w-full min-w-0 text-ellipsis border-0 border-b border-transparent bg-transparent py-0.5 ${leftOut ? "text-ink-3" : "text-ink"} outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-ink-2/50 hover:border-rule-strong focus:border-accent focus-visible:outline-none data-[flagged]:border-accent`}
                    />
                  </div>
                  {/* Where both don't fit, the second part gives way first, down to a few letters, so it isn't a
                      lone dot; on a phone, the name has the line to itself. */}
                  {second && (
                    <span className="ml-1.5 min-w-[4.5rem] shrink-[4] truncate text-[15px] text-ink-3 max-sm:hidden">· {second}</span>
                  )}
                </div>
              ) : (
                // Folded, a click anywhere on it opens it. From the keyboard, it's its Edit button.
                <div className="min-w-0 flex-1 cursor-pointer py-0.5 pl-1.5" onClick={() => open(entry.id, entry.id)}>
                  <p className="truncate text-[15px] tracking-[-0.01em]">
                    <span className={`font-medium ${leftOut ? "text-ink-3" : "text-ink"}`}>{folded || "Empty entry"}</span>
                    {named && second && <span className="text-ink-3"> · {second}</span>}
                    {leftOut && <span className="text-ink-3"> · Left out</span>}
                  </p>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-0.5">
                <RowToggle
                  label={`Include ${name} in the PDF`}
                  tip={leftOut ? "Put back in the PDF" : "Leave out of the PDF"}
                  checked={!leftOut}
                  onChange={(checked) => setLeftOut(entry.id, !checked)}
                  tipBelow
                >
                  <EyeIcon shut={leftOut} />
                </RowToggle>
                <RowAction label={`Delete ${name}`} tip="Delete" danger onClick={() => slideAway(entry.id)} tipBelow>
                  <TrashIcon />
                </RowAction>
                {/* One button that folds the card and opens it, its chevron turning. */}
                <RowAction
                  {...(isOpen ? { "data-done": "" } : {})}
                  label={isOpen ? `Done editing ${name}` : `Edit ${name}`}
                  tip={isOpen ? "Done" : "Edit"}
                  onClick={() => open(isOpen ? null : entry.id, entry.id)}
                  tipBelow
                  tipAtEnd
                >
                  <ChevronDown
                    className={`h-[18px] w-[18px] transition-transform duration-300 ease-glide motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </RowAction>
              </div>
            </div>
          </div>

          {/* The fields slide open and closed under the card, as far in from its left edge as its right, on a line near its left edge. */}
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
              entry.id === shownId && isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            {/* The container whose width lays out the fields (FIELD_SPAN). It's here rather than
                  around the whole form: Safari before 26 doesn't place a fixed element inside a
                  query container right (WebKit bug 284945), and an entry being dragged is fixed. */}
            {/* Left out of the PDF, its fields are greyed, as its name is, and can still be typed in. */}
            <div
              className={`@container min-h-0 overflow-hidden transition-[opacity,filter] duration-200 motion-reduce:transition-none ${
                leftOut ? "opacity-50 grayscale" : ""
              }`}
              inert={!isOpen}
            >
              <div className="mb-3 ml-[10px] mt-1.5 flex flex-col gap-4 border-l border-[#dcdfe5] pb-2 pl-[13px] pr-6 pt-3">
                {flagAt(index) && <FlagNote finding={flagAt(index)!} />}
                {titleFlag && <FlagNote id={titleNote} finding={titleFlag} />}
                <div className={CARD_GRID}>
                  {fields.map((field) => {
                    const flag = flagAt(index, field.key)
                    return field.type === "bullets" ? (
                      <BulletsField
                        key={field.key}
                        name={field.key}
                        label={field.label}
                        placeholder={field.placeholder}
                        value={entry[field.key] ?? ""}
                        onChange={(value) => update(entry.id, field.key, value)}
                        className={FIELD_SPAN[field.size]}
                        flag={flag}
                      />
                    ) : (
                      <Field
                        key={field.key}
                        name={field.key}
                        label={field.label}
                        placeholder={field.placeholder}
                        hint={field.hint}
                        value={entry[field.key] ?? ""}
                        onChange={(value) => update(entry.id, field.key, value)}
                        className={FIELD_SPAN[field.size]}
                        flag={flag}
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
    <div className="flex flex-col">
      <div ref={heading}>
        <SectionHeading
          title={title}
          note={note}
          onRename={(name) => updateResume("headings", { ...headings, [section.headingKey]: name })}
          flag={here?.kind === "heading" || here?.kind === "section" ? target!.finding : null}
          end={
            <DeleteSection section={section.name} what={deleteWhat(title, count)} asking={asking} onAsk={setAsking} onDelete={onDelete} />
          }
        />
      </div>

      <div inert={asking} className={`flex flex-col ${asked(asking)}`}>
        {section.choice && <SectionChoice choice={section.choice} />}

        <div className="mt-[18px] flex flex-col">
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
                        <dnd.Draggable key={entry.id} draggableId={String(entry.id)} index={index} isDragDisabled={entry.id === removingId}>
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

          {addButtonElement}
          {section.fromPaperLink && (
            <div className="mt-4">
              <PaperFromLink entries={() => latest.current} owner={() => read()?.profileSection?.fullName ?? ""} onAdd={addEntries} />
            </div>
          )}
        </div>
      </div>
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
  const labelId = useId()
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id={labelId} className="text-[14px] text-ink-2">
          {choice.label}
        </span>
        <div role="radiogroup" aria-labelledby={labelId} className="segment-track h-[38px] gap-0.5 p-[3px]">
          {choice.options.map((option) => (
            <label
              key={option.value}
              className={`inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-[14px] font-medium tracking-[-0.01em] transition-colors has-[:focus-visible]:shadow-[0_0_0_3px_rgb(17_19_24/0.14)] ${
                option === selected
                  ? "bg-sheet text-ink shadow-[0_1px_2px_rgb(17_19_24/0.08),0_2px_6px_-1px_rgb(17_19_24/0.1)]"
                  : "text-ink-3 hover:text-ink"
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
      <p className="text-[13px] leading-normal text-ink-3">{selected.hint}</p>
    </div>
  )
}
