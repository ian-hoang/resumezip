// "Ian's": Lato with blue headings and narrow margins, ported from Ian Hoang's
// own resume. Contact details are plain text, without icons, so applicant
// tracking systems read them cleanly.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let blue = rgb(10, 90, 160)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: "us-letter", margin: (x: 0.35in, top: 0.5in, bottom: 0.35in))
#set text(font: "Lato", size: 9.96pt, lang: "en")
// All vertical spacing below is explicit, measured against the original PDF.
// Gaps are from one line's baseline to the top of the next line's capitals.
#set block(spacing: 0pt)
#set par(justify: false, leading: 4.78pt, spacing: 0pt)

#let ul(body) = underline(offset: 2pt, stroke: 0.4pt, evade: false, body)

#let bullets(items, gap: 5.66pt) = if items.len() > 0 {
  v(gap)
  list(
    marker: text(size: 7.5pt, [•]),
    indent: 14.7pt,
    body-indent: 5pt,
    spacing: 5.21pt,
    ..items.map(rich),
  )
}

// The organization and dates in bold, then the role and location in italics.
#let subheading(top-left, top-right, bottom-left, bottom-right, items: ()) = {
  block(sticky: true, {
    text(size: 10.91pt, row(strong(top-left), strong(top-right)))
    if has(bottom-left) or has(bottom-right) {
      v(6.46pt)
      row(emph(bottom-left), emph(bottom-right))
    }
  })
  bullets(items)
}

#let entries(gap: 7.78pt, items) = items.join(v(gap))

// "Start – End" with an en dash, or whichever of the two is present.
#let dates(start, end) = if has(start) and has(end) { start + " – " + end } else { start + end }

// A blue heading over a thin blue rule. `after` is the space below the rule,
// which differs with what comes next. Sticky so a heading is never left
// alone at the bottom of a page.
#let section(title, body, after: 5.58pt) = {
  v(13.73pt)
  block(sticky: true, {
    text(size: 11.96pt, weight: "bold", fill: blue, title)
    v(4.4pt)
    line(length: 100%, stroke: 0.4pt + blue)
  })
  v(after)
  body
}

// ---------- Heading ----------

#align(center, {
  text(size: 24.79pt, weight: "bold", fill: blue, p.name)
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push(p.phone) }
  if has(p.email) { items.push(email-link(p.email, ul(p.email))) }
  if has(p.github) { items.push(web-link(p.github, ul(p.github))) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, ul(p.linkedin))) }
  if has(p.website) { items.push(web-link(p.website, ul(p.website))) }
  if items.len() > 0 {
    v(11.06pt)
    // A long line wraps between items, never inside a link.
    items.map(box).join(h(0.6em) + [|] + h(0.5em))
  }
})
#v(3.1pt)

// ---------- Sections ----------

#for name in data.order {
  if name == "Education" and data.education.len() > 0 {
    section(heading-or(hd.education, "Education"), entries(data.education.map(e => {
      let gpa = if has(e.gpa) { "GPA: " + e.gpa } else { "" }
      let items = ()
      if has(e.coursework) { items.push([*Relevant Coursework:* #e.coursework]) }
      if has(e.involvement) { items.push([*Involvement:* #e.involvement]) }
      subheading(e.school, dates(e.start, e.end), e.degree, join-present(" | ", e.location, gpa), items: items)
    })))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => {
      subheading(w.company, dates(w.start, w.end), w.role, w.location, items: w.bullets)
    })))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), after: 8.36pt, entries(gap: 10.46pt, data.projects.map(pr => {
      block(sticky: true, row(project-header(pr, [ | ], url => web-link(url, ul(url))), strong(pr.date)))
      bullets(pr.bullets, gap: 5.26pt)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), after: 6.06pt, citations(data.publications, (url, body) => web-link(url, ul(body)), gap: 5.26pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), after: 6.06pt, data.skills.map(s => {
      if has(s.name) { strong(s.name) + [: ] }
      s.details
    }).join(linebreak()))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership Experience"), entries(data.leadership.map(l => {
      subheading(l.organization, dates(l.start, l.end), l.role, l.location, items: l.bullets)
    })))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer Experience"), entries(data.volunteer.map(v => {
      subheading(v.organization, dates(v.start, v.end), v.role, v.location, items: v.bullets)
    })))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), after: 6.06pt, data.awards.map(a => {
      row(
        {
          strong(a.name)
          if has(a.organization) { [, #a.organization] }
        },
        emph(a.date),
      )
    }).join(v(4.78pt)))
  }
}
