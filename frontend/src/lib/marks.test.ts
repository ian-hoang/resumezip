import { describe, expect, test } from "vitest"
import { asSaved } from "@/lib/testResume"
import { toTemplateData } from "@/lib/typst/resumeData"
import { escapedWords, linkAddress, markedPieces, MARKS_VERSION, typedPieces, withEscapes, withMarks } from "./marks"
import { cleanResume, toAttachment } from "./resumeFile"
import { readResume } from "./resumeStorage"
import { imported } from "./resumeStore"

const textOf = (line: string) =>
  markedPieces(line)
    .map((piece) => piece.text)
    .join("")

// The pieces of a line without where they start, neighbours in one style joined, as the PDF gets them.
const runsOf = (line: string) => toTemplateData({ workExperienceSection: [{ id: 1, workDescription: `• ${line}` }] }).work[0].bullets[0]

describe("underline and links", () => {
  test("words in __double underscores__ are underlined", () => {
    expect(runsOf("Shipped __on time__")).toEqual([
      { text: "Shipped ", bold: false, italic: false },
      { text: "on time", bold: false, italic: false, underline: true },
    ])
  })

  test("[words](address) link to the address, and can hold other marks", () => {
    expect(runsOf("See [the **new** site](https://example.com/a)")).toEqual([
      { text: "See ", bold: false, italic: false },
      { text: "the ", bold: false, italic: false, link: "https://example.com/a" },
      { text: "new", bold: true, italic: false, link: "https://example.com/a" },
      { text: " site", bold: false, italic: false, link: "https://example.com/a" },
    ])
    expect(runsOf("**__[Atlas](https://atlas.dev)__**")).toEqual([
      { text: "Atlas", bold: true, italic: false, underline: true, link: "https://atlas.dev" },
    ])
  })

  test("a link to anything but the web or email prints as plain words", () => {
    expect(runsOf("[click](javascript:alert(1))")).toEqual([{ text: "[click](javascript:alert(1))", bold: false, italic: false }])
    expect(runsOf("[click](file:///etc/passwd)")).toEqual([{ text: "click", bold: false, italic: false }])
  })

  test("a backslash keeps a _, [, ] or backslash as typed, and any other character with it", () => {
    expect(textOf(String.raw`\_\_init\_\_ and \[1\] in C:\\dir`)).toBe(String.raw`__init__ and [1] in C:\dir`)
    expect(textOf(String.raw`50\% off`)).toBe(String.raw`50\% off`)
  })

  test("a piece starts where its words do in the line as typed", () => {
    expect(markedPieces(String.raw`a\_b __c__`)).toEqual([
      { text: "a", bold: false, italic: false, at: 0 },
      { text: "_b ", bold: false, italic: false, at: 2 },
      { text: "c", bold: false, italic: false, underline: true, at: 7 },
    ])
  })

  test("words saved with escapedWords read back as they were, next to any mark", () => {
    const words = ["_", "__", "a_b", "_a_", "x__y", "[1]", "](", "\\", "a\\", "\\_", "[a](https://b.co)", "*", "]"]
    for (const word of words) {
      expect(textOf(escapedWords(word))).toBe(word)
      for (const [before, after] of [
        ["__u__", ""],
        ["", "__u__"],
        ["[l](https://l.co)", ""],
        ["", "[l](https://l.co)"],
      ])
        expect(textOf(before + escapedWords(word) + after)).toBe(textOf(before) + word + textOf(after))
    }
  })

  test("typed words only turn bold and italic", () => {
    expect(typedPieces("**Rust** __init__ [a](https://b.co)").map((piece) => [piece.text, piece.bold])).toEqual([
      ["Rust", true],
      [" __init__ [a](https://b.co)", false],
    ])
  })
})

describe("a link's address", () => {
  test.each([
    ["example.com/dash", "https://example.com/dash"],
    ["  https://example.com  ", "https://example.com"],
    ["http://example.com", "http://example.com"],
    ["me@example.com", "mailto:me@example.com"],
    ["mailto:me@example.com", "mailto:me@example.com"],
    ["localhost:3000", "https://localhost:3000"],
    ["en.wikipedia.org/wiki/Rust_(language)", "https://en.wikipedia.org/wiki/Rust_%28language%29"],
  ])("%s goes to %s", (typed, address) => {
    expect(linkAddress(typed)).toBe(address)
  })

  test.each(["", "not a link", "javascript:alert(1)", "ftp://example.com", "words", "file:///etc/passwd"])("%j isn't one", (typed) => {
    expect(linkAddress(typed)).toBe("")
  })
})

