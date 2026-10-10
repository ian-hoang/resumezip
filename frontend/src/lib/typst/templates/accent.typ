// "Accent": a centered name in two weights, section titles whose first three
// letters take the accent color with a hairline running on after them, and
// roles and degrees in small spaced capitals. Source Sans 3 in emerald. After
// the well-known Awesome-CV look, built fresh.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let accent = rgb("#0a8a68")
#let dark = rgb("#2b2b2b")
#let grey = luma(112)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.6in, top: 0.48in, bottom: 0.42in)))
#set text(font: "Source Sans 3", size: sized(10.5pt), lang: "en", fill: dark)
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.48em * tune.leading, spacing: 0pt)

#let bullets(items) = if items.len() > 0 {
  v(spaced(3.6pt))
  list(marker: text(fill: accent, [•]), indent: 2pt, body-indent: 5pt, spacing: spaced(3.4pt), ..items.map(rich))
}

// The title's first three letters in the accent colour, then a hairline to the margin.
#let section(title, body) = {
  v(gapped(13pt))
  block(sticky: true, {
    let letters = title.clusters()
    let split = calc.min(3, letters.len())
    text(size: sized(13.5pt), weight: "bold", {
      text(fill: accent, letters.slice(0, split).join())
      letters.slice(split).join()
    })
    h(6pt)
    box(width: 1fr, inset: (bottom: 0.32em), line(length: 100%, stroke: 0.6pt + luma(185)))
    v(sized(6pt))
  })
  body
}

// The organization in bold with its place in accent italics, then the role in
// small spaced capitals with its dates in grey italics.
#let entry(org, place, role, dates, items: ()) = {
  block(sticky: true, {
    row(text(weight: "bold", org), text(fill: accent, style: "italic", place))
    if has(role) or has(dates) {
      v(spaced(3.6pt))
      row(text(size: sized(8pt), tracking: 0.08em, fill: grey, upper(role)), text(size: sized(8.6pt), fill: grey, style: "italic", dates))
    }
  })
  bullets(items)
}

#let entries(items, gap: 9pt) = items.join(v(sized(gap)))

// ---------- Heading ----------

#align(center, {
  // First names light, the last name bold.
  let words = p.name.split(" ")
  text(size: sized(30pt), {
    text(weight: 300, words.slice(0, calc.max(0, words.len() - 1)).join(" "))
    if words.len() > 1 { [ ] }
    text(weight: "bold", words.last(default: ""))
  })
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, p.email)) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, p.linkedin)) }
  if has(p.github) { items.push(web-link(p.github, p.github)) }
  if has(p.website) { items.push(web-link(p.website, p.website)) }
  if items.len() > 0 {
    v(sized(8pt))
    text(size: sized(8.8pt), fill: grey, items.map(box).join(text(fill: accent, h(0.6em) + [|] + h(0.6em))))
  }
})

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
      if has(e.gpa) { items.push([GPA: #e.gpa]) }
      if has(e.coursework) { items.push([Coursework: #e.coursework]) }
      if has(e.involvement) { items.push([Involvement: #e.involvement]) }
      entry(e.school, e.location, e.degree, date-range(e.start, e.end), items: items)
    })))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => entry(w.company, w.location, w.role, date-range(w.start, w.end), items: w.bullets))))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      block(sticky: true, row(project-header(pr, text(fill: accent, [ | ]), url => web-link(url, url)), text(size: sized(8.6pt), fill: grey, style: "italic", pr.date)))
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, body), gap: 5pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), grid(
      columns: (auto, 1fr),
      column-gutter: 1em,
      row-gutter: spaced(4.2pt),
      align: (right, left),
      ..data.skills.map(s => (text(weight: "bold", s.name), s.details)).flatten(),
    ))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => entry(l.organization, l.location, l.role, date-range(l.start, l.end), items: l.bullets))))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => entry(v.organization, v.location, v.role, date-range(v.start, v.end), items: v.bullets))))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), data.awards.map(a => row(
      {
        text(weight: "bold", a.name)
        if has(a.organization) { [, ] + a.organization }
      },
      text(size: sized(8.6pt), fill: grey, style: "italic", a.date),
    )).join(v(spaced(4.4pt))))
  }
}
