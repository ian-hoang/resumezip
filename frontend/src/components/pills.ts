// The site's buttons, on every page: the main action is an ink pill, and
// everything else an outline pill, on the desk or a dialog's glass.

const SHAPE =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[18px] text-[15px] font-medium tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50"
const PILL = `${SHAPE} transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none`

/** The main action: it lifts under the pointer and sinks as it's pressed (ink-button, lift-button in globals.css). */
export const INK_PILL = `${SHAPE} ink-button lift-button`

export const OUTLINE_PILL = `${PILL} bg-sheet/70 text-ink ring-1 ring-inset ring-ink/15 hover:bg-sheet hover:ring-ink/40`

/** For a choice that deletes something for good. */
export const DANGER_PILL = `${PILL} bg-alert text-white hover:bg-[#912018]`

/** A smaller outline pill, for a toolbar and the controls inside a dialog. */
export const SMALL_PILL =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-sheet/70 px-3.5 text-sm text-ink ring-1 ring-inset ring-ink/15 transition-[background-color,box-shadow] duration-200 hover:bg-sheet hover:ring-ink/40 motion-reduce:transition-none"
