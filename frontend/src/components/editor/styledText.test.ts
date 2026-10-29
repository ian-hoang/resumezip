import { describe, expect, test } from "vitest"
import { plainText } from "@/lib/typst/resumeData"
import {
  BOLD,
  ITALIC,
  joinedBack,
  joinedForward,
  linkAround,
  linked,
  linkOf,
  movedLine,
  pasted,
  removed,
  settled,
  slice,
  split,
  styleAt,
  styled,
  styledOf,
  styleOver,
  stylesOver,
  toggled,
  typed,
  UNDERLINE,
  type Style,
  type Styled,
  type StyledEdit,
} from "./styledText"

/** Styled text written with tags, to read in a test: <b>bold</b>, <i>italic</i>, <bi>both</bi>. */
function tagged({ text, styles }: Styled): string {
  const tags = ["", "b", "i", "bi"]
  let out = ""
  let start = 0
  while (start < text.length) {
    let end = start + 1
    while (end < text.length && styles[end] === styles[start]) end++
    const tag = tags[styles[start]]
    out += tag ? `<${tag}>${text.slice(start, end)}</${tag}>` : text.slice(start, end)
    start = end
  }
  return out
}

/** The edit settled after `saved`, as it's saved and as the box shows it (with "|" at the cursor). */
function settle(edit: StyledEdit, saved: string) {
  const { edit: next, saved: text } = settled(edit, saved, "bullets")
  return { saved: text, shown: `${tagged(slice(next, 0, next.start))}|${tagged(slice(next, next.start))}` }
}

/** Types `words` one character at a time at the end of the saved text, as the box does, and gives what's saved. */
function typeAtEnd(saved: string, words: string): { saved: string; styled: Styled } {
  let text = saved
  let s = styledOf(text, "bullets")
  let pending: Style | undefined
  for (const character of words) {
    const at = s.text.length
    const result = settled(typed(s, at, at, character, pending ?? styleAt(s, at, "bullets"), "bullets"), text, "bullets")
    text = result.saved
    s = result.edit
    pending = result.next
  }
  return { saved: text, styled: s }
}

/** As `tagged`, with spaces plain, as they print: a mark can't hold them. */
const printed = (s: Styled) => tagged({ text: s.text, styles: s.styles.map((style, index) => (/\s/.test(s.text[index]) ? 0 : style)) })

