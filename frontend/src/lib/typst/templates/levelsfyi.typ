// levels.fyi-style resume, ported from the LaTeX template that used to live
// in backend/templates/overleaf3.tex.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let blue = rgb(17, 85, 204)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: "us-letter", margin: 0.4in)
#set text(font: "TeX Gyre Heros", size: 10pt, lang: "en", hyphenate: true)
// All vertical spacing below is explicit, measured against the LaTeX output.
// Text lines are measured from their cap height (0.729em in this font), so a
// v(x) before a 10pt line puts its baseline x + 7.3pt below the line above.
#set block(spacing: 0pt)
#set par(justify: true, leading: 4.71pt, spacing: 0pt)

#let bullets(items, indent: 11pt, body-indent: 5pt) = if items.len() > 0 {
  list(marker: [•], indent: indent, body-indent: body-indent, spacing: 4.71pt, ..items)
}

// \threecolumns: left, page-centred middle, and right. The outer columns share
// the leftover width equally, so the middle stays centred and a long role
// wraps instead of running into it.
#let three-columns(start, middle, end) = {
  set par(justify: false)
  set text(hyphenate: false)
  grid(
    columns: (1fr, auto, 1fr),
    column-gutter: 12pt,
    align: (left + bottom, center + bottom, right + bottom),
    start, middle, end,
  )
}

// Sticky so a heading is never left alone at the bottom of a page.
#let section(title, body) = {
  v(15.6pt)
  block(sticky: true, {
    text(size: 14pt, weight: "bold", fill: blue, title)
    v(6.3pt)
    line(length: 100%, stroke: 1pt + blue)
  })
  v(6.45pt)
  body
}

// An entry heading followed by its bullets.
#let entry(heading, items, gap: 6.6pt, ..list-args) = {
  block(sticky: true, heading)
  if items.len() > 0 {
    v(gap)
    bullets(items, ..list-args)
  }
}

// Role / organisation / dates entries (work, leadership and volunteering).
#let experience(entries, org-key) = entries.map(e => entry(
  three-columns(
    strong(e.role),
    {
      strong(e.at(org-key))
      if has(e.at(org-key)) and has(e.location) { [, ] }
      emph(e.location)
    },
    strong(date-range(e.start, e.end)),
  ),
  e.bullets,
  gap: 8.5pt,
)).join(v(8.4pt))

// ---------- Heading ----------

#v(-2.2pt)
#align(center, text(size: 24pt, weight: "bold", p.name))
#v(15.8pt)
// Where you are and how to reach you on the left, your profiles on the right.
#let reach = (
  if has(p.location) { p.location },
  if has(p.phone) { p.phone },
  if has(p.email) { email-link(p.email, p.email) },
).filter(item => item != none)
#let profiles = (
  if has(p.linkedin) { web-link(p.linkedin, p.linkedin) },
  if has(p.github) { web-link(p.github, p.github) },
  if has(p.website) { web-link(p.website, p.website) },
).filter(item => item != none)
#grid(
  columns: (1fr, 1fr),
  align: (left, right),
  row-gutter: 4.71pt,
  ..range(calc.max(reach.len(), profiles.len())).map(i => (reach.at(i, default: []), profiles.at(i, default: []))).flatten(),
)
#v(5pt)

// ---------- Sections ----------

#for name in data.order {
  if name == "Education" and data.education.len() > 0 {
    // The LaTeX version leaves a little extra room around education entries.
    section(heading-or(hd.education, "Education"), v(2pt) + data.education.map(e => {
      let items = ()
      if has(e.gpa) { items.push([GPA: #e.gpa]) }
      if has(e.coursework) { items.push([Relevant Coursework: #e.coursework]) }
      if has(e.involvement) { items.push([Involvement: #e.involvement]) }
      entry(
        row(
          {
            if has(e.degree) { strong(e.degree + ",") + [ ] }
            join-present(", ", e.school, e.location)
          },
          strong(date-range(e.start, e.end)),
        ),
        items,
        indent: 5.8pt,
        body-indent: 4.1pt,
      )
    }).join(v(8.4pt)) + v(1.4pt))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), experience(data.work, "company"))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership Experience"), experience(data.leadership, "organization"))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer Experience"), experience(data.volunteer, "organization"))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), data.projects.map(pr => entry(
      row(
        {
          strong(pr.name)
          if has(pr.github) { h(4pt) + web-link(pr.github, icon("github", size: 0.9em)) }
          if has(pr.website) { h(3pt) + web-link(pr.website, icon("external-link", size: 0.9em)) }
          if has(pr.techStack) { h(4pt) + [|] + h(4pt) + emph(pr.techStack) }
        },
        strong(pr.date),
      ),
      pr.bullets,
    )).join(v(5.2pt)))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), data.publications.map(pb => {
      let title = if has(pb.link) { web-link(pb.link, pb.title) } else { pb.title }
      block(sticky: true, {
        three-columns(strong(title), emph(pb.venue), strong(pb.date))
        if has(pb.authors) {
          v(4.71pt)
          pb.authors
        }
      })
    }).join(v(8.4pt)))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), bullets(data.skills.map(s => {
      if has(s.name) { strong(s.name + ":") + h(0.5em) }
      s.details
    })))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), bullets(data.awards.map(a => row(
      {
        strong(a.name)
        if has(a.name) and has(a.organization) { [, ] }
        a.organization
      },
      strong(a.date),
    ))))
  }
}
