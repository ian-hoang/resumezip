// A box's element (StyledBox.tsx): drawing its text into it, a div per line
// with bold words in <strong>, italic ones in <em>, underlined ones in <u> and
// linked ones in <a>, reading the text back
// after the browser changed it itself, and where the cursor is, as an offset
// in the text.

import { offsetOfLine } from "./arrange"
import { BOLD, bulletLength, ITALIC, linesOf, linkOf, sameStyled, UNDERLINE, withLink, type Style, type Styled } from "./styledText"

interface Point {
  node: Node
  offset: number
}

// Elements that start a line of their own, as the browser may make when it
// edits the box itself (while an input method composes words, say).
const BLOCKS = new Set(["DIV", "P", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "TR"])

const isBold = (weight: string) => weight === "bold" || weight === "bolder" || Number(weight) >= 600
const isNormal = (weight: string) => weight === "normal" || weight === "lighter" || (weight !== "" && Number(weight) < 600)

/**
 * The style of what's inside `element`, inside text in `style`. The browser
 * can write bold as <b>, or as a span's font-weight. A link is read from an
 * <a> the box drew, whose href is the address as saved.
 */
function styleIn(element: HTMLElement, style: Style): Style {
  const { fontWeight, fontStyle, textDecorationLine } = element.style
  if (element.tagName === "STRONG" || element.tagName === "B" || isBold(fontWeight)) style |= BOLD
  else if (isNormal(fontWeight)) style &= ~BOLD
  if (element.tagName === "EM" || element.tagName === "I" || fontStyle === "italic" || fontStyle === "oblique") style |= ITALIC
  else if (fontStyle === "normal") style &= ~ITALIC
  if (element.tagName === "U" || textDecorationLine.includes("underline")) style |= UNDERLINE
  if (element.tagName === "A" && element.getAttribute("href")) style = withLink(style, element.getAttribute("href")!)
  return style
}

/**
 * The text in `root`, and where each of `points` is in it (-1 for one that
 * isn't in it), read the way the box draws it: a line per block, a <br> ends
 * a line, and the <br> that holds an empty block open adds none.
 */
export function readBox(root: Node, points: Point[] = []): { styled: Styled; offsets: number[] } {
  const lines: Styled[] = []
  // The line being read: null between blocks; `open` while a <br> has started
  // it and nothing is on it yet, as it only counts if something comes.
  let line: (Styled & { open: boolean }) | null = null
  let length = 0
  const offsets = points.map(() => -1)
  // Points marked on an open line. If it never counts, they're at the end of the line before.
  let onOpenLine: number[] = []

  // Where the next character goes, or the next line starts.
  const here = () => length + lines.length + (line ? line.text.length : 0)
  const mark = (node: Node, offset: number) => {
    points.forEach((point, index) => {
      if (offsets[index] >= 0 || point.node !== node || point.offset !== offset) return
      offsets[index] = here()
      if (line?.open) onOpenLine.push(index)
    })
  }
  const endLine = () => {
    if (line && !line.open) {
      lines.push(line)
      length += line.text.length
    } else if (line) {
      for (const index of onOpenLine) offsets[index] = Math.max(0, length + lines.length - 1)
    }
    onOpenLine = []
    line = null
  }
  const lineBreak = () => {
    line ??= { text: "", styles: [], open: false }
    // A <br> on an open line makes it an empty line that counts.
    line.open = false
    endLine()
    line = { text: "", styles: [], open: true }
  }
  const write = (character: string, style: Style) => {
    line ??= { text: "", styles: [], open: false }
    line.open = false
    onOpenLine = []
    line.text += character
    line.styles.push(style)
  }

  const visit = (node: Node, style: Style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = (node as Text).data
      for (let offset = 0; offset <= data.length; offset++) {
        mark(node, offset)
        if (offset === data.length) break
        if (data[offset] === "\n") lineBreak()
        else write(data[offset], style)
      }
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === "BR") {
      mark(node, 0)
      lineBreak()
      return
    }
    const block = node !== root && BLOCKS.has(node.tagName)
    if (block) endLine()
    const inner = node === root ? style : styleIn(node, style)
    node.childNodes.forEach((child, index) => {
      mark(node, index)
      visit(child, inner)
    })
    mark(node, node.childNodes.length)
    if (block) endLine()
  }

  visit(root, 0)
  endLine()
  const text = lines.map((part) => part.text).join("\n")
  const styles = lines.flatMap((part, index) => (index ? [0, ...part.styles] : part.styles))
  return { styled: { text, styles }, offsets: offsets.map((offset) => (offset < 0 ? -1 : Math.min(offset, text.length))) }
}

