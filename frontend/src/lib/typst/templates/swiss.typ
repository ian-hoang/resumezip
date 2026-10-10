// "Swiss": big grotesque type on one strong left edge, like a Swiss poster.
// The name and section titles are large and black, everything else small and
// quiet, with red only in the rule under the name and the bullets. TeX Gyre Heros.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let red = rgb("#d4261c")
#let grey = luma(105)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.55in, top: 0.48in, bottom: 0.42in)))
#set text(font: "TeX Gyre Heros", size: sized(9.2pt), lang: "en")
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.5em * tune.leading, spacing: 0pt)

#let bullets(items) = if items.len() > 0 {
  v(spaced(3.8pt))
  list(marker: text(fill: red, [–]), indent: 0pt, body-indent: 6pt, spacing: spaced(3.6pt), ..items.map(rich))
}

// A section title big enough to find from across the room.
#let section(title, body) = {
  v(gapped(13pt))
  block(sticky: true, {
    text(size: sized(15pt), weight: "bold", tracking: -0.015em, title)
    v(sized(7pt))
  })
  body
}

// The organization in bold and its dates, then the role and the place in grey.
#let entry(org, dates, role, place, items: ()) = {
  block(sticky: true, {
    row(text(weight: "bold", org), dates)
    if has(role) or has(place) {
      v(spaced(3.4pt))
      row(role, text(fill: grey, place))
    }
  })
  bullets(items)
}

#let entries(items, gap: 8pt) = items.join(v(sized(gap)))

// Between the parts of a line, so they don't run together when read as text.
#let dot = h(0.45em) + text(fill: grey, [·]) + h(0.45em)

// ---------- Heading ----------

#text(size: sized(40pt), weight: "bold", tracking: -0.035em, p.name)
#{
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, p.email)) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, p.linkedin)) }
  if has(p.github) { items.push(web-link(p.github, p.github)) }
  if has(p.website) { items.push(web-link(p.website, p.website)) }
  // Far enough below the name that the line doesn't read as part of it.
  if items.len() > 0 {
    v(sized(14pt))
    items.map(box).join(h(1em))
  }
}
#v(sized(9pt))
#line(length: 100%, stroke: 2.4pt + red)
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
      entry(e.school, date-range(e.start, e.end), join-present(", ", e.degree, if has(e.gpa) { "GPA " + e.gpa } else { "" }), e.location, items: items)
    })))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => entry(w.company, date-range(w.start, w.end), w.role, w.location, items: w.bullets))))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      block(sticky: true, row(project-header(pr, dot, url => web-link(url, text(fill: grey, url))), pr.date))
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, body), gap: 5pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), grid(
      columns: (auto, 1fr),
      column-gutter: 1.2em,
      row-gutter: spaced(4.2pt),
      ..data.skills.map(s => (text(weight: "bold", s.name), s.details)).flatten(),
    ))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => entry(l.organization, date-range(l.start, l.end), l.role, l.location, items: l.bullets))))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => entry(v.organization, date-range(v.start, v.end), v.role, v.location, items: v.bullets))))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), data.awards.map(a => row(
      {
        text(weight: "bold", a.name)
        if has(a.organization) { dot + text(fill: grey, a.organization) }
      },
      a.date,
    )).join(v(spaced(4.4pt))))
  }
}
