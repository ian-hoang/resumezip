// Shared helpers for the resume templates.
//
// Resume data is mapped into the compiler as /resume.json by compile.ts, after
// being normalised by toTemplateData() in resumeData.ts. Every field is
// guaranteed to exist (strings default to "", lists to ()), so templates can
// access fields directly. Values are plain strings, never markup, so user
// input cannot inject Typst code.

#let data = json("/resume.json")

#let has(value) = value != none and value != ""

// Fine-tune's settings (lib/tune.ts): multiples of the template's own text
// size, margins and line spacing, each 1 when unset, and a paper, "" for the
// template's own. A template sets its text sizes, and the spaces around
// headings and between entries, through `sized`; the spaces between lines
// through `spaced`, which follows the line spacing too; and its page through
// `page-paper` and `page-margin`. A leading in em already follows the text
// size, so it's only multiplied by tune.leading. At 1, each gives back the
// length it's given, so a resume without a tune prints as it always has.
#let tune = data.tune
#let sized(length) = length * tune.size
#let spaced(length) = length * tune.size * tune.leading
#let page-paper(own) = if has(tune.paper) { tune.paper } else { own }
#let page-margin(margin) = if type(margin) == dictionary {
  margin.pairs().map(((side, length)) => (side, length * tune.margin)).to-dict()
} else {
  margin * tune.margin
}

// A bullet: its runs from resumeData.ts, with the words the user marked
// **bold** or *italic* set that way. Bullets a template builds itself (like
// "Relevant Coursework: ...") are content already and pass through.
#let rich(item) = if type(item) == array {
  item.map(run => {
    let body = run.text
    if run.italic { body = emph(body) }
    if run.bold { body = strong(body) }
    body
  }).join()
} else { item }

// "Start - End", or whichever of the two is present.
#let date-range(start, end) = {
  if has(start) and has(end) { start + " - " + end } else { start + end }
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

// Optional sections share content formatting, while every template supplies
// its own heading and bullet styles. Prose is literal text, not markup.
// Keep paragraphs breakable so long sections span pages.
#let extra-body(extra, show-bullets) = {
  if extra.kind == "text" {
    extra.paragraphs.map(value => par(value.split("\n").join(linebreak()))).join(v(0.6em))
  } else if extra.kind == "list" {
    show-bullets(extra.bullets)
  }
}
