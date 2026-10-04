// Jake's Resume (https://github.com/jakegut/resume), ported from the LaTeX
// template that used to live in backend/templates/overleaf2.tex.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: "us-letter", margin: (x: 0.4in, y: 0.5in))
#set text(font: "New Computer Modern", size: 11pt, lang: "en")
// All vertical spacing below is explicit, measured against the LaTeX output.
#set block(spacing: 0pt)
#set par(justify: false, leading: 0.52em, spacing: 0pt)

#let ul(body) = underline(offset: 2.6pt, stroke: 0.4pt, evade: false, body)

// \resumeItemListStart ... \resumeItemListEnd
#let bullets(items) = if items.len() > 0 {
  v(8.2pt)
  set text(size: 10pt)
  list(marker: [•], indent: 17pt, body-indent: 5pt, spacing: 7.9pt, ..items)
}

// \resumeSubheading: two rows of left/right aligned text, then bullets.
#let subheading(top-left, top-right, bottom-left, bottom-right, items: ()) = {
  block(sticky: true, {
    row(strong(top-left), top-right)
    v(6.9pt)
    text(size: 10pt, row(emph(bottom-left), emph(bottom-right)))
  })
  bullets(items)
}

// Entries are indented 0.15in and separated by a fixed gap.
#let entries(gap: 11pt, items) = pad(left: 0.15in, right: 0.075in, items.join(v(gap)))

// Sticky so a heading is never left alone at the bottom of a page.
#let section(title, body) = {
  v(17.5pt)
  block(sticky: true, {
    text(size: 12pt, smallcaps(title))
    v(5pt)
    line(length: 100%, stroke: 0.4pt)
  })
  v(6.9pt)
  body
}

// ---------- Heading ----------

#align(center, {
  text(size: 24.88pt, weight: "bold", smallcaps(p.name))
  let items = ()
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, ul(p.email))) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, ul(p.linkedin))) }
  if has(p.website) { items.push(web-link(p.website, ul(p.website))) }
  if has(p.github) { items.push(web-link(p.github, ul(p.github))) }
  if items.len() > 0 {
    v(8.2pt)
    text(size: 10pt, items.join([ | ]))
  }
})
#v(2pt)

// ---------- Sections ----------

#for name in data.order {
  if name == "Education" and data.education.len() > 0 {
    section(heading-or(hd.education, "Education"), entries(data.education.map(e => {
      let degree = e.degree
      if has(e.gpa) { degree = degree + " (GPA: " + e.gpa + ")" }
      let items = ()
      if has(e.coursework) { items.push([*Relevant Coursework:* #e.coursework]) }
      if has(e.involvement) { items.push([*Involvements:* #e.involvement]) }
      subheading(e.school, date-range(e.start, e.end), degree, e.location, items: items)
    })))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => {
      subheading(w.role, date-range(w.start, w.end), w.company, w.location, items: w.bullets)
    })))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      block(sticky: true, row(
        text(size: 10pt, {
          strong(pr.name)
          if has(pr.github) { [ ] + web-link(pr.github, icon("github")) }
          if has(pr.website) { [ ] + web-link(pr.website, icon("external-link")) }
          if has(pr.name) and has(pr.techStack) { [ | ] }
          emph(pr.techStack)
        }),
        pr.date,
      ))
      bullets(pr.bullets)
    })))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), entries((
      text(size: 10pt, data.skills.map(s => {
        if has(s.name) { strong(s.name + ":") + [ ] }
        s.details
      }).join(linebreak())),
    )))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership Experience"), entries(data.leadership.map(l => {
      subheading(l.organization, date-range(l.start, l.end), l.role, l.location, items: l.bullets)
    })))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer Experience"), entries(data.volunteer.map(v => {
      subheading(v.organization, date-range(v.start, v.end), v.role, v.location, items: v.bullets)
    })))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards/Certifications"), entries(gap: 7pt, data.awards.map(a => {
      row(
        {
          strong(a.name)
          if has(a.organization) { [, #a.organization] }
        },
        a.date,
      )
    })))
  }
}