/** A seeded random generator, so a failure can be seen again. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
}

describe("what the box shows", () => {
  test("bold and italic words without their marks, as they print", () => {
    const s = styledOf("• Optimized a **Rust** engine for *low latency*\n○ ***Both*** and **bold with *italic* inside**", "bullets")
    expect(tagged(s)).toBe(
      "• Optimized a <b>Rust</b> engine for <i>low latency</i>\n○ <bi>Both</bi> and <b>bold with </b><bi>italic</bi><b> inside</b>",
    )
  })

  test("asterisks that aren't marks as typed, as they print", () => {
    const saved = "• Scored 2 * 3 = 6, rated 5* by **users\n• *nix tools"
    expect(styledOf(saved, "bullets")).toEqual(styled(saved))
  })

  test("a bullet on every line, even one saved without it", () => {
    expect(styledOf("Built a **loom**", "bullets").text).toBe("• Built a loom")
    expect(styledOf("", "bullets").text).toBe("")
  })
})

describe("saving", () => {
  test("a line that wasn't changed keeps its marks as they were typed", () => {
    const saved = "• **Shipped *v2* early**\n• Wrote the docs"
    const s = styledOf(saved, "bullets")
    const end = s.text.length
    expect(settle(typed(s, end, end, "!", 0, "bullets"), saved).saved).toBe("• **Shipped *v2* early**\n• Wrote the docs!")
  })

  test("a changed line prints the same words in the same styles", () => {
    const saved = "• **Shipped *v2* early**"
    const s = styledOf(saved, "bullets")
    const end = s.text.length
    const { edit, saved: next } = settled(typed(s, end, end, "!", styleAt(s, end, "bullets"), "bullets"), saved, "bullets")
    expect(tagged(edit)).toBe("• <b>Shipped </b><bi>v2</bi><b> early!</b>")
    expect(printed(styledOf(next, "bullets"))).toBe(printed(edit))
  })

  test("styled words in any order read back as they were styled", () => {
    const random = seeded(7)
    const characters = "ab c,.-%()1  é"
    for (let round = 0; round < 500; round++) {
      const length = 1 + Math.floor(random() * 24)
      let text = "• "
      const styles = [0, 0]
      for (let index = 0; index < length; index++) {
        text += characters[Math.floor(random() * characters.length)]
        styles.push(Math.floor(random() * 4))
      }
      const s: Styled = { text, styles }
      const { edit, saved } = settled({ ...s, start: 0, end: 0 }, "", "bullets")
      // The same words, and every one in the style it was given; only spaces can't be bold or italic in print.
      expect(edit.text).toBe(text)
      const read = styledOf(saved, "bullets")
      expect(read.text).toBe(text)
      read.styles.forEach((style, index) => {
        if (!/\s/.test(text[index])) expect([text, index, style]).toEqual([text, index, styles[index]])
      })
    }
  })

  test("whatever's typed, the box shows what the PDF prints", () => {
    const random = seeded(11)
    const characters = "a* b**"
    for (let round = 0; round < 500; round++) {
      const length = 1 + Math.floor(random() * 12)
      let text = "• "
      const styles = [0, 0]
      for (let index = 0; index < length; index++) {
        text += characters[Math.floor(random() * characters.length)]
        styles.push(Math.floor(random() * 4))
      }
      const { edit, saved } = settled({ text, styles, start: text.length, end: text.length }, "", "bullets")
      const read = styledOf(saved, "bullets")
      expect([saved, read.text]).toEqual([saved, edit.text])
      expect(plainText(saved.slice(2)).trim()).toBe(edit.text.slice(2).trim())
      read.styles.forEach((style, index) => {
        if (!/\s/.test(read.text[index])) expect([saved, index, style]).toEqual([saved, index, edit.styles[index]])
      })
      expect(edit.start).toBeLessThanOrEqual(edit.text.length)
    }
  })
})

describe("typing", () => {
  test("after a bold word, carries on in bold, past a space, as in a word processor", () => {
    expect(typeAtEnd("• Built **search**", "es").saved).toBe("• Built **searches**")
    // The space can't be bold until the next word comes, but the next word still is.
    const space = typeAtEnd("• Built **search**", " ")
    expect(space.saved).toBe("• Built **search** ")
    expect(typeAtEnd(space.saved, "x").saved).toBe("• Built **search** x")
    expect(typeAtEnd("• Built **search**", " index").saved).toBe("• Built **search index**")
  })

  test("at the start of a line's words, in the first word's style", () => {
    const s = styledOf("• **Led** the team", "bullets")
    expect(styleAt(s, 2, "bullets")).toBe(BOLD)
    expect(styleAt(s, 1, "bullets")).toBe(0)
    expect(settle(typed(s, 2, 2, "X", styleAt(s, 2, "bullets"), "bullets"), "• **Led** the team").saved).toBe("• **XLed** the team")
  })

  test("over a selection, in its first word's style", () => {
    const s = styledOf("• Built **search** index", "bullets")
    expect(styleOver(s, "• Built ".length, "• Built search index".length, "bullets")).toBe(BOLD)
    expect(styleOver(s, 0, "• Built search".length, "bullets")).toBe(0)
  })

  test("marks typed as words turn bold or italic, with the cursor after them", () => {
    const bold = typeAtEnd("• Wrote ", "**Rust**")
    expect(bold.saved).toBe("• Wrote **Rust**")
    expect(tagged(bold.styled)).toBe("• Wrote <b>Rust</b>")
    // Past a closing mark, the words are plain again.
    expect(typeAtEnd("• Wrote ", "*fast* code").saved).toBe("• Wrote *fast* code")
    expect(typeAtEnd("• Wrote ", "**Rust** too").saved).toBe("• Wrote **Rust** too")
    expect(typeAtEnd("• Wrote **Rust** in ", "*no* time").saved).toBe("• Wrote **Rust** in *no* time")
    // Typed among bold words, as after a bold word, a word in single marks is bold and italic, and saved so the PDF reads it that way.
    const among = typeAtEnd("• Speaks **French**", " and *Spanish*")
    expect(among.saved).toBe("• Speaks **French and** ***Spanish***")
    expect(printed(among.styled)).toBe("• Speaks <b>French</b> <b>and</b> <bi>Spanish</bi>")
    expect(printed(styledOf(among.saved, "bullets"))).toBe(printed(among.styled))
    // Typed before a word, the marks make what's typed next bold, as the word is.
    const before = styledOf("• bold**", "bullets")
    const opened = settled(typed(before, 2, 2, "*", styleAt(before, 2, "bullets"), "bullets"), "• bold**", "bullets")
    const at = opened.edit.start
    const both = settled(typed(opened.edit, at, at, "*", styleAt(opened.edit, at, "bullets"), "bullets"), opened.saved, "bullets")
    expect(both).toMatchObject({ saved: "• **bold**", next: undefined })
    expect(styleAt(both.edit, both.edit.start, "bullets")).toBe(BOLD)
    // Nothing typed is lost on the way.
    const half = typeAtEnd("• Wrote ", "**Rust*")
    expect(plainText(half.saved.slice(2))).toBe(half.styled.text.slice(2))
  })

  test("words typed where a line has no bullet get one, and the cursor goes after the words", () => {
    const s = styledOf("", "bullets")
    expect(settle(typed(s, 0, 0, "L", 0, "bullets"), "")).toMatchObject({ saved: "• L", shown: "• L|" })
  })
})

describe("Enter", () => {
  test("splits bold words into two bold bullets", () => {
    const saved = "• Built **search index**"
    const s = styledOf(saved, "bullets")
    const at = "• Built search".length
    expect(settle(split(s, at, at, "bullets"), saved)).toMatchObject({
      saved: "• Built **search**\n• **index**",
      shown: "• Built <b>search</b>\n• |<b>index</b>",
    })
  })

  test("keeps the words of a left-out bullet left out", () => {
    const saved = "○ Fed **the cat**"
    expect(settle(split(styledOf(saved, "bullets"), 5, 5, "bullets"), saved).saved).toBe("○ Fed\n○ **the cat**")
  })
})

describe("bold and italic keys", () => {
  test("mark the words selected, never the bullet or the spaces at either end, and unmark them", () => {
    const s = styledOf("○ Fed the cat ", "bullets")
    const bold = toggled(s, 0, s.text.length, BOLD, "bullets")!
    expect(settle(bold, "○ Fed the cat ")).toMatchObject({ saved: "○ **Fed the cat** " })
    expect([bold.start, bold.end]).toEqual([2, 13])
    expect(settle(toggled(bold, 2, 13, BOLD, "bullets")!, "○ **Fed the cat** ").saved).toBe("○ Fed the cat ")
  })

  test("mark part of a bold phrase italic too", () => {
    const saved = "• **Built search**"
    const s = styledOf(saved, "bullets")
    const edit = toggled(s, "• Built ".length, "• Built search".length, ITALIC, "bullets")!
    expect(settle(edit, saved).saved).toBe("• **Built** ***search***")
  })

  test("bold the rest when only some words are bold", () => {
    const saved = "• Built **search** index"
    const s = styledOf(saved, "bullets")
    expect(settle(toggled(s, 2, s.text.length, BOLD, "bullets")!, saved).saved).toBe("• **Built search index**")
  })

  test("mark each line on its own, as a mark can't go past the end of a line", () => {
    const saved = "• Built a loom\n• Fed the cat"
    const s = styledOf(saved, "bullets")
    expect(settle(toggled(s, 0, s.text.length, BOLD, "bullets")!, saved).saved).toBe("• **Built a loom**\n• **Fed the cat**")
  })

  test("do nothing to the text with no words selected", () => {
    const s = styledOf("• Built a loom", "bullets")
    expect(toggled(s, 4, 4, BOLD, "bullets")).toBeUndefined()
    expect(toggled(s, 0, 2, BOLD, "bullets")).toBeUndefined()
  })
})

describe("pasting", () => {
  test("words copied from a bullets box keep their bold, and a left-out bullet stays left out", () => {
    const copied = styledOf("○ Fed the **cat**", "bullets")
    const s = styledOf("• Built a loom\n• ", "bullets")
    const at = s.text.length
    expect(settle(pasted(s, at, at, copied, true, "bullets"), "• Built a loom\n• ").saved).toBe("• Built a loom\n○ Fed the **cat**")
  })

  test("a list from elsewhere gets one bullet a line, and its marks show as they print", () => {
    const s = styledOf("", "bullets")
    expect(settle(pasted(s, 0, 0, styled("● Led **Atlas**\n    ○ Hired two people"), false, "bullets"), "").saved).toBe(
      "• Led **Atlas**\n• Hired two people",
    )
  })
})

describe("deleting", () => {
  const text = "• Built a loom\n• Fed the cat"

  test("Backspace at the start of a bullet's words joins them to the line above", () => {
    const at = "• Built a loom\n• ".length
    expect(joinedBack(text, at)).toEqual(["• Built a loom".length, at])
    expect(joinedBack(text, "• Built a loom\n".length)).toEqual(["• Built a loom".length, at])
    const [start, end] = joinedBack(text, at)!
    expect(settle(removed(styledOf(text, "bullets"), start, end), text)).toMatchObject({
      saved: "• Built a loomFed the cat",
      shown: "• Built a loom|Fed the cat",
    })
    // Not on the first line, or in the middle of the words.
    expect(joinedBack(text, 2)).toBeUndefined()
    expect(joinedBack(text, at + 1)).toBeUndefined()
  })

  test("Delete at the end of a line brings the next one up, without its bullet", () => {
    expect(joinedForward(text, "• Built a loom".length)).toEqual(["• Built a loom".length, "• Built a loom\n• ".length])
    expect(joinedForward(text, 3)).toBeUndefined()
  })

  test("a bullet deleted on the first line comes back, as every line has one", () => {
    const s = styledOf(text, "bullets")
    expect(settle(removed(s, 1, 2), text)).toMatchObject({ saved: text, shown: "• |Built a loom\n• Fed the cat" })
  })
})

describe("moving a line", () => {
  test("keeps its bold words, and the cursor in it", () => {
    const saved = "• Built a **loom**\n• Fed the cat"
    const s = styledOf(saved, "bullets")
    expect(settle(movedLine(s, 4, 1)!, saved)).toMatchObject({
      saved: "• Fed the cat\n• Built a **loom**",
      shown: "• Fed the cat\n• Bu|ilt a <b>loom</b>",
    })
    expect(movedLine(s, 4, -1)).toBeUndefined()
  })
})

describe("a prose box, as the summary's", () => {
  const saved = "Builds **fast** tools.\n\n- Not a list"

  test("shows its lines as typed, without bullets, and its bold and italic words without their marks", () => {
    expect(tagged(styledOf(saved, "prose"))).toBe("Builds <b>fast</b> tools.\n\n- Not a list")
    expect(styledOf("", "prose").text).toBe("")
  })

  test("adds no bullets, and Enter starts a new line", () => {
    const s = styledOf("", "prose")
    expect(settled(typed(s, 0, 0, "L", 0, "prose"), "", "prose")).toMatchObject({ saved: "L", edit: { text: "L", start: 1 } })
    const line = styledOf("Builds **fast tools**", "prose")
    const at = "Builds fast".length
    expect(settled(split(line, at, at, "prose"), "Builds **fast tools**", "prose")).toMatchObject({
      saved: "Builds **fast**\n **tools**",
      edit: { start: at + 1 },
    })
  })

  test("pastes words as they are, list markers and all, and turns marks typed as words bold", () => {
    const s = styledOf("Builds", "prose")
    const pastedHere = pasted(s, 6, 6, styled(" - **fast** tools\n* not a list"), false, "prose")
    expect(settled(pastedHere, "Builds", "prose").saved).toBe("Builds - **fast** tools\n* not a list")
  })

  test("bolds the first word on a line, as it has no bullet", () => {
    const s = styledOf("Builds tools", "prose")
    expect(settled(toggled(s, 0, 6, BOLD, "prose")!, "Builds tools", "prose").saved).toBe("**Builds** tools")
    expect(styleAt(styledOf("**Builds** tools", "prose"), 0, "prose")).toBe(BOLD)
  })

  test("keeps the lines it didn't change as they were typed", () => {
    const typedMarks = "**Builds *fast* tools**\nSecond"
    const s = styledOf(typedMarks, "prose")
    const end = s.text.length
    expect(settled(typed(s, end, end, "!", 0, "prose"), typedMarks, "prose").saved).toBe("**Builds *fast* tools**\nSecond!")
  })
})

describe("underline and links", () => {
  const settle = (edit: StyledEdit) => settled(edit, "", "bullets")
  const line = "• Shipped the dashboard on time"

  test("U underlines words, and takes it off again", () => {
    const s = styledOf(line, "bullets")
    const on = settle(toggled(s, 14, 23, UNDERLINE, "bullets")!)
    expect(on.saved).toBe("• Shipped the __dashboard__ on time")
    expect(settle(toggled(on.edit, 14, 23, UNDERLINE, "bullets")!).saved).toBe(line)
  })

  test("a link underlines its words; U takes the underline off and leaves the link; unlinking takes both off", () => {
    const s = styledOf(line, "bullets")
    const link = settle(linked(s, 13, 24, "https://example.com/dash", "bullets")!)
    // Spaces at either end are left out of it.
    expect(link.saved).toBe("• Shipped the [__dashboard__](https://example.com/dash) on time")
    expect(linkOf(link.edit.styles[14])).toBe("https://example.com/dash")
    expect(linkAround(link.edit, 18)).toEqual({ start: 14, end: 23, address: "https://example.com/dash" })
    const plain = settle(toggled(link.edit, 14, 23, UNDERLINE, "bullets")!)
    expect(plain.saved).toBe("• Shipped the [dashboard](https://example.com/dash) on time")
    expect(stylesOver(plain.edit, 14, 23, "bullets")).toEqual({ style: 0, link: "https://example.com/dash" })
    expect(settle(linked(link.edit, 14, 23, "", "bullets")!).saved).toBe(line)
  })

  test("words typed at either end of a link aren't in it, or underlined with it, and words typed inside it are", () => {
    const s = settle(linked(styledOf(line, "bullets"), 14, 23, "https://example.com/dash", "bullets")!).edit
    expect(styleAt(s, 23, "bullets")).toBe(0)
    expect(styleAt(s, 14, "bullets")).toBe(0)
    expect(linkOf(styleAt(s, 18, "bullets"))).toBe("https://example.com/dash")
  })

  test("styled and linked words read back as they were saved", () => {
    const saved = "• [**Atlas** __search__ tool](https://atlas.dev) and __*fast*__ __**bold**__"
    const s = styledOf(saved, "bullets")
    expect(s.text).toBe("• Atlas search tool and fast bold")
    expect(settle({ ...s, start: 0, end: 0 }).saved).toBe(saved)
  })

  test("_, [, ] and backslashes typed as words stay words, beside any mark", () => {
    let s: StyledEdit = { ...styledOf("", "bullets"), start: 0, end: 0 }
    s = typed(s, 0, 0, String.raw`__init__ [1](2) C:\dir _x_`, 0, "bullets")
    const words = settle(s)
    expect(words.edit.text).toBe(String.raw`• __init__ [1](2) C:\dir _x_`)
    const marked = settle(linked(toggled(words.edit, 2, 10, UNDERLINE, "bullets")!, 26, 29, "https://x.co", "bullets")!)
    expect(styledOf(marked.saved, "bullets")).toEqual({ text: marked.edit.text, styles: marked.edit.styles })
  })
})
