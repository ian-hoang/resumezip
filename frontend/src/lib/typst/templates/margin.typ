// "Margin": section headings hang in the left margin in spaced capitals, as
// in a well-set book, and the text runs in one column beside them. Charis SIL.
// No rules at all.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let grey = luma(92)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: "us-letter", margin: (x: 0.55in, top: 0.55in, bottom: 0.45in))
#set text(font: "Charis SIL", size: 9.6pt, lang: "en")
#set block(spacing: 0pt)
#set par(justify: false, leading: 0.5em, spacing: 0pt)

#let margin = 0.98in
#let gutter = 0.2in
#let old(body) = text(number-type: "old-style", body)

// A heading in the margin, level with the first line of its section. Spaced
// any wider, its letters read as separate words in the PDF's text.
#let section(title, body) = {
  v(12.5pt)
  grid(
    columns: (margin, 1fr),
    column-gutter: gutter,
    align: (right + top, left + top),
    pad(top: 1.2pt, text(size: 7.9pt, tracking: 0.08em, fill: luma(55), upper(title))),
    body,
  )
}

#let bullets(items) = if items.len() > 0 {
  v(3.8pt)
  list(marker: text(fill: grey, [–]), indent: 0pt, body-indent: 6pt, spacing: 3.9pt, ..items.map(rich))
}

// The organization and its dates, then the role and the place, then bullets.
// The lines stay with the first bullet, but only when there is one: inside a
// grid cell, entries that each stick to the next can't be split across pages.
#let entry(title, dates, subtitle, place, items: ()) = {
  block(sticky: items.len() > 0, {
    row(strong(title), old(dates))
    if has(subtitle) or has(place) {
      v(3.5pt)
      row(emph(subtitle), text(fill: grey, place))
    }
  })
  bullets(items)
}

#let entries(items, gap: 8pt) = items.join(v(gap))

// ---------- Heading ----------

#grid(
  columns: (margin, 1fr),
  column-gutter: gutter,
  [],
  {
    text(size: 25pt, tracking: 0.01em, p.name)
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
      v(7pt)
      text(size: 9pt, fill: grey, lines.map(items => items.map(box).join(h(0.5em) + [·] + h(0.5em))).join(linebreak()))
    }
  },
)
#v(2pt)

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
    }).join(v(3.9pt)))
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
    }).join(v(4.5pt)))
  }
}
