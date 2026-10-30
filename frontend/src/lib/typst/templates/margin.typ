// "Margin": section headings hang in the left margin in small capitals, as in
// a well-set book, and the text runs in one column beside them. Charis SIL, with
// Linux Biolinum for the headings. No rules at all.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let grey = luma(92)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.55in, top: 0.55in, bottom: 0.45in)))
// Charis SIL has only the Greek letters phonetics uses (θ, λ, σ and a few
// more), so a Greek word would mix it with whatever font has the rest. All of
// Greek comes from EB Garamond instead, as do letters Charis lacks.
#set text(font: ((name: "Charis SIL", covers: regex("\P{Greek}")), "EB Garamond"), size: sized(9.6pt), lang: "en")
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.5em * tune.leading, spacing: 0pt)

// The headings' column, which grows with the text in it.
#let margin = sized(0.98in)
#let gutter = 0.2in

// A heading's words, kept within the column: right-aligned, a wider one would
// run left into the page margin, and off the paper with Fine-tune's smallest
// margins. A word too wide is hyphenated; only it, as hyphenating the heading
// would break words that fit. When hyphenation can't fit one, the heading is
// set smaller, to fit that word whole, as the LaTeX file does: measured at
// the column's width, a paragraph with a line too wide measures as wide as
// the column. A word up to 0.03em too wide stays as it is: "Certifications",
// in the sample, is 0.2 pt too wide, and its first letter's side bearing more.
#let fitted(title) = context {
  let words = ()
  let widest = 0pt
  for word in title.split(" ") {
    let width = measure(word).width
    if width <= margin + 0.03 * text.size {
      words.push(word)
    } else {
      let hyphenated = text(hyphenate: true, word)
      if measure(hyphenated, width: margin).width >= margin { widest = calc.max(widest, width) }
      words.push(hyphenated)
    }
  }
  if widest > 0pt { text(size: margin / widest * 1em, words.join(" ")) } else { words.join(" ") }
}

// A heading in the margin, level with the first line of its section. Spaced
// any wider, its letters read as separate words in the PDF's text.
//
// Its lines stay on one page, which in a grid cell they wouldn't: an empty
// block as tall as the heading goes first, its room given back after it, so
// when there's no room for the heading, the block and the section start the
// next page. Sticky, the block never stays behind without the section.
#let section(title, body) = context {
  // Biolinum has all of Greek; what it lacks comes from the text's fallback.
  let heading = block(
    breakable: false,
    text(font: ("Linux Biolinum O", "EB Garamond"), size: sized(10.8pt), tracking: 0.03em, fill: black, stroke: sized(0.15pt) + black, tagged-heading(section-level, smallcaps(fitted(title)))),
  )
  let height = measure(heading, width: margin).height
  v(gapped(12.5pt))
  block(breakable: false, sticky: true, height: height)
  v(-height)
  grid(
    columns: (margin, 1fr),
    column-gutter: gutter,
    align: (right + top, left + top),
    heading,
    body,
  )
}

#let bullets(items) = if items.len() > 0 {
  v(spaced(3.8pt))
  list(marker: text(fill: grey, [–]), indent: 0pt, body-indent: 6pt, spacing: spaced(3.9pt), ..items.map(rich))
}

// The organization and its dates, then the role and the place, then bullets.
// The lines stay with the first bullet, but only when there is one: inside a
// grid cell, entries that each stick to the next can't be split across pages.
#let entry(title, dates, subtitle, place, items: ()) = {
  block(sticky: items.len() > 0, {
    row(strong(title), dates)
    if has(subtitle) or has(place) {
      v(spaced(3.5pt))
      row(emph(subtitle), text(fill: grey, place))
    }
  })
  bullets(items)
}

#let entries(items) = items.join(v(sized(8pt)))

// ---------- Heading ----------

#grid(
  columns: (margin, 1fr),
  column-gutter: gutter,
  [],
  {
    text(size: sized(25pt), tracking: 0.01em, tagged-heading(1, p.name))
    // How to reach you, then your links, each on a line of its own.
    let reach = ()
    if has(p.location) { reach.push(p.location) }
    if has(p.phone) { reach.push(p.phone) }
    if has(p.email) { reach.push(email-link(p.email, underlined(p.email))) }
    let links = ()
    if has(p.linkedin) { links.push(web-link(p.linkedin, underlined(p.linkedin))) }
    if has(p.github) { links.push(web-link(p.github, underlined(p.github))) }
    if has(p.website) { links.push(web-link(p.website, underlined(p.website))) }
    let lines = (reach, links).filter(items => items.len() > 0)
    if lines.len() > 0 {
      v(sized(7pt))
      text(size: sized(9pt), fill: grey, lines.map(items => items.map(box).join(h(0.5em) + [·] + h(0.5em))).join(linebreak()))
    }
  },
)
#v(sized(2pt))

// ---------- Sections ----------

#if data.summary.len() > 0 {
  section("Summary", prose(data.summary))
}

#for name in data.order {
  if name in data.extras {
    let extra = data.extras.at(name)
    section(extra.heading, extra-body(extra, bullets))
  } else if name == "Education" and data.education.len() > 0 {
    section(heading-or(hd.education, "Education"), entries(data.education.map(e => {
      let items = ()
      if has(e.coursework) { items.push([Coursework: #e.coursework]) }
      if has(e.involvement) { items.push([Involvement: #e.involvement]) }
      let degree = join-present(", ", e.degree, if has(e.gpa) { "GPA " + e.gpa } else { "" })
      entry(e.school, date-range(e.start, e.end), degree, e.location, items: items)
    })))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => {
      entry(w.company, date-range(w.start, w.end), w.role, w.location, items: w.bullets)
    })))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      block(sticky: pr.bullets.len() > 0, row(project-header(pr, h(0.4em) + [·] + h(0.4em), url => web-link(url, underlined(url))), date-range(pr.start, pr.end)))
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, underlined(body)), gap: 5pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), data.skills.map(s => {
      if has(s.name) { strong(s.name) + [: ] }
      s.details
    }).join(v(spaced(3.9pt))))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => {
      entry(l.organization, date-range(l.start, l.end), l.role, l.location, items: l.bullets)
    })))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => {
      entry(v.organization, date-range(v.start, v.end), v.role, v.location, items: v.bullets)
    })))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), data.awards.map(a => {
      row(
        {
          strong(a.name)
          if has(a.organization) { [, #a.organization] }
        },
        a.date,
      )
    }).join(v(spaced(4.5pt))))
  }
}