/** A line's words in runs of one style. */
function runsOf(line: Styled): { text: string; style: Style }[] {
  const runs: { text: string; style: Style }[] = []
  let start = 0
  while (start < line.text.length) {
    let end = start + 1
    while (end < line.text.length && line.styles[end] === line.styles[start]) end++
    runs.push({ text: line.text.slice(start, end), style: line.styles[start] })
    start = end
  }
  return runs
}

// What holds a run's text, outermost first: <a><u><strong><em>…</em></strong></u></a> for all of them.
const wrappers = (style: Style) => [
  ...(linkOf(style) ? ["A"] : []),
  ...(style & UNDERLINE ? ["U"] : []),
  ...(style & BOLD ? ["STRONG"] : []),
  ...(style & ITALIC ? ["EM"] : []),
]

function wrapper(tag: string, style: Style): HTMLElement {
  const element = document.createElement(tag)
  if (tag === "A") element.setAttribute("href", linkOf(style))
  return element
}

/** Whether `node` is the element `wrapper` makes, and nothing more, so its words can change in place. */
const isWrapper = (node: Node, tag: string, style: Style) =>
  node.nodeName === tag &&
  node.childNodes.length === 1 &&
  (tag === "A"
    ? (node as Element).attributes.length === 1 && (node as Element).getAttribute("href") === linkOf(style)
    : !(node as Element).attributes.length)

/** A line's element. An empty one holds a <br>, or it would have no height to put the cursor in. */
function lineElement(line: Styled): HTMLDivElement {
  const div = document.createElement("div")
  if (!line.text) div.append(document.createElement("br"))
  for (const run of runsOf(line)) {
    let node: Node = document.createTextNode(run.text)
    for (const tag of wrappers(run.style).reverse()) {
      const element = wrapper(tag, run.style)
      element.append(node)
      node = element
    }
    div.append(node)
  }
  return div
}

/**
 * The texts holding `line`'s runs in `element`, if it's drawn as lineElement
 * would draw a line in the same styles, so only their words need changing.
 */
function runTexts(element: Element, line: Styled): Text[] | null {
  const runs = runsOf(line)
  const nodes = [...element.childNodes]
  if (!line.text) return nodes.length === 1 && nodes[0].nodeName === "BR" ? [] : null
  if (nodes.length !== runs.length) return null
  const texts: Text[] = []
  for (const [index, run] of runs.entries()) {
    let node: Node = nodes[index]
    for (const tag of wrappers(run.style)) {
      if (!isWrapper(node, tag, run.style)) return null
      node = node.firstChild!
    }
    if (!(node instanceof Text)) return null
    texts.push(node)
  }
  return texts
}

/**
 * Draws `styled` in `root`, a div per line. Lines that already read as they
 * should are left alone, so an input method's words, or the browser's
 * spelling marks, aren't disturbed, and a line whose words changed in the
 * same styles keeps its elements, with new words in them. True if anything
 * changed.
 */
