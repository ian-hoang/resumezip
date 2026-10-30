// The site's buttons. On the pages about resumezip the main action is an ink
// pill (on the home page's sky, ink glass, beside white glass for the rest);
// the dashboard, the editor, the templates and their dialogs, on a white
// sheet, have their own (sheetPill, below).

const SHAPE =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[18px] text-[15px] font-medium tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50"

/** The main action: it lifts under the pointer and sinks as it's pressed (ink-button, lift-button in globals.css). */
export const INK_PILL = `${SHAPE} ink-button lift-button`

/** A main action on glass: ink glass, with a glossy lit top (ink-glass in globals.css). */
export const INK_GLASS_PILL = `${SHAPE} ink-glass`

/** Any other action on the sky: white glass, solid (glass-solid in styles/glass.css). */
export const GLASS_PILL = `${SHAPE} glass glass-solid text-ink transition-[filter] hover:brightness-[0.97]`

// On the white sheet the dashboard, the editor, the templates pages and their
// dialogs are on (styles/sheet.css). Each look comes without a size, which sheetPill adds,
// so one button's size never has to beat another's: Tailwind puts utilities
// that set the same thing in order of their value, not the order they're
// written in, so `px-4` after `px-5` would lose.
const SHEET_LOOKS = {
  /** The main action: a blue pill in a halo of its own blue (blue-button). */
  blue: "blue-button disabled:opacity-50",
  /** Any other button standing on the sheet: a white pill (white-button). */
  white: "white-button disabled:opacity-50",
  /** A button that's only its words, as Cancel beside Create: grey, shaded under the pointer. */
  text: "text-ink-2 transition-colors duration-150 hover:bg-fill hover:text-ink disabled:opacity-50 disabled:hover:bg-transparent",
  /** For a choice that deletes something. */
  danger: "bg-alert text-white transition-colors duration-150 hover:bg-[#912018]",
}

/** A button on the sheet in one of its looks, at a size: unless `size` says otherwise, 40px tall with 15px words. */
export function sheetPill(look: keyof typeof SHEET_LOOKS, size = "h-10 px-5 text-[15px] font-medium") {
  return `inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full tracking-[-0.01em] disabled:cursor-not-allowed [&_svg]:size-4 ${size} ${SHEET_LOOKS[look]}`
}

export const BLUE_PILL = sheetPill("blue")
export const WHITE_PILL = sheetPill("white")
export const TEXT_PILL = sheetPill("text")

/**
 * A grey track of choices on the sheet, 46px tall, with the chosen one on a
 * white pill (useThumb) 5px in from its edge: SEGMENT is each choice, with
 * its own padding across.
 */
export const SEGMENTS = "segment-track h-[46px] max-w-full gap-0.5 p-[5px]"
/** SEGMENTS in the dashboard's and templates page's glass bar, which hides the track, so it's only as tall as the search beside it. */
export const BAR_SEGMENTS = "segment-track h-10 max-w-full gap-0.5 p-0.5"
export const SEGMENT =
  "relative inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-[15px] font-medium tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none [&_svg]:size-4"
/** SEGMENTS in the editor's top bar, which is kept lean: 40px tall, 4px round its white pill. */
export const SLIM_SEGMENTS = "segment-track h-10 max-w-full gap-0.5 p-1"
/** A choice in SLIM_SEGMENTS: SEGMENT at 32px, with 14px words. */
export const SLIM_SEGMENT =
  "relative inline-flex h-8 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-[14px] font-medium tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none [&_svg]:size-4"