// How lines were read before underline and links: bold and italic alone.
const before = (line: string) =>
  typedPieces(line).reduce<{ text: string; bold: boolean; italic: boolean }[]>((runs, { text, bold, italic }) => {
    const last = runs[runs.length - 1]
    if (last && last.bold === bold && last.italic === italic) last.text += text
    else runs.push({ text, bold, italic })
    return runs
  }, [])

const after = (line: string) => {
  const runs: { text: string; bold: boolean; italic: boolean }[] = []
  for (const piece of markedPieces(line)) {
    expect(piece.underline).toBeUndefined()
    expect(piece.link).toBeUndefined()
    const last = runs[runs.length - 1]
    if (last && last.bold === piece.bold && last.italic === piece.italic) last.text += piece.text
    else runs.push({ text: piece.text, bold: piece.bold, italic: piece.italic })
  }
  return runs
}

describe("text saved before underline and links", () => {
  test.each([
    "Wrote __init__ and __main__ for the CLI",
    "Cited in [1] and [2](3)",
    "See [docs](https://example.com) for more",
    String.raw`Paths like C:\Users\_tmp and \[x\]`,
    "snake_case and ___triple___ and _a_",
    "**Bold __with__ [link](https://a.co)** and *it_al_ic*",
    String.raw`**a\** and *b\\* and \**c**`,
  ])("reads as it did once escaped: %s", (line) => {
    expect(after(withEscapes(line))).toEqual(before(line))
  })

  test("reads as it did once escaped, whatever its characters", () => {
    // A fixed seed, so a failure can be run again.
    let seed = 381
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const characters = ["a", "b", " ", "*", "_", "[", "]", "(", ")", "\\", "h", ":", "/", "."]
    for (let round = 0; round < 5000; round++) {
      let line = ""
      const length = 1 + Math.floor(random() * 16)
      for (let index = 0; index < length; index++) line += characters[Math.floor(random() * characters.length)]
      expect(after(withEscapes(line)), JSON.stringify(line)).toEqual(before(line))
    }
  })

  test("is escaped once, in every field a box shows, and nowhere else", () => {
    const old = asSaved({
      profileSection: { fullName: "Ada_Lovelace", summary: "Wrote __init__\n\nSee [1](2)" },
      workExperienceSection: [{ id: 1, companyName: "A__B", workDescription: "• Built __slots__\n○ Left [out]" }, "not an entry"],
      projectsSection: [{ id: 1, projectDescription: "• [x](https://x.co)" }],
      extraSections: {
        "0b8a2c1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d": { kind: "text", heading: "A__B", text: "a__b" },
        "1b8a2c1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d": { kind: "list", heading: "L", bullets: "• [c]" },
      },
    })
    const now = withMarks(old)
    expect(now).toEqual({
      ...old,
      marks: MARKS_VERSION,
      profileSection: { fullName: "Ada_Lovelace", summary: String.raw`Wrote \_\_init\_\_` + "\n\n" + String.raw`See \[1\](2)` },
      workExperienceSection: [
        { id: 1, companyName: "A__B", workDescription: String.raw`• Built \_\_slots\_\_` + "\n" + String.raw`○ Left \[out\]` },
        "not an entry",
      ],
      projectsSection: [{ id: 1, projectDescription: String.raw`• \[x\](https://x.co)` }],
      extraSections: {
        "0b8a2c1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d": { kind: "text", heading: "A__B", text: String.raw`a\_\_b` },
        "1b8a2c1e-3f4d-4a5b-8c6d-7e8f9a0b1c2d": { kind: "list", heading: "L", bullets: String.raw`• \[c\]` },
      },
    })
    expect(withMarks(now)).toBe(now)
  })

  test("in a file, prints as it did once it's opened, and a file from now keeps its marks", () => {
    const old = cleanResume({ workExperienceSection: [{ id: 1, workDescription: "• Wrote __init__" }] })
    expect(imported(old, "personal").workExperienceSection?.[0].workDescription).toBe(String.raw`• Wrote \_\_init\_\_`)
    const now = imported(cleanResume({ marks: 2, workExperienceSection: [{ id: 1, workDescription: "• Wrote __init__" }] }), "personal")
    expect(now.workExperienceSection?.[0].workDescription).toBe("• Wrote __init__")
    expect(JSON.parse(toAttachment(now)).resume.marks).toBe(MARKS_VERSION)
  })

  test("saved in this browser, prints as it did", () => {
    const text = JSON.stringify({ id: "a", workExperienceSection: [{ id: 1, workDescription: "• Wrote __init__ in [Rust](x)" }] })
    const { resume } = readResume(text)
    expect(resume?.marks).toBe(MARKS_VERSION)
    expect(toTemplateData(resume!).work[0].bullets).toEqual([[{ text: "Wrote __init__ in [Rust](x)", bold: false, italic: false }]])
  })
})