export function drawBox(root: HTMLElement, styled: Styled): boolean {
  const lines = linesOf(styled)
  const children = [...root.childNodes]
  if (!children.every((child) => child instanceof HTMLDivElement)) {
    root.replaceChildren(...lines.map(lineElement))
    return true
  }
  let changed = false
  lines.forEach((line, index) => {
    const child = children[index]
    if (child && sameStyled(readBox(child).styled, line)) return
    changed = true
    const texts = child && runTexts(child, line)
    if (texts) runsOf(line).forEach((run, at) => texts[at].data !== run.text && (texts[at].data = run.text))
    else if (child) child.replaceWith(lineElement(line))
    else root.append(lineElement(line))
  })
  for (const child of children.slice(lines.length)) {
    child.remove()
    changed = true
  }
  return changed
}

/**
 * Where `offset` in the text is in `root`, as drawn by drawBox: at the end of
 * the text holding the character before it, so words an input method types
 * there take that character's style; at the start of a line, in its first text.
 */
function pointAt(root: HTMLElement, offset: number): Point {
  const lines = [...root.children]
  let rest = offset
  for (const [index, line] of lines.entries()) {
    const length = line.textContent.length
    if (rest <= length || index === lines.length - 1) {
      let column = Math.min(rest, length)
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text
        if (column <= text.data.length) return { node: text, offset: column }
        column -= text.data.length
      }
      return { node: line, offset: 0 }
    }
    rest -= length + 1
  }
  return { node: root, offset: 0 }
}

/** The text from `start` to `end` in the box, as a range. */
export function rangeIn(root: HTMLElement, start: number, end: number): Range {
  const from = pointAt(root, start)
  const to = pointAt(root, end)
  const range = root.ownerDocument.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  return range
}

/** Selects from `start` to `end` in the box, or puts the cursor at `start`. */
export function selectIn(root: HTMLElement, start: number, end: number) {
  const from = pointAt(root, start)
  const to = end === start ? from : pointAt(root, end)
  root.ownerDocument.getSelection()?.setBaseAndExtent(from.node, from.offset, to.node, to.offset)
}

/** Selects a line's words, after its bullet, to point at one bullet. */
export function selectLineIn(root: HTMLElement, line: number) {
  const lines = readBox(root).styled.text.split("\n")
  if (line < 0 || line >= lines.length) return
  const start = offsetOfLine(lines, line)
  selectIn(root, start + bulletLength(lines[line]), start + lines[line].length)
}

/** Where the selection is in the box, or null when it isn't in it. */
export function selectionIn(root: HTMLElement): { start: number; end: number } | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount || !selection.anchorNode || !selection.focusNode) return null
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null
  const { offsets } = readBox(root, [
    { node: selection.anchorNode, offset: selection.anchorOffset },
    { node: selection.focusNode, offset: selection.focusOffset },
  ])
  if (offsets.includes(-1)) return null
  return { start: Math.min(...offsets), end: Math.max(...offsets) }
}

/** What an input event is about to change, where the browser says, or null if it doesn't. */
export function targetIn(root: HTMLElement, event: InputEvent): { start: number; end: number } | null {
  // Firefox before 87 has no getTargetRanges.
  const [range] = event.getTargetRanges?.() ?? []
  if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const { offsets } = readBox(root, [
    { node: range.startContainer, offset: range.startOffset },
    { node: range.endContainer, offset: range.endOffset },
  ])
  if (offsets.includes(-1)) return null
  return { start: Math.min(...offsets), end: Math.max(...offsets) }
}

const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** Words copied from the box as HTML, so they paste into a document styled and linked. */
export function htmlOf(styled: Styled): string {
  const lines = linesOf(styled).map((line) =>
    runsOf(line)
      .map(({ text, style }) =>
        wrappers(style).reduceRight((html, tag) => {
          const name = tag.toLowerCase()
          return `<${name}${tag === "A" ? ` href="${escaped(linkOf(style))}"` : ""}>${html}</${name}>`
        }, escaped(text)),
      )
      .join(""),
  )
  return lines.length > 1 ? lines.map((line) => `<div>${line || "<br>"}</div>`).join("") : lines[0]
}
