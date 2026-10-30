"use client"

import type React from "react"
import { useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { readDate } from "@/lib/check/readDate"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
// A page of years: twelve, in three rows of four, as the months are.
const PAGE = 12

/** What a date field holds, read as a year and a month to start the picker on; nothing when it isn't a date. */
function shownIn(value: string): { year?: number; month?: number; present?: boolean } {
  const date = readDate(value)
  if (!date) return {}
  if (date.present) return { present: true }
  return { year: date.year, month: date.month }
}

/** Where a picker goes, fixed to the window: a little wider than its field, just over its date (`bottom`) or under it (`top`). */
export interface PickerPlace {
  left: number
  width: number
  top?: number
  bottom?: number
}

interface DatePickerProps {
  value: string
  /** An end date can also be "Present". */
  end?: boolean
  place: PickerPlace
  /** Writes what's picked into the field, as typed dates are: "Jun 2025", "2025", "Present", or nothing. */
  onPick: (value: string) => void
  id: string
  labelledBy: string
}

/**
 * Picks a date for a date field, which can still be typed into: a year
 * first, then its month. A year can stand on its own (Skip month), the field
 * can be left empty (Skip date), and an end date can be Present. It opens on
 * what's typed when that reads as a date, and writes dates as the editor's
 * placeholders show them. It's centred on its field, in a layer of its own
 * fixed to the window, so the form's entries and their headers don't cover it.
 */
export default function DatePicker({ value, end = false, place, onPick, id, labelledBy }: DatePickerProps) {
  const typed = shownIn(value)
  const thisYear = new Date().getFullYear()
  // The page with the typed year, or else the one ending a few years ahead, for an expected graduation.
  const pageOf = (year: number) => year - ((((year - (thisYear + 3 - PAGE + 1)) % PAGE) + PAGE) % PAGE)
  const [first, setFirst] = useState(() => pageOf(typed.year ?? thisYear))
  const [year, setYear] = useState<number | null>(null)

  const cell =
    "h-7 rounded-[8px] px-1 text-[13px] tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
  const cellLook = (chosen: boolean, now: boolean) =>
    chosen ? "bg-ink font-medium text-white" : `text-ink hover:bg-fill ${now ? "ring-1 ring-inset ring-rule-strong" : ""}`
  const action = "h-7 flex-1 rounded-full text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-fill hover:text-ink"
  const arrow =
    "inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-fill hover:text-ink [&_svg]:size-4"
  // Where you are over the grid, the ways out under it, each across the picker's width.
  const top = (left: React.ReactNode, middle: React.ReactNode, right: React.ReactNode) => (
    <div className="mb-1 flex items-center justify-between">
      {left}
      {middle}
      {right}
    </div>
  )
  const foot = (actions: React.ReactNode) => <div className="mt-1 flex gap-0.5 border-t border-hairline pt-1">{actions}</div>

  return createPortal(
    <div
      id={id}
      role="dialog"
      aria-labelledby={labelledBy}
      style={place}
      className="fixed z-50 rounded-[14px] border border-hairline bg-sheet p-1.5 shadow-[0_1px_2px_rgb(17_19_24/0.06),0_14px_32px_-14px_rgb(17_19_24/0.35)]"
    >
      {year === null ? (
        <>
          {top(
            <button type="button" aria-label="Earlier years" onClick={() => setFirst(first - PAGE)} className={arrow}>
              <ChevronLeft aria-hidden="true" />
            </button>,
            <span className="label-mono text-ink-2">
              {first} – {first + PAGE - 1}
            </span>,
            <button type="button" aria-label="Later years" onClick={() => setFirst(first + PAGE)} className={arrow}>
              <ChevronRight aria-hidden="true" />
            </button>,
          )}
          <div className="grid grid-cols-4 gap-0.5">
            {Array.from({ length: PAGE }, (_, index) => first + index).map((shown) => (
              <button
                key={shown}
                type="button"
                aria-pressed={shown === typed.year}
                onClick={() => setYear(shown)}
                className={`${cell} ${cellLook(shown === typed.year, shown === thisYear)}`}
              >
                {shown}
              </button>
            ))}
          </div>
          {foot(
            <>
              {end && (
                <button type="button" onClick={() => onPick("Present")} className={action}>
                  Present
                </button>
              )}
              <button type="button" onClick={() => onPick("")} className={action}>
                Skip date
              </button>
            </>,
          )}
        </>
      ) : (
        <>
          {top(
            <button type="button" aria-label="Back to the years" onClick={() => setYear(null)} className={arrow}>
              <ChevronLeft aria-hidden="true" />
            </button>,
            <span className="label-mono !text-ink">{year}</span>,
            <span className="w-7" />,
          )}
          <div className="grid grid-cols-4 gap-0.5">
            {MONTHS.map((name, index) => {
              const chosen = typed.year === year && typed.month === index + 1
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => onPick(`${name} ${year}`)}
                  className={`${cell} ${cellLook(chosen, false)}`}
                >
                  {name}
                </button>
              )
            })}
          </div>
          {foot(
            <button type="button" onClick={() => onPick(String(year))} className={action}>
              Skip month
            </button>,
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
