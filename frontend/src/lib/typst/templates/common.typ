// Shared helpers for the resume templates.
//
// Resume data is mapped into the compiler as /resume.json by compile.ts, after
// being normalised by toTemplateData() in resumeData.ts. Every field is
// guaranteed to exist (strings default to "", lists to ()), so templates can
// access fields directly. Values are plain strings, never markup, so user
// input cannot inject Typst code.

#let data = json("/resume.json")

#let has(value) = value != none and value != ""

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
