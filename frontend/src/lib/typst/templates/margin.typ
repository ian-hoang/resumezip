// "Margin": section headings hang in the left margin in small capitals, as in
// a well-set book, and the text runs in one column beside them. Charis SIL, with
// Linux Biolinum for the headings. No rules at all.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let grey = luma(92)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.55in, top: 0.55in, bottom: 0.45in)))
#set text(font: "Charis SIL", size: sized(9.6pt), lang: "en")
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.5em * tune.leading, spacing: 0pt)

// The headings' column, which grows with the text in it.
#let margin = sized(0.98in)
#let gutter = 0.2in
#let old(body) = text(number-type: "old-style", body)

// A heading in the margin, level with the first line of its section. Spaced
// any wider, its letters read as separate words in the PDF's text.
#let section(title, body) = {
  v(gapped(12.5pt))
  grid(
    columns: (margin, 1fr),
    column-gutter: gutter,
    align: (right + top, left + top),
    text(font: "Linux Biolinum O", size: sized(10.8pt), tracking: 0.03em, fill: black, stroke: sized(0.15pt) + black, smallcaps(title)),
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
    row(strong(title), old(dates))
    if has(subtitle) or has(place) {
      v(spaced(3.5pt))
      row(emph(subtitle), text(fill: grey, place))
    }
  })
  bullets(items)
}

#let entries(items, gap: 8pt) = items.join(v(sized(gap)))

// ---------- Heading ----------

#grid(
  columns: (margin, 1fr),
  column-gutter: gutter,
  [],
  {
    text(size: sized(25pt), tracking: 0.01em, p.name)
    // How to reach you, then your links, each on a line of its own.
    let reach = ()
    if has(p.location) { reach.push(p.location) }
    if has(p.phone) { reach.push(old(p.phone)) }
    if has(p.email) { reach.push(email-link(p.email, p.email)) }
    let links = ()
    if has(p.linkedin) { links.push(web-link(p.linkedin, p.linkedin)) }
    if has(p.github) { links.push(web-link(p.github, p.github)) }
    if has(p.website) { links.push(web-link(p.website, p.website)) }
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
  section("Summary", extra-body((kind: "text", paragraphs: data.summary), bullets))
}

#for name in data.order {
  if data.extras.at(name, default: none) != none {
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
      block(sticky: pr.bullets.len() > 0, row(project-header(pr, h(0.4em) + [·] + h(0.4em), url => web-link(url, url)), old(pr.date)))
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, body), gap: 5pt))
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
        old(a.date),
      )
    }).join(v(spaced(4.5pt))))
  }
}
