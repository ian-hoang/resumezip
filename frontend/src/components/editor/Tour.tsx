"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, X } from "lucide-react"
import { TOUR_SEEN_KEY } from "./tourSeen"

/** A part of the editor that a step of the tour points at, in its picture. */
type Part = "saved" | "tabs" | "form" | "page" | "download"

interface Step {
  label: string
  title: string
  body: string
  /** What the main button says, which is where it goes next. */
  next: string
  /** The parts the picture lights up. */
  parts: readonly Part[]
}

const STEPS: Step[] = [
  {
    label: "Welcome",
    title: "It saves as you type, in this browser.",
    body: "There's no account. Your resume is saved in this browser, on this computer, and resumezip keeps no copy.",
    next: "Next: the preview",
    parts: ["form", "saved"],
  },
  {
    label: "The preview",
    title: "The page is the real PDF.",
    body: "It's built in your browser as you type, and what you just changed lights up for a moment.",
    next: "Next: Write, Check, Style",
    parts: ["page"],
  },
  {
    label: "Write, Check, Style",
    title: "Write, check, then style.",
    body: "Write lists the sections: drag one to move it on the page. Check gives a score and what to fix, like a missing date or a typo. Style picks the template and fine-tunes it.",
    next: "Next: your save file",
    parts: ["tabs"],
  },
  {
    label: "Your save file",
    title: "The PDF is your save file.",
    body: "Every PDF you download carries your resume. Open it here again, on any computer, to keep editing.",
    next: "Start writing",
    parts: ["download"],
  },
]

/**
 * Whether the tour hasn't been seen in this browser. Not when storage can't
 * be read: it couldn't be remembered either, and would show on every visit.
 */
function firstVisit(): boolean {
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === null
  } catch {
    return false
  }
}

function rememberSeen() {
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, "seen")
  } catch {
    // Then it shows again next visit; nothing else depends on it.
  }
}

/** A short tour of the editor, in four steps, on the first visit. */
export default function Tour() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!firstVisit()) return
    // Remembered as it opens rather than as it closes: the dialog's close
    // event can come late while the editor is busy drawing the preview, and a
    // reload or a step away before it would show the tour again.
    rememberSeen()
    setShown(true)
  }, [])
  return shown ? <TourDialog onClosed={() => setShown(false)} /> : null
}

/**
 * The tour's dialog: a modal <dialog>, so the page behind is out of reach,
 * from the keyboard and to screen readers too, until it's closed. The
 * browser closes it on Escape and puts the focus back where it was. However
 * it's closed, it isn't shown again.
 */
