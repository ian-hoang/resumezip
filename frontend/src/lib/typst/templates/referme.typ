// refer.me-style resume, ported from the LaTeX template that used to live in
// backend/templates/overleaf4.tex.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: "us-letter", margin: 0.5in)
#set text(font: "TeX Gyre Heros", size: 10pt, lang: "en", hyphenate: true)
// All vertical spacing below is explicit, measured against the LaTeX output.
// Text lines are measured from their cap height (0.729em in this font), so a
// v(x) before a 10pt line puts its baseline x + 7.3pt below the line above.
#set block(spacing: 0pt)
#set par(justify: true, leading: 4.71pt, spacing: 4.71pt)

#let ul(body) = underline(offset: 3pt, stroke: 0.4pt, evade: false, body)

#let bullets(items) = if items.len() > 0 {
  v(5.8pt)
  list(marker: [•], indent: 11.1pt, body-indent: 5.2pt, spacing: 4.71pt, ..items)
}

// Sticky so a heading is never left alone at the bottom of a page.
#let section(title, body) = {
  v(20.1pt)
  block(sticky: true, {
    text(size: 12pt, weight: "bold", upper(title))
    v(4.05pt)
    line(length: 100%, stroke: 0.4pt)
  })
  v(4.7pt)
  body
}

// "Organisation, Location: Role ... dates" entries (work, leadership, volunteering).
#let experience(entries, org-key) = entries.map(e => {
  let org = e.at(org-key)
  block(sticky: true, {
    let place-name = join-present(", ", org, e.location)
    if has(place-name) { strong(place-name + ": ") }
    emph(e.role)
    h(1fr)
    emph(date-range(e.start, e.end))
  })
  bullets(e.bullets)
}).join(v(6.8pt))

// ---------- Heading ----------

#align(center, {
  text(size: 20.74pt, weight: "bold", p.name)
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, ul(p.email))) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, ul(p.linkedin))) }
  if has(p.website) { items.push(web-link(p.website, ul(p.website))) }
  if has(p.github) { items.push(web-link(p.github, ul(p.github))) }
  // The name and contacts are separate paragraphs, 4.71pt apart. A long
  // line wraps between items, never inside a link, and isn't stretched.
  set par(justify: false)
  if items.len() > 0 { parbreak() + items.map(box).join([ • ]) }
})
#v(1.1pt)

// ---------- Sections ----------

#for name in data.order {
  if name == "Education" and data.education.len() > 0 {
    section(heading-or(hd.education, "Education"), data.education.map(e => {
      strong(e.degree)
      h(1fr)
      strong(date-range(e.start, e.end))
      linebreak()
      emph(join-present(", ", e.school, e.location))
      if has(e.gpa) { h(1fr) + emph("GPA: " + e.gpa) }
      if has(e.coursework) { linebreak() + emph("Relevant Coursework: ") + e.coursework }
      if has(e.involvement) { linebreak() + emph("Involvement: ") + e.involvement }
    }).join(v(1pt)))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), data.skills.map(s => {
      if has(s.name) { strong(s.name + ": ") }
      s.details
    }).join(parbreak()))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), experience(data.work, "company"))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), data.projects.map(pr => {
      block(sticky: true, {
        strong(project-name(pr))
        h(1fr)
        emph(pr.date)
        // The tech stack and any printed links go on the second line.
        let details = ()
        if has(pr.techStack) { details.push(emph(pr.techStack)) }
        for url in pr.links { details.push(box(web-link(url, ul(url)))) }
        if details.len() > 0 { linebreak() + details.join([ | ]) }
      })
      bullets(pr.bullets)
    }).join(v(6.8pt)))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, ul(body))))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership Experience"), experience(data.leadership, "organization"))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer Experience"), experience(data.volunteer, "organization"))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Certifications & Awards"), data.awards.map(a => {
      strong(a.name)
      if has(a.name) and has(a.organization) { [, ] }
      a.organization
      h(1fr)
      emph(a.date)
    }).join(parbreak()))
  }
}
