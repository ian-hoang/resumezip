// The dashboard's buttons, in the site's two looks: the main action is an ink
// pill, and everything else an outline pill on the desk or a dialog's glass.

const PILL =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-[18px] text-[15px] font-medium transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"

export const INK_PILL = `${PILL} bg-ink text-white hover:bg-black`

export const OUTLINE_PILL = `${PILL} bg-sheet/70 text-ink ring-1 ring-ink/15 hover:bg-sheet hover:ring-ink/40`

/** For a choice that deletes something for good. */
export const DANGER_PILL = `${PILL} bg-alert text-white hover:bg-[#912018]`

/** A smaller outline pill, for the toolbar and the controls inside a dialog. */
export const SMALL_PILL =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-sheet/70 px-3.5 text-sm text-ink ring-1 ring-ink/15 transition-[background-color,box-shadow] duration-200 hover:bg-sheet hover:ring-ink/40 motion-reduce:transition-none"
