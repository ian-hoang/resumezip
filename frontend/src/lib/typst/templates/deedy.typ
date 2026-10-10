// "Deedy": after Debarghya Das's Deedy resume, a two-column LaTeX classic. The
// name large and light over a rule across the page, education and skills in
// a narrow column on the left, and everything else on the right. Section
// titles in light capitals, entry names in bold capitals with the role in
// small capitals. Lato, with Raleway for roles, dates and places. The left
// column is written into the PDF first, so hiring software reads it first.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
// Deedy's \color{headings} and \color{subheadings}, and its grey text.
#let headings = rgb("#6a6a6a")
#let subheadings = rgb("#333333")
#let body-grey = rgb("#444444")

// The page's side margin, which the rule under the name runs out over. Keep
// it in step with the page's.
#let side = page-margin(0.5in)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.5in, top: 0.42in, bottom: 0.4in)))
#set text(font: "Lato", weight: 300, size: sized(10.3pt), lang: "en", fill: body-grey)
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.5em * tune.leading, spacing: 0pt)

// Raleway, with lining figures rather than its default old-style ones.
#let raleway(body, size: sized(9.7pt), fill: headings) = text(font: "Raleway-v4020", weight: 500, size: size, fill: fill, number-type: "lining", body)
// Deedy's \descript: the role or degree in small capitals.
#let descript(body) = raleway(smallcaps(body), size: sized(10.4pt), fill: subheadings)
// Deedy's \location: dates and places.
#let location(body) = raleway(body)
// Deedy's \runsubsection: an entry's name in bold capitals.
#let entry-name(body) = text(size: sized(11.4pt), weight: 700, fill: subheadings, upper(body))

#let bullets(items) = if items.len() > 0 {
  v(spaced(4.2pt))
  list(marker: [•], indent: 3pt, body-indent: 6pt, spacing: spaced(4.2pt), ..items.map(rich))
}

// A section title in light capitals. The first in each column has no space above it.
#let section(title, body, first: false) = {
  if not first { v(gapped(13pt)) }
  block(sticky: true, {
    text(size: sized(16.5pt), weight: 300, fill: headings, upper(title))
    v(sized(7pt))
  })
  body
}

#let entries(items, gap: 9pt) = items.join(v(sized(gap)))

// An entry on the right: its name and, after a bar, the role, then the dates
// and place, then its bullets. The lines stay with the first bullet, but only
// when there is one: inside a grid cell, entries that each stick to the next
// can't be split across pages.
#let entry(name, role, dates, place, items: ()) = {
  block(sticky: items.len() > 0, {
    entry-name(name)
    if has(role) { h(0.4em) + descript([| ] + role) }
    let when = join-present(" | ", dates, place)
    if has(when) {
      v(spaced(4.4pt))
      location(when)
    }
  })
  bullets(items)
}

// ---------- Heading ----------

#align(center, {
  // First names hairline, the last name light.
  let words = p.name.split(" ").filter(word => word != "")
  text(size: sized(38pt), fill: headings, {
    text(weight: 100, words.slice(0, calc.max(0, words.len() - 1)).join(" "))
    if words.len() > 1 { [ ] }
    text(weight: 300, words.last(default: ""))
  })
  // Profiles on one line, then how to reach you.
  let profiles = ()
  if has(p.website) { profiles.push(web-link(p.website, p.website)) }
  if has(p.linkedin) { profiles.push(web-link(p.linkedin, p.linkedin)) }
  if has(p.github) { profiles.push(web-link(p.github, p.github)) }
  let reach = ()
  if has(p.email) { reach.push(email-link(p.email, p.email)) }
  if has(p.phone) { reach.push(p.phone) }
  if has(p.location) { reach.push(p.location) }
  // The first line far enough below the name that it doesn't read as part of it.
  for (i, items) in (profiles, reach).filter(items => items.len() > 0).enumerate() {
    v(sized(if i == 0 { 12pt } else { 5pt }))
    raleway(size: sized(10.8pt), fill: body-grey, items.map(box).join(h(0.35em) + [|] + h(0.35em)))
  }
})
#v(sized(9pt))
// A rule across the whole page, as Deedy's is.
#move(dx: -side, line(length: 100% + 2 * side, stroke: 0.5pt + headings))
#v(sized(12pt))

