// "Mono": everything in IBM Plex Mono, like a well-kept README. Capital
// section titles over dashed rules, hyphen bullets, and grey for what's
// secondary. Nothing but type, in one face.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let grey = luma(105)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.55in, top: 0.5in, bottom: 0.42in)))
#set text(font: "IBM Plex Mono", size: sized(8.4pt), lang: "en", fill: rgb("#111111"))
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.52em * tune.leading, spacing: 0pt)

#let bullets(items) = if items.len() > 0 {
  v(spaced(3.6pt))
  list(marker: text(fill: grey, [-]), indent: 0pt, body-indent: 1em, spacing: spaced(3.4pt), ..items.map(rich))
}

#let section(title, body) = {
  v(sized(13pt))
  block(sticky: true, {
    text(weight: 600, tracking: 0.04em, upper(title))
    v(sized(4pt))
    line(length: 100%, stroke: (paint: luma(150), thickness: 0.6pt, dash: (2pt, 2pt)))
    v(sized(6pt))
  })
  body
}

#let entry(org, dates, role, place, items: ()) = {
  block(sticky: true, {
    row(text(weight: 600, org), text(fill: grey, dates))
    if has(role) or has(place) {
      v(spaced(3.2pt))
      row(role, text(fill: grey, place))
    }
  })
  bullets(items)
}

#let entries(items, gap: 7.5pt) = items.join(v(sized(gap)))

// ---------- Heading ----------

#text(size: sized(18pt), weight: 600, p.name)
#{
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, p.email)) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, p.linkedin)) }
  if has(p.github) { items.push(web-link(p.github, p.github)) }
  if has(p.website) { items.push(web-link(p.website, p.website)) }
  // Where you are and how to reach you on one line, your profiles on the next.
  if items.len() > 0 {
    v(sized(6pt))
    text(fill: grey, {
      items.slice(0, calc.min(3, items.len())).map(box).join(h(1.5em))
      if items.len() > 3 { linebreak(); items.slice(3).map(box).join(h(1.5em)) }
    })
  }
}

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
      block(sticky: true, row(project-header(pr, text(fill: grey, [ | ]), url => web-link(url, url)), text(fill: grey, pr.date)))
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, body), gap: 5pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), grid(
      columns: (auto, 1fr),
      column-gutter: 1.5em,
      row-gutter: spaced(4pt),
      ..data.skills.map(s => (text(weight: 600, s.name), s.details)).flatten(),
    ))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => entry(l.organization, date-range(l.start, l.end), l.role, l.location, items: l.bullets))))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => entry(v.organization, date-range(v.start, v.end), v.role, v.location, items: v.bullets))))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), data.awards.map(a => row(
      {
        text(weight: 600, a.name)
        if has(a.organization) { text(fill: grey, [ | ]) + a.organization }
      },
      text(fill: grey, a.date),
    )).join(v(spaced(4.2pt))))
  }
}
