// The dashboard's icon buttons, and the editor's on each entry. Each icon is
// drawn in parts that move when it's pointed at (see "Row actions" in
// app/globals.css): the copy lifts off, the arrow bobs into the tray, the
// bin's lid tips open, the pencil writes, the eye blinks, the tick draws.

import type { ReactNode } from "react"

interface TipProps {
  /** What the tip says, when it's shorter than the label, as "Delete" for "Delete entry 2". */
  tip?: string
  /** The tip lines up with the button's right edge, so it stays inside the row. */
  tipAtEnd?: boolean
  /** The tip shows under the button, where something above would cut it off. */
  tipBelow?: boolean
}

interface RowActionProps extends TipProps {
  label: string
  onClick: () => void
  children: ReactNode
  /** Red when pointed at, as it deletes. */
  danger?: boolean
  disabled?: boolean
  busy?: boolean
  className?: string
  [data: `data-${string}`]: string
}

const ROUND =
  "row-action group/action relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-[color,background-color] duration-200 hover:bg-ink/[0.06] motion-reduce:transition-none"

/** The label, in a tip that shows a moment after the button is pointed at, or at once when it has the keyboard. */
function Tip({ children, tipAtEnd, tipBelow }: { children: ReactNode } & TipProps) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-[3px] bg-ink px-2 py-1 font-mono text-[11px] leading-none text-paper opacity-0 transition duration-150 motion-reduce:transition-none group-hover/action:translate-y-0 group-hover/action:opacity-100 group-hover/action:delay-300 group-focus-visible/action:translate-y-0 group-focus-visible/action:opacity-100 group-has-[:focus-visible]/action:translate-y-0 group-has-[:focus-visible]/action:opacity-100 ${
        tipBelow ? "top-full mt-1 -translate-y-1" : "bottom-full mb-1 translate-y-1"
      } ${tipAtEnd ? "right-0" : "left-1/2 -translate-x-1/2"}`}
    >
      {children}
    </span>
  )
}

export function RowAction({
  label,
  tip,
  onClick,
  children,
  danger,
  disabled,
  busy,
  tipAtEnd,
  tipBelow,
  className = "",
  ...data
}: RowActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={busy || undefined}
      onClick={onClick}
      disabled={disabled}
      {...data}
      className={`${ROUND} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-wait ${
        danger ? "hover:text-alert" : "hover:text-ink"
      } ${className}`}
    >
      {children}
      <Tip tipAtEnd={tipAtEnd} tipBelow={tipBelow}>
        {tip ?? label}
      </Tip>
    </button>
  )
}

interface RowToggleProps extends TipProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}

/**
 * A box to tick, drawn as an icon in a round button like RowAction's. The box
 * itself covers the button, unseen, so it's what's clicked, and what a screen
 * reader finds, by its label.
 */
export function RowToggle({ label, tip, checked, onChange, children, tipAtEnd, tipBelow }: RowToggleProps) {
  return (
    <span className={`${ROUND} hover:text-ink`}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />
      {children}
      <Tip tipAtEnd={tipAtEnd} tipBelow={tipBelow}>
        {tip ?? label}
      </Tip>
    </span>
  )
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const

/** Two sheets; the front one lifts off the back one. `copied` plays it once more, as a copy is made. */
export function CopyIcon({ copied }: { copied?: boolean }) {
  return (
    <svg {...iconProps} className={copied ? "is-copied" : undefined}>
      <path className="copy-back" d="M15 17.5v1A2.5 2.5 0 0 1 12.5 21h-6A2.5 2.5 0 0 1 4 18.5v-8A2.5 2.5 0 0 1 6.5 8h1" />
      <rect className="copy-front" x="9.5" y="3" width="10.5" height="12.5" rx="2.5" />
    </svg>
  )
}

/** An arrow into a tray: it drops in over and over while downloading, and becomes a tick once done. */
export function DownloadIcon({ state }: { state: "idle" | "busy" | "done" }) {
  if (state === "done")
    return (
      <svg {...iconProps}>
        <path className="tick" pathLength={1} d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    )
  return (
    <svg {...iconProps}>
      <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15" />
      <g className={state === "busy" ? "download-arrow is-busy" : "download-arrow"}>
        <path d="M12 4v10.5" />
        <path d="m7.5 10 4.5 4.5 4.5-4.5" />
      </g>
    </svg>
  )
}

/** A bin whose lid tips open. */
export function TrashIcon() {
  return (
    <svg {...iconProps}>
      <g className="trash-lid">
        <path d="M4 7h16" />
        <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      </g>
      <path d="m6 7 .85 11.2A2 2 0 0 0 8.84 20h6.32a2 2 0 0 0 1.99-1.8L18 7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}

/** An eye, open while what it's on is in the PDF; a line is drawn through it once it's left out. It blinks. */
export function EyeIcon({ shut }: { shut: boolean }) {
  return (
    <svg {...iconProps} className={`pointer-events-none ${shut ? "is-shut" : ""}`}>
      <g className="eye">
        <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.75" />
      </g>
      <path className="eye-slash" pathLength={1} d="m4 4 16 16" />
    </svg>
  )
}

/** A tick, which draws itself again when pointed at. */
export function DoneIcon() {
  return (
    <svg {...iconProps}>
      <path className="done-tick" pathLength={1} d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

/** A pencil that writes. */
export function PencilIcon() {
  return (
    <svg {...iconProps} width={17} height={17}>
      <g className="pencil">
        <path d="M15.5 4.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
        <path d="m13.5 6.5 3 3" />
      </g>
    </svg>
  )
}
