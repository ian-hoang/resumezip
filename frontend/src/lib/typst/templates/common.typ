// Shared helpers for the resume templates.
//
// Resume data is mapped into the compiler as /resume.json by typst.worker.ts,
// after being normalised by toTemplateData() in resumeData.ts. Every field is
// guaranteed to exist (strings default to "", lists to ()), so templates can
// access fields directly. Values are plain strings, never markup, so user
// input cannot inject Typst code.

#let data = json("/resume.json")

#let has(value) = value != none and value != ""

// Fine-tune's settings (lib/tune.ts): multiples of the template's own text
// size, margins, line spacing and section spacing, each 1 when unset, and a
// paper, "" for the template's own. A template sets its text sizes, and the
// spaces around headings and between entries, through `sized`; the spaces
// between lines through `spaced`, which follows the line spacing too; the
// space above each section's heading through `gapped`, which follows the
// section spacing too; and its page through `page-paper` and `page-margin`.
// A leading in em already follows the text size, so it's only multiplied by
// tune.leading. At 1, each gives back the length it's given, so a resume
// without a tune prints exactly as its template sets it.
#let tune = data.tune
#let sized(length) = length * tune.size
#let spaced(length) = length * tune.size * tune.leading
#let gapped(length) = length * tune.size * tune.gap
#let page-paper(own) = if has(tune.paper) { tune.paper } else { own }
#let page-margin(margin) = if type(margin) == dictionary {
  margin.pairs().map(((side, length)) => (side, length * tune.margin)).to-dict()
} else {
  margin * tune.margin
}

// A bullet, or a line of prose: its runs from resumeData.ts, with the words
// the user styled set that way, and linked ones clickable. A link prints its
// words alone, underlined only when they are, so it looks like the rest of
// the line to hiring software. `underline` and `link` are only there when
// set. Bullets a template builds itself (like "Relevant Coursework: ...") are
// content already and pass through.
#let rich(item) = if type(item) == array {
  item.map(run => {
    let body = run.text
    if run.italic { body = emph(body) }
    if run.bold { body = strong(body) }
    if run.at("underline", default: false) { body = underline(offset: 0.18em, stroke: 0.05em, evade: false, body) }
    if run.at("link", default: "") != "" { body = link(run.link, body) }
    body
  }).join()
} else { item }

// "Start - End", or whichever of the two is present, `sep` between them.
#let date-range(start, end, sep: " - ") = {
  if has(start) and has(end) { start + sep + end } else { start + end }
}

// Profile URLs are stored without a scheme (see resumeData.ts).
#let web-link(url, body) = link("https://" + url, body)

#let email-link(address, body) = link("mailto:" + address, body)

// A project's name, linked when the user chose to link names (see resumeData.ts).
#let project-name(pr) = if has(pr.link) { web-link(pr.link, pr.name) } else { pr.name }

// A project's first line: its name in bold, its tech stack in italics, then
// its links as text, drawn by `show-link`, with `sep` between them. Each link
// stays whole when the line wraps.
#let project-header(pr, sep, show-link) = {
  let parts = ()
  if has(pr.name) { parts.push(strong(project-name(pr))) }
  if has(pr.techStack) { parts.push(emph(pr.techStack)) }
  for url in pr.links { parts.push(box(show-link(url))) }
  if parts.len() > 0 { parts.join(sep) } else { [] }
}

