// The site pages' buttons. The main action on a page is an ink pill; the others are outline pills.
const PILL =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-[18px] text-[15px] font-medium tracking-[-0.01em]"

export const INK_PILL = `${PILL} bg-ink text-white transition-colors hover:bg-black`

export const OUTLINE_PILL = `${PILL} bg-sheet/70 text-ink ring-1 ring-inset ring-ink/15 transition-shadow hover:ring-ink/40`
