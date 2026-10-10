// "Compact": Helvetica-style with all-caps headings, ported from the LaTeX
// template that used to live in backend/templates/overleaf4.tex.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin(0.5in))
#set text(font: "TeX Gyre Heros", size: sized(10pt), lang: "en", hyphenate: true)
// All vertical spacing below is explicit, measured against the LaTeX output,
// and scaled by Fine-tune (see common.typ). Text lines are measured from
// their cap height (0.729em in this font), so a v(x) before a 10pt line puts
// its baseline x + 7.3pt below the line above.
#set block(spacing: 0pt)
#set par(justify: true, leading: spaced(4.71pt), spacing: spaced(4.71pt))

#let ul(body) = underline(offset: sized(3pt), stroke: 0.4pt, evade: false, body)

#let bullets(items) = if items.len() > 0 {
  v(spaced(5.8pt))
  list(marker: [•], indent: 11.1pt, body-indent: 5.2pt, spacing: spaced(4.71pt), ..items.map(rich))
}

// Sticky so a heading is never left alone at the bottom of a page.
#let section(title, body) = {
  v(gapped(20.1pt))
  block(sticky: true, {
    text(size: sized(12pt), weight: "bold", upper(title))
    v(sized(4.05pt))
    line(length: 100%, stroke: 0.4pt)
  })
  v(sized(4.7pt))
  body
}

// "Organisation, Location: Role ... dates" entries (work, leadership, volunteering).
#let experience(entries, org-key) = entries.map(e => {
  let place-name = join-present(", ", e.at(org-key), e.location)
  block(sticky: true, row(
    {
      if has(place-name) { strong(place-name + ": ") }
      emph(e.role)
    },
    emph(date-range(e.start, e.end)),
  ))
  bullets(e.bullets)
}).join(v(sized(6.8pt)))

// ---------- Heading ----------

#align(center, {
  text(size: sized(20.74pt), weight: "bold", p.name)
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, ul(p.email))) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, ul(p.linkedin))) }
  if has(p.website) { items.push(web-link(p.website, ul(p.website))) }
  if has(p.github) { items.push(web-link(p.github, ul(p.github))) }
  // The name and contacts are separate paragraphs, a paragraph's spacing
  // apart. A long line wraps between items, never inside a link, and isn't
  // stretched.
  set par(justify: false)
  if items.len() > 0 { parbreak() + items.map(box).join([ • ]) }
})
#v(sized(1.1pt))

// ---------- Sections ----------

// The profile's summary, above the sections, set as a text section is.
#if data.summary.len() > 0 {
  section("Summary", extra-body((kind: "text", paragraphs: data.summary), bullets))
}

#for name in data.order {
  if data.extras.at(name, default: none) != none {
    let extra = data.extras.at(name)
    section(extra.heading, extra-body(extra, bullets))
  } else if name == "Education" and data.education.len() > 0 {
    // Lines are as far apart as in a paragraph, and schools a little further.
    section(heading-or(hd.education, "Education"), data.education.map(e => {
      let dates = date-range(e.start, e.end)
      let place = join-present(", ", e.school, e.location)
      let lines = ()
      if has(e.degree) or has(dates) { lines.push(row(strong(e.degree), strong(dates))) }
      if has(place) or has(e.gpa) { lines.push(row(emph(place), if has(e.gpa) { emph("GPA: " + e.gpa) })) }
      if has(e.coursework) { lines.push(block(emph("Relevant Coursework: ") + e.coursework)) }
      if has(e.involvement) { lines.push(block(emph("Involvement: ") + e.involvement)) }
      lines.join(v(spaced(4.71pt)))
    }).join(v(spaced(5.71pt))))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), data.skills.map(s => {
      if has(s.name) { strong(s.name + ": ") }
      s.details
    }).join(parbreak()))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), experience(data.work, "company"))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), data.projects.map(pr => {
      let lines = ()
      if has(pr.name) or has(pr.date) { lines.push(row(strong(project-name(pr)), emph(pr.date))) }
      // The tech stack and any printed links go on the second line. It isn't
      // justified: links don't break, so a wrapped line would be stretched.
      let details = ()
      if has(pr.techStack) { details.push(emph(pr.techStack)) }
      for url in pr.links { details.push(box(web-link(url, ul(url)))) }
      if details.len() > 0 { lines.push(block({ set par(justify: false); details.join([ | ]) })) }
      block(sticky: true, lines.join(v(spaced(4.71pt))))
      bullets(pr.bullets)
    }).join(v(sized(6.8pt))))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, ul(body))))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), experience(data.leadership, "organization"))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), experience(data.volunteer, "organization"))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), data.awards.map(a => row(
      {
        strong(a.name)
        if has(a.name) and has(a.organization) { [, ] }
        a.organization
      },
      emph(a.date),
    )).join(v(spaced(4.71pt))))
  }
}