// ---------- Sections ----------

// Education and skills go on the left; everything else on the right, each in
// the resume's order. The resume checker reads this list as `firstColumn` in
// src/lib/templates.ts.
#let on-left = ("Education", "Skills")

#let left-section(name) = {
  if name == "Education" and data.education.len() > 0 {
    (heading-or(hd.education, "Education"), entries(data.education.map(e => {
      let more = has(e.start) or has(e.end) or has(e.location) or has(e.gpa) or has(e.involvement) or has(e.coursework)
      block(sticky: more, {
        entry-name(e.school)
        if has(e.degree) {
          v(spaced(3.4pt))
          descript(e.degree)
        }
      })
      let details = ()
      let when = join-present(" | ", date-range(e.start, e.end), e.location)
      if has(when) { details.push(location(when)) }
      if has(e.gpa) { details.push(location([GPA: #e.gpa])) }
      if has(e.involvement) { details.push([Involvement: #e.involvement]) }
      if details.len() > 0 {
        v(spaced(3.4pt))
        details.join(v(spaced(3.4pt)))
      }
      if has(e.coursework) {
        v(spaced(5pt))
        descript[Coursework:] + [ ] + e.coursework
      }
    })))
  } else if name == "Skills" and data.skills.len() > 0 {
    (heading-or(hd.skills, "Skills"), entries(gap: 8pt, data.skills.map(s => {
      if has(s.name) {
        entry-name(s.name)
        v(spaced(3.4pt))
      }
      s.details
    })))
  }
}

#let right-section(name) = {
  if data.extras.at(name, default: none) != none {
    let extra = data.extras.at(name)
    (extra.heading, extra-body(extra, bullets))
  } else if name == "Work" and data.work.len() > 0 {
    (heading-or(hd.work, "Experience"), entries(data.work.map(w => entry(w.company, w.role, date-range(w.start, w.end), w.location, items: w.bullets))))
  } else if name == "Projects" and data.projects.len() > 0 {
    (heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      block(sticky: pr.bullets.len() > 0, {
        entry-name(project-name(pr))
        if has(pr.techStack) { h(0.4em) + descript([| ] + pr.techStack) }
        let when = (pr.date, ..pr.links.map(url => web-link(url, url))).filter(has)
        if when.len() > 0 {
          v(spaced(4.4pt))
          location(when.join([ | ]))
        }
      })
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    (heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, body), gap: 6pt))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    (heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => entry(l.organization, l.role, date-range(l.start, l.end), l.location, items: l.bullets))))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    (heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => entry(v.organization, v.role, date-range(v.start, v.end), v.location, items: v.bullets))))
  } else if name == "Awards" and data.awards.len() > 0 {
    // A table with the year first, as Deedy sets its awards.
    (heading-or(hd.awards, "Awards & Certifications"), grid(
      columns: (auto, 1fr),
      column-gutter: 0.9em,
      row-gutter: spaced(5pt),
      align: (right, left),
      ..data.awards.map(a => (location(a.date), text(weight: 400, a.name) + if has(a.organization) { [ | #a.organization] })).flatten(),
    ))
  }
}

#let column(sections) = sections.filter(s => s != none).enumerate().map(((i, (title, body))) => section(title, body, first: i == 0)).join()

#grid(
  columns: (32%, 1fr),
  column-gutter: 0.3in,
  column(data.order.filter(n => n in on-left).map(left-section)),
  {
    let sections = data.order.filter(n => n not in on-left).map(right-section)
    if data.summary.len() > 0 {
      sections.insert(0, ("Summary", extra-body((kind: "text", paragraphs: data.summary), bullets)))
    }
    column(sections)
  },
)