function TourDialog({ onClosed }: { onClosed: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [step, setStep] = useState(0)
  const titleId = useId()
  const bodyId = useId()
  // The latest one, so the effect below is about opening the dialog, not each render.
  const closed = useRef(onClosed)
  closed.current = onClosed
  const { label, title, body, next, parts } = STEPS[step]
  const last = step === STEPS.length - 1

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // The browser starts on the first button, Close; the way on is more use.
    nextRef.current?.focus()
    const onClose = () => {
      // The close event comes a moment after closing. One that finds the
      // dialog open again is from a close this effect's cleanup made, and it
      // opened again since (as React's development mode does on purpose).
      if (dialog.open) return
      closed.current()
    }
    dialog.addEventListener("close", onClose)
    return () => {
      dialog.removeEventListener("close", onClose)
      if (dialog.open) dialog.close()
    }
  }, [])

  const close = () => dialogRef.current?.close()
  const forward = () => (last ? close() : setStep(step + 1))

  const arrow =
    "inline-flex h-9 w-9 items-center justify-center rounded-full bg-sheet/70 text-ink ring-1 ring-ink/15 transition-shadow hover:ring-ink/40 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:ring-ink/15"

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // A click on the page around it, which lands on the dialog itself, closes it.
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      className="m-auto w-[min(640px,calc(100vw-32px))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-ink/20 backdrop:backdrop-blur-[3px]"
    >
      {/* It fades and grows into place (`starting:` is CSS @starting-style). */}
      <div className="glass glass-frost overflow-hidden rounded-panel text-ink transition-[opacity,scale] duration-300 ease-glide motion-reduce:transition-none starting:scale-[0.98] starting:opacity-0">
        <div className="relative h-[184px] overflow-hidden border-b border-ink/[0.06] sm:h-[248px]">
          <Miniature parts={parts} />
        </div>

        <div className="relative px-6 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
          {/* Beside the step's label rather than over the picture, where it would cover its top bar. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close the tour"
            className={`${arrow} absolute right-4 top-3.5 sm:right-6 sm:top-4`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          {/* Said again as each step comes in. */}
          <div aria-live="polite">
            <p className="label-mono pr-12 text-ink-2">
              {label} · {step + 1} of {STEPS.length}
            </p>
            <h2 id={titleId} className="mt-3 font-serif text-[27px] leading-[1.15] tracking-[-0.01em] sm:text-[32px]">
              {title}
            </h2>
            <p id={bodyId} className="mt-3 max-w-[540px] text-[15px] leading-relaxed text-ink-2">
              {body}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              ref={nextRef}
              type="button"
              onClick={forward}
              className="inline-flex h-11 items-center rounded-full bg-ink px-[18px] text-[15px] font-medium text-white transition-colors hover:bg-black"
            >
              {next}
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous step"
                aria-disabled={step === 0 || undefined}
                onClick={() => step > 0 && setStep(step - 1)}
                className={arrow}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span aria-hidden="true" className="flex items-center gap-1.5">
                {STEPS.map((shown, index) => (
                  <span
                    key={shown.label}
                    className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-glide motion-reduce:transition-none ${
                      index === step ? "w-6 bg-ink" : "w-1.5 bg-ink/20"
                    }`}
                  />
                ))}
              </span>
              <button
                type="button"
                aria-label="Next step"
                aria-disabled={last || undefined}
                onClick={() => !last && setStep(step + 1)}
                className={arrow}
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}

// The miniature's panels have the panel radius, scaled down with the picture.
const MINI_PANEL = "rounded-[calc(var(--radius-panel)*0.4)] bg-white/75 shadow-[0_6px_14px_-8px_rgb(24_44_110/0.45)]"

/**
 * The editor in miniature, drawn from its own layout: on wide screens the top
 * bar over the three panels, narrower the parts stacked, with the Edit /
 * Preview switch. The step's parts are ringed in blue and the rest fade back.
 */
function Miniature({ parts }: { parts: readonly Part[] }) {
  const lit = (part: Part) => parts.includes(part)
  // How a part looks, lit or not. Each glides from one to the other.
  const shown = (part: Part) =>
    `transition-[opacity,box-shadow] duration-500 ease-glide motion-reduce:transition-none ${
      lit(part) ? "opacity-100 ring-2 ring-accent" : "opacity-45"
    }`
  const line = (width: string, tone = "bg-ink/15") => <span className={`block h-[3px] rounded-full ${tone}`} style={{ width }} />
  const field = (width: string) => (
    <span className="flex flex-col gap-[5px]">
      {line(width, "bg-ink/20")}
      <span className="block h-px w-full bg-ink/15" />
    </span>
  )
  const name = <span className="block h-[5px] w-14 rounded-full bg-ink/60 sm:w-20" />
  const download = <span className={`block h-4 w-12 shrink-0 rounded-full bg-ink sm:h-5 sm:w-16 ${shown("download")}`} />
  const tabs = (
    <span className="flex h-3 gap-0.5 rounded-full bg-ink/[0.07] p-0.5 sm:h-4">
      <span className="flex-1 rounded-full bg-white shadow-[0_1px_2px_rgb(17_19_24/0.15)]" />
      <span className="flex-1" />
      <span className="flex-1" />
    </span>
  )

  return (
    <div aria-hidden="true" className="desk absolute inset-0 bg-scroll">
      {/* Wide screens: the top bar over three panels. */}
      <div className="absolute inset-0 hidden flex-col gap-2.5 p-4 sm:p-5 xl:flex">
        <div className={`flex h-8 shrink-0 items-center gap-3 px-3.5 ${MINI_PANEL}`}>
          {line("28px", "bg-ink/25")}
          {name}
          <span className="flex-1" />
          <span className={`block h-[3px] w-14 rounded-full bg-ink/30 ${shown("saved")}`} />
          {download}
        </div>
        <div className="flex min-h-0 flex-1 gap-2.5">
          <div className={`flex w-[22%] flex-col gap-2.5 p-2.5 ${MINI_PANEL} ${shown("tabs")}`}>
            {tabs}
            <span className="mt-1 block h-3.5 rounded-full bg-white shadow-[0_1px_2px_rgb(17_19_24/0.12)]" />
            {["70%", "55%", "64%", "48%", "60%"].map((width) => (
              <span key={width} className="px-2">
                {line(width, "bg-ink/20")}
              </span>
            ))}
          </div>
          <div className={`flex w-[38%] flex-col gap-3.5 px-4 py-3.5 ${MINI_PANEL} ${shown("form")}`}>
            <span className="block h-2 w-[45%] rounded-full bg-ink/60" />
            {field("30%")}
            {field("22%")}
            <span className="flex gap-3">
              <span className="flex-1">{field("50%")}</span>
              <span className="flex-1">{field("40%")}</span>
            </span>
            <span className="block min-h-0 flex-1 rounded-[calc(var(--radius-panel)*0.3)] border border-ink/15 bg-white" />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <Page lit={lit("page")} shown={shown("page")} />
          </div>
        </div>
      </div>

      {/* Narrower: the top bar, the tabs, the form, and the Edit / Preview switch. */}
      <div className="absolute inset-0 flex flex-col gap-2 px-4 pt-4 sm:px-8 sm:pt-5 xl:hidden">
        <div className={`flex h-8 shrink-0 items-center gap-3 px-3 ${MINI_PANEL}`}>
          {line("28px", "bg-ink/25")}
          {name}
          <span className="flex-1" />
          <span className="block h-4 w-10 rounded-full ring-1 ring-ink/20 sm:h-5 sm:w-16" />
          {download}
        </div>
        <div className={`flex shrink-0 flex-col gap-1.5 p-1.5 ${MINI_PANEL} ${shown("tabs")}`}>
          <span className="w-1/2">{tabs}</span>
          <span className="flex gap-1.5">
            {["14%", "18%", "20%", "14%"].map((width, index) => (
              <span
                key={width + index}
                className={`block h-2.5 rounded-full ${index === 0 ? "bg-white shadow-[0_1px_2px_rgb(17_19_24/0.12)]" : "bg-ink/10"}`}
                style={{ width }}
              />
            ))}
          </span>
        </div>
        <div
          className={`mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-3 rounded-b-none px-4 pt-3.5 ${MINI_PANEL} ${shown("form")}`}
        >
          <span className="block h-2 w-[40%] rounded-full bg-ink/60" />
          {field("30%")}
          {field("22%")}
        </div>
        {/* The switch: for the page, which is behind it, Preview is chosen and ringed. */}
        <span className="absolute bottom-2.5 left-1/2 flex h-5 w-24 -translate-x-1/2 gap-0.5 rounded-full bg-ink p-0.5 shadow-[0_6px_14px_-6px_rgb(17_19_24/0.6)] sm:bottom-4 sm:h-7 sm:w-32">
          <span
            className={`flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none ${lit("page") ? "" : "bg-white"}`}
          />
          <span
            className={`flex-1 rounded-full transition-[background-color,box-shadow] duration-500 motion-reduce:transition-none ${
              lit("page") ? "bg-white ring-2 ring-accent" : ""
            }`}
          />
        </span>
      </div>
    </div>
  )
}

/** The page in the miniature: paper, so square, with a line lit as one is when it's just been typed. */
function Page({ lit, shown }: { lit: boolean; shown: string }) {
  return (
    <span
      className={`flex aspect-[8.5/11] h-[94%] flex-col gap-[6%] bg-white px-[9%] py-[10%] shadow-[0_10px_24px_-12px_rgb(24_44_110/0.5)] ${shown}`}
    >
      <span className="mx-auto block h-[4%] w-1/2 bg-ink/60" />
      {["100%", "86%", "94%", "70%", "90%", "80%", "60%"].map((width, index) => (
        <span
          key={width + index}
          className={`block h-[2.5%] transition-colors duration-500 motion-reduce:transition-none ${lit && index === 2 ? "bg-accent" : "bg-ink/20"}`}
          style={{ width }}
        />
      ))}
    </span>
  )
}
