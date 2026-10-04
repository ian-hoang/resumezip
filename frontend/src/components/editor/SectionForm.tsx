"use client"

import { useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { useResumeContext } from "@/context/ResumeContext"
import { BulletsField, Field, SectionHeading } from "./fields"
import { FIELD_SPAN, type SectionDef } from "./sections"

type Entry = { id: number; [field: string]: any }

interface SectionFormProps {
  section: SectionDef
  /** e.g. "03 / 08" */
  position: string
}

// How long an entry takes to slide open, closed or away (matches duration-300).
const SLIDE_MS = 300

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** The element that scrolls the editor: its pane on wide screens, the page on small ones. */
function scrollerOf(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node
  }
  return document.scrollingElement as HTMLElement
}

/** Scrolls just enough to show the top of an opened entry: its heading and first fields. */
function reveal(element: HTMLElement, scroller: HTMLElement, reduced: boolean) {
  const box = element.getBoundingClientRect()
  const view = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect()
  const below = box.top + Math.min(box.height, 260) - view.bottom
  const above = view.top - box.top
  const by = above > 0 ? -above - 16 : below > 0 ? below + 16 : 0
  if (by) scroller.scrollBy({ top: by, behavior: reduced ? "auto" : "smooth" })
}

/** The form for one list section (education, experience, ...): its title and entries. */
export default function SectionForm({ section, position }: SectionFormProps) {
  const { formData, updateFormData } = useResumeContext()
  const entries: Entry[] = Array.isArray(formData[section.dataKey]) ? formData[section.dataKey] : []

  // One entry is open at a time; the rest collapse to a one-line summary.
  const [openId, setOpenId] = useState<number | null>(entries[0]?.id ?? null)
  // Follows openId a frame later, so a newly added entry slides open too.
  const [shownId, setShownId] = useState<number | null>(openId)
  const elements = useRef(new Map<number, HTMLElement>())

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShownId(openId))
    return () => cancelAnimationFrame(frame)
  }, [openId])

  const save = (next: Entry[]) => updateFormData(section.dataKey, next)

  /** Puts the cursor in an entry's first field, except on touch screens where it would pop up the keyboard. */
  const focusFirstField = (id: number) => {
    if (!window.matchMedia("(pointer: fine)").matches) return
    elements.current.get(id)?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true })
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
      if (id !== null) reveal(element, scroller, reduced)
    }
    requestAnimationFrame(hold)
    if (id !== null) requestAnimationFrame(() => focusFirstField(id))
  }

  const add = () => {
    const id = entries.length > 0 ? Math.max(...entries.map((entry) => entry.id)) + 1 : 1
    const blank = Object.fromEntries(section.fields.map((field) => [field.key, ""]))
    save([...entries, { ...blank, id } as Entry])
    setOpenId(id)
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

  // Ids are renumbered so they stay 1..n, as the stored data always has been.
  const remove = (id: number) => save(entries.filter((entry) => entry.id !== id).map((entry, i) => ({ ...entry, id: i + 1 })))

  const update = (id: number, key: string, value: string) =>
    save(entries.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)))

  const title = formData.headings?.[section.headingKey] || section.title

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        position={position}
        title={title}
        onRename={(name) => updateFormData("headings", { ...formData.headings, [section.headingKey]: name })}
      />

      {entries.length === 0 && (
        <p className="border-t border-ink pt-5 text-[15px] text-ink-2">Nothing here yet.</p>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col">
          {entries.map((entry, index) => {
            const isOpen = entry.id === openId
            const summary = section.summary.map((key) => entry[key]?.trim()).filter(Boolean).join(", ")
            const name = `entry ${index + 1}`

            return (
              <div
                key={entry.id}
                ref={(element) => {
                  if (element) elements.current.set(entry.id, element)
                  else elements.current.delete(entry.id)
                }}
              >
                <section>
                  <div
                    className={`border-t pb-7 pt-4 transition-colors duration-300 ${isOpen ? "border-ink" : "border-rule"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="label-mono text-ink-2">Entry {index + 1}</span>
                        {!isOpen && (
                          <span className={`truncate text-[15px] ${summary ? "text-ink" : "text-ink-2"}`}>
                            {summary || "Empty entry"}
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4">
                        {!isOpen ? (
                          <button
                            key="edit"
                            type="button"
                            onClick={() => open(entry.id, entry.id)}
                            aria-label={`Edit ${name}`}
                            className="py-2 text-sm text-ink underline underline-offset-4"
                          >
                            Edit
                          </button>
                        ) : (
                          <>
                            <button
                              key="remove"
                              type="button"
                              onClick={() => remove(entry.id)}
                              aria-label={`Remove ${name}`}
                              className="py-2 text-sm text-ink-2 transition-colors hover:text-[#b42318]"
                            >
                              Remove
                            </button>
                            <button
                              key="done"
                              type="button"
                              onClick={() => open(null, entry.id)}
                              aria-label={`Done editing ${name}`}
                              className="py-2 text-sm text-ink underline underline-offset-4"
                            >
                              Done
                            </button>
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
                      <div className="-mx-1 min-h-0 overflow-hidden px-1" inert={!isOpen}>
                        <div className="grid grid-cols-2 gap-x-7 gap-y-6 pb-1 pt-5 sm:grid-cols-4">
                          {section.fields.map((field) => {
                            const Input = field.type === "bullets" ? BulletsField : Field
                            return (
                              <Input
                                key={field.key}
                                label={field.label}
                                placeholder={field.placeholder}
                                value={entry[field.key] ?? ""}
                                onChange={(value) => update(entry.id, field.key, value)}
                                className={FIELD_SPAN[field.size]}
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
          })}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex h-10 items-center gap-2 self-start rounded-[4px] border border-rule-strong px-3.5 text-sm text-ink transition-colors hover:border-ink"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {section.addLabel}
      </button>
    </div>
  )
}
