"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, X } from "lucide-react"
import Logo from "@/components/site/Logo"
import { TOUR_SEEN_KEY } from "./tourSeen"

interface Step {
  label: string
  title: string
  body: string
  /** What the main button says, which is where it goes next. */
  next: string
  /** The part of the picture that shows, as CSS object-position: each step pans to its own. */
  art: string
}

const STEPS: Step[] = [
  {
    label: "Welcome",
    title: "It saves as you type, in this browser.",
    body: "There's no account. Your resume is saved in this browser, on this computer, and resumezip keeps no copy.",
    next: "Next: the preview",
    art: "52% 64%",
  },
  {
    label: "The preview",
    title: "The page is the real PDF.",
    body: "It's built in your browser as you type, and what you just changed lights up for a moment.",
    next: "Next: Check",
    art: "96% 14%",
  },
  {
    label: "Check",
    title: "Check looks it over.",
    body: "Switch to Check for a score and a list of what to fix, like a missing date or a typo. Choose one to go to its field.",
    next: "Next: your save file",
    art: "4% 92%",
  },
  {
    label: "Your save file",
    title: "The PDF is your save file.",
    body: "Every PDF you download carries your resume. Open it here again, on any computer, to keep editing.",
    next: "Start writing",
    art: "66% 78%",
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
    if (firstVisit()) setShown(true)
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
  const { label, title, body, next } = STEPS[step]
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
      rememberSeen()
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
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:border-white hover:bg-white/10 aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:border-white/25 aria-disabled:hover:bg-transparent"

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // A click on the dimmed page around it, which lands on the dialog itself, closes it.
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      className="m-auto w-[min(760px,calc(100vw-32px))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-ink/45"
    >
      {/* It fades and grows into place (`starting:` is CSS @starting-style). */}
      <div className="overflow-hidden rounded-[18px] bg-ink text-white shadow-[0_40px_80px_-30px_rgba(17,19,24,0.6)] transition-[opacity,scale] duration-300 ease-glide motion-reduce:transition-none starting:scale-[0.98] starting:opacity-0">
        <div className="relative h-[190px] overflow-hidden bg-accent sm:h-[300px]">
          {/* Shown pixel for pixel, so the dithering stays crisp: resized, its dots would blur to grey. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/printer-dither.png"
            alt=""
            width={1280}
            height={720}
            style={{ objectPosition: STEPS[step].art }}
            className="absolute inset-0 h-full w-full object-none transition-[object-position] duration-700 ease-glide [image-rendering:pixelated] motion-reduce:transition-none"
          />
          <div
            aria-hidden="true"
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 motion-reduce:transition-none ${
              step === 0 ? "" : "opacity-0"
            }`}
          >
            <span className="flex items-center gap-3 bg-paper px-6 py-3.5 font-logo text-[28px] font-medium tracking-[-0.02em] text-ink sm:text-[34px]">
              <Logo className="h-6 w-auto sm:h-7" />
              resumezip
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close the tour"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white transition-colors hover:bg-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
          {/* Said again as each step comes in. */}
          <div aria-live="polite">
            <p className="label-mono text-white/65">
              {label} · {step + 1} of {STEPS.length}
            </p>
            <h2 id={titleId} className="mt-3 font-serif text-[27px] leading-[1.15] tracking-[-0.01em] sm:text-[34px]">
              {title}
            </h2>
            <p id={bodyId} className="mt-3 max-w-[580px] text-[15px] leading-relaxed text-white/80">
              {body}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              ref={nextRef}
              type="button"
              onClick={forward}
              className="inline-flex h-11 items-center bg-paper px-5 text-sm font-medium text-ink transition-colors hover:bg-white"
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
                      index === step ? "w-6 bg-white" : "w-1.5 bg-white/35"
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
