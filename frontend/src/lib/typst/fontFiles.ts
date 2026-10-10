// The fonts templates can use. The compiler knows every one from the start,
// from what fonts/info.json says about it, but only reads a font's data when
// it prints with it. So a resume only needs its template's fonts, plus any
// font with a character those fonts lack, as Typst picks those from every
// font it knows, the same as if all were loaded.

import type { FontUse } from "@/lib/templates"
import INFO from "./fonts/info.json"

/**
 * What Typst knows about a font without its data: its family, style and
 * which characters it has, for each font in the file, and the file's SHA-256.
 */
export interface FontInfo {
  info: { family: string; variant: { style: string; weight: number; stretch: number }; flags: string; coverage: number[] }[]
  conditions: { t: string; v: string }[]
}

/** Each font file's info, by file name. fontFiles.test.ts checks it against the files. */
export const FONT_INFO: Record<string, FontInfo> = INFO

export const FONT_FILES = Object.keys(FONT_INFO)

// Where each file is served. They're bundled, so each is served under a name
// with its content's hash that browsers keep for good; a changed font gets a
// new name. The bundler only finds paths written out in full, so each one is.
export const FONT_URLS: Record<string, string> = {
  "CharisSIL-Bold.ttf": new URL("./fonts/CharisSIL-Bold.ttf", import.meta.url).href,
  "CharisSIL-BoldItalic.ttf": new URL("./fonts/CharisSIL-BoldItalic.ttf", import.meta.url).href,
  "CharisSIL-Italic.ttf": new URL("./fonts/CharisSIL-Italic.ttf", import.meta.url).href,
  "CharisSIL-Regular.ttf": new URL("./fonts/CharisSIL-Regular.ttf", import.meta.url).href,
  "EBGaramond-Bold.ttf": new URL("./fonts/EBGaramond-Bold.ttf", import.meta.url).href,
  "EBGaramond-BoldItalic.ttf": new URL("./fonts/EBGaramond-BoldItalic.ttf", import.meta.url).href,
  "EBGaramond-Italic.ttf": new URL("./fonts/EBGaramond-Italic.ttf", import.meta.url).href,
  "EBGaramond-Regular.ttf": new URL("./fonts/EBGaramond-Regular.ttf", import.meta.url).href,
  "IBMPlexMono-Italic.ttf": new URL("./fonts/IBMPlexMono-Italic.ttf", import.meta.url).href,
  "IBMPlexMono-Regular.ttf": new URL("./fonts/IBMPlexMono-Regular.ttf", import.meta.url).href,
  "IBMPlexMono-SemiBold.ttf": new URL("./fonts/IBMPlexMono-SemiBold.ttf", import.meta.url).href,
  "IBMPlexMono-SemiBoldItalic.ttf": new URL("./fonts/IBMPlexMono-SemiBoldItalic.ttf", import.meta.url).href,
  "Lato-Bold.ttf": new URL("./fonts/Lato-Bold.ttf", import.meta.url).href,
  "Lato-BoldItalic.ttf": new URL("./fonts/Lato-BoldItalic.ttf", import.meta.url).href,
  "Lato-Italic.ttf": new URL("./fonts/Lato-Italic.ttf", import.meta.url).href,
  "Lato-Light.ttf": new URL("./fonts/Lato-Light.ttf", import.meta.url).href,
  "Lato-LightItalic.ttf": new URL("./fonts/Lato-LightItalic.ttf", import.meta.url).href,
  "Lato-Regular.ttf": new URL("./fonts/Lato-Regular.ttf", import.meta.url).href,
  "Lato-Thin.ttf": new URL("./fonts/Lato-Thin.ttf", import.meta.url).href,
  "NewCM10-Bold.otf": new URL("./fonts/NewCM10-Bold.otf", import.meta.url).href,
  "NewCM10-BoldItalic.otf": new URL("./fonts/NewCM10-BoldItalic.otf", import.meta.url).href,
  "NewCM10-Italic.otf": new URL("./fonts/NewCM10-Italic.otf", import.meta.url).href,
  "NewCM10-Regular.otf": new URL("./fonts/NewCM10-Regular.otf", import.meta.url).href,
  "Raleway-v4020-Medium.otf": new URL("./fonts/Raleway-v4020-Medium.otf", import.meta.url).href,
  "SourceSans3-Bold.ttf": new URL("./fonts/SourceSans3-Bold.ttf", import.meta.url).href,
  "SourceSans3-BoldItalic.ttf": new URL("./fonts/SourceSans3-BoldItalic.ttf", import.meta.url).href,
  "SourceSans3-Italic.ttf": new URL("./fonts/SourceSans3-Italic.ttf", import.meta.url).href,
  "SourceSans3-Light.ttf": new URL("./fonts/SourceSans3-Light.ttf", import.meta.url).href,
  "SourceSans3-Regular.ttf": new URL("./fonts/SourceSans3-Regular.ttf", import.meta.url).href,
  "texgyreheros-bold.otf": new URL("./fonts/texgyreheros-bold.otf", import.meta.url).href,
  "texgyreheros-bolditalic.otf": new URL("./fonts/texgyreheros-bolditalic.otf", import.meta.url).href,
  "texgyreheros-italic.otf": new URL("./fonts/texgyreheros-italic.otf", import.meta.url).href,
  "texgyreheros-regular.otf": new URL("./fonts/texgyreheros-regular.otf", import.meta.url).href,
}

/** The files of a font family, such as "EB Garamond", in only `weights` when given. */
export const filesOf = (family: string, weights?: readonly number[]) =>
  FONT_FILES.filter((file) => {
    const [face] = FONT_INFO[file].info
    return face.family === family && (!weights || weights.includes(face.variant.weight))
  })

/**
 * Whether a font's coverage includes a character. Coverage is runs of code
 * points from 0, alternately without and with the font, as Typst keeps it.
 */
export function covers(coverage: number[], codePoint: number): boolean {
  let end = 0
  for (let run = 0; run < coverage.length; run++) {
    end += coverage[run]
    if (codePoint < end) return run % 2 === 1
  }
  return false
}

const has = (file: string, codePoint: number) => FONT_INFO[file].info.some((face) => covers(face.coverage, codePoint))

/**
 * The font files a resume printed in `fonts` needs, given its `text`: the
 * families' own, and for each character not in all of them, every font that
 * has it, since Typst may print that character with any of those.
 */
export function fontsFor(fonts: readonly FontUse[], text: string): string[] {
  const own = fonts.flatMap(({ family, weights }) => filesOf(family, weights))
  const needed = new Set(own)
  const seen = new Set<number>()
  for (const char of text) {
    const codePoint = char.codePointAt(0)!
    if (codePoint < 0x20 || seen.has(codePoint)) continue
    seen.add(codePoint)
    if (own.every((file) => has(file, codePoint))) continue
    for (const file of FONT_FILES) if (has(file, codePoint)) needed.add(file)
  }
  return [...needed]
}

/** Every font, for typst.ts's loadFonts, with `data` asked for a file's bytes only when Typst prints with it. */
export const lazyFonts = (data: (file: string) => Uint8Array) => FONT_FILES.map((file) => ({ ...FONT_INFO[file], blob: () => data(file) }))
