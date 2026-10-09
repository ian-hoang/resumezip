// "Harvard": EB Garamond with gray small-caps-style headings, in the format
// Harvard's career office recommends. Contact details are plain text, without
// icons, so applicant tracking systems read them cleanly.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let dark = rgb("#404040")
#let gray = rgb("#595959")
#let light = rgb("#737373")

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: "us-letter", margin: (x: 0.6in, top: 0.58in, bottom: 0.5in))
#set text(font: "EB Garamond", size: 10.8pt, lang: "en", fill: rgb("#1a1a1a"))
// All vertical spacing below is explicit, measured against the original.
// Gaps are from one line's baseline to the top of the next line's capitals.
#set block(spacing: 0pt)
#set par(justify: false, leading: 5.78pt, spacing: 0pt)

// Round bullets at the margin, with the text indented.
#let bullets(items) = if items.len() > 0 {
  v(5.78pt)
  list(
    // Drawn rather than typed: EB Garamond has no large round bullet.
    marker: move(dy: 2.2pt, circle(radius: 1.8pt, fill: rgb("#1a1a1a"))),
    indent: 0pt,
    body-indent: 10.7pt,
    spacing: 5.78pt,
    ..items.map(rich),
  )
  v(3.3pt)
}

// The organization in gray capitals and its place, then a second line, then
// any detail lines or bullets.
#let subheading(top-left, top-right, bottom-left, bottom-right, details: (), items: ()) = {
  block(sticky: true, {
    row(text(weight: "bold", fill: gray, upper(top-left)), top-right)
    if has(bottom-left) or has(bottom-right) {
      v(5.78pt)
      row(bottom-left, bottom-right)
    }
  })
  for line in details {
    v(5.78pt)
    line
  }
  bullets(items)
}

#let entries(items) = items.join(v(13.58pt))

// "Start – End" with an en dash, or whichever of the two is present.
#let dates(start, end) = if has(start) and has(end) { start + " – " + end } else { start + end }

// A capitalized heading over a dark rule. Sticky so a heading is never left
// alone at the bottom of a page.
#let section(title, body) = {
  v(17.85pt)
  block(sticky: true, {
    text(size: 12pt, weight: "bold", fill: dark, upper(title))
    v(4pt)
    line(length: 100%, stroke: 0.8pt + rgb("#262626"))
  })
  v(10.38pt)
  body
}

// ---------- Heading ----------

#align(center, {
  text(size: 20pt, weight: "bold", fill: dark, upper(p.name))
  let items = ()
  if has(p.location) { items.push(p.location) }
  if has(p.phone) { items.push("P: " + p.phone) }
  if has(p.email) { items.push(email-link(p.email, p.email)) }
  if has(p.linkedin) { items.push(web-link(p.linkedin, p.linkedin)) }
  if has(p.github) { items.push(web-link(p.github, p.github)) }
  if has(p.website) { items.push(web-link(p.website, p.website)) }
  if items.len() > 0 {
    v(6.38pt)
    // A long line wraps between items, never inside a link.
    items.map(box).join([ | ])
  }
})
// The first heading sits a little closer to the contact line than later ones to each other.
#v(-3.5pt)

// ---------- Sections ----------

// The profile's summary, above the sections, set as a text section is.
#if data.summary.len() > 0 {
  section("Summary", entries((extra-body((kind: "text", paragraphs: data.summary), bullets),)))
}

#for name in data.order {
  if data.extras.at(name, default: none) != none {
    let extra = data.extras.at(name)
    section(extra.heading, entries((extra-body(extra, bullets),)))
  } else if name == "Education" and data.education.len() > 0 {
    section(heading-or(hd.education, "Education"), entries(data.education.map(e => {
      let details = ()
      if has(e.gpa) { details.push([Cumulative GPA: #e.gpa]) }
      if has(e.coursework) { details.push([Relevant Coursework: #e.coursework]) }
      if has(e.involvement) { details.push([Involvement: #e.involvement]) }
      let degree = if has(e.degree) { text(fill: light, e.degree) } else { "" }
      subheading(e.school, e.location, degree, dates(e.start, e.end), details: details)
    })))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => {
      subheading(w.company, w.location, w.role, dates(w.start, w.end), items: w.bullets)
    })))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      // The name in capitals, then the tech stack and any links in gray.
      let parts = ()
      if has(pr.name) { parts.push(text(weight: "bold", upper(project-name(pr)))) }
      if has(pr.techStack) { parts.push(text(fill: gray, pr.techStack)) }
      for url in pr.links { parts.push(box(web-link(url, text(fill: gray, url)))) }
      block(sticky: true, row(parts.join(text(fill: gray, [ | ])), pr.date))
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, body), gap: 5.78pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), data.skills.map(s => {
      if has(s.name) { strong(s.name + ":") + [ ] }
      s.details
    }).join(linebreak()))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => {
      subheading(l.organization, l.location, l.role, dates(l.start, l.end), items: l.bullets)
    })))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => {
      subheading(v.organization, v.location, v.role, dates(v.start, v.end), items: v.bullets)
    })))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), data.awards.map(a => {
      row(
        {
          strong(a.name)
          if has(a.organization) { [, #a.organization] }
        },
        a.date,
      )
    }).join(v(5.78pt)))
  }
}