// One publication as a citation, IEEE style:
//   R. Conde, J. Smith, and A. Lee, “Title of the paper,” Venue, details, date, doi: 10.1/x.
// The resume owner's name is bold (see resumeData.ts). `show-link(url, body)`
// draws the DOI or link in the template's link style.
#let citation(pb, show-link) = {
  let rest = ()
  let last-text = ""
  if has(pb.venue) { rest.push(emph(pb.venue)); last-text = pb.venue }
  if has(pb.details) { rest.push(pb.details); last-text = pb.details }
  if has(pb.date) { rest.push(pb.date); last-text = pb.date }
  if has(pb.doi) { rest.push([doi: ] + show-link("doi.org/" + pb.doi, pb.doi)); last-text = pb.doi }
  else if has(pb.link) { rest.push(show-link(pb.link, pb.link)); last-text = pb.link }

  let authors = pb.authors.map(piece => if piece.me { strong(piece.text) } else { piece.text }).join()
  let out = if pb.authors.len() > 0 { authors } else { [] }
  if has(pb.title) {
    if pb.authors.len() > 0 { out += [, ] }
    // The comma after the title, or the closing full stop, goes inside the quotes.
    let mark = if pb.title.ends-with(regex("[.?!]")) { "" } else if rest.len() > 0 { "," } else { "." }
    out += "“" + pb.title + mark + "”"
    if rest.len() > 0 { out += [ ] }
  } else if pb.authors.len() > 0 and rest.len() > 0 {
    out += [, ]
  }
  if rest.len() > 0 {
    out += rest.join([, ])
    if not last-text.ends-with(".") { out += [.] }
  }
  out
}

// Publications as a numbered list of citations, [1], [2], ..., each with a
// hanging indent, `gap` apart at the template's line spacing.
#let citations(list, show-link, gap: 6pt) = grid(
  columns: (auto, 1fr),
  column-gutter: 0.7em,
  row-gutter: spaced(gap),
  ..list.enumerate().map(((i, pb)) => ("[" + str(i + 1) + "]", citation(pb, show-link))).flatten(),
)

// The section heading the user typed, or the template's default.
#let heading-or(custom, fallback) = if has(custom) { custom } else { fallback }

// `body` tagged as a heading in the PDF (H1, H2, ...), so a screen reader can
// list the resume's sections and move between them, but printed exactly as
// `body` is: without heading's own size, weight, spacing, numbering, or a
// bookmark. Each template still draws its headings its own way, and calls
// this inside its own text styles: the heading's tags sit in the line at the
// size around them, and outside the title's text(size:), at another size,
// they would move what follows by a fraction of a point.
#let tagged-heading(level, body) = context {
  // Typst sizes and bolds a heading with set rules of its own, which apply
  // whatever its show rule. They're relative to the text around it, so these
  // put back its size and weight as they are, not 1em of the heading's.
  show heading: set text(size: text.size, weight: text.weight)
  show heading: it => it.body
  heading(level: level, outlined: false, bookmarked: false, numbering: none, body)
}

// The level to tag each section's title at: H2 under the name's H1, or H1 on
// a resume without a name, which has no H1 (Typst tags no empty heading), so
// its headings don't start at H2.
#let section-level = if has(data.profile.name) { 2 } else { 1 }

// A line with one part flush left and one flush right (LaTeX's tabular* with
// \extracolsep{\fill}). Bottom-aligned so mixed font sizes share a baseline;
// the gap keeps a long left part from touching the right one.
#let row(start, end) = {
  set par(justify: false)
  set text(hyphenate: false)
  grid(columns: (1fr, auto), column-gutter: 0.8em, align: (left + bottom, right + bottom), start, end)
}

// The non-empty values joined by `sep`, or "" when all are empty.
#let join-present(sep, ..values) = {
  let present = values.pos().filter(has)
  if present.len() == 0 { "" } else { present.join(sep) }
}

// Paragraphs of prose, as the summary's and a text section's. Prose is the
// user's text, never Typst markup, with the words they marked **bold** or
// *italic* set that way, a line at a time (`rich`). A paragraph can break
// across pages, so a long section runs on to the next.
//
// A blank line leaves 0.6em more than a line break does. Between two
// paragraphs, the template's paragraph spacing stands in for its leading, and
// most templates set it to 0pt, so the gap is the leading plus 0.6em. It's
// weak, so it replaces the paragraph spacing of a template that sets one,
// like Compact, rather than adding to it.
#let prose(paragraphs) = {
  let gap = context v(par.leading + 0.6em, weak: true)
  paragraphs.map(lines => par(lines.map(rich).join(linebreak()))).join(gap)
}

// The words of a section the person added: a text section's paragraphs, or a
// list section's bullets in the template's own style (`show-bullets`). Each
// template draws the heading.
#let extra-body(extra, show-bullets) = {
  if extra.kind == "text" {
    prose(extra.paragraphs)
  } else if extra.kind == "list" {
    show-bullets(extra.bullets)
  }
}
