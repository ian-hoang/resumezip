// "zero2sudo": a Times page as a word processor sets one. The name large and
// bold on the left, capital headings over full-width rules, and each job's
// role and company in bold on one line with its dates. TeX Gyre Termes.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin((x: 0.45in, top: 0.45in, bottom: 0.4in)))
// Termes has no Cyrillic, and its Greek has no accented letters and is spaced
// for maths, so both come from EB Garamond: all of a Greek word, or it would
// mix the two fonts.
#set text(font: ((name: "TeX Gyre Termes", covers: regex("\P{Greek}")), "EB Garamond"), size: sized(11pt), lang: "en")
#set block(spacing: 0pt)
// Vertical spacing below follows Fine-tune (see common.typ).
#set par(justify: false, leading: 0.4em * tune.leading, spacing: 0pt)

#let ul(body) = underline(offset: sized(1.8pt), stroke: 0.5pt, evade: false, body)

#let bullets(items) = if items.len() > 0 {
  v(spaced(4.4pt))
  list(marker: [•], indent: 0.13in, body-indent: 0.12in, spacing: spaced(4.4pt), ..items.map(rich))
}

// Bold capitals over a rule as wide as the page. Sticky so a heading is never
// left alone at the bottom of a page.
#let section(title, body) = {
  v(gapped(20pt))
  block(sticky: true, {
    text(size: sized(12.5pt), weight: "bold", tagged-heading(section-level, upper(title)))
    v(sized(3pt))
    line(length: 100%, stroke: 0.6pt)
  })
  v(sized(10pt))
  body
}

// What and where in bold, its dates in bold on the right, then an italic
// line under it when there's one, and bullets.
#let entry(title, dates, under: "", items: ()) = {
  block(sticky: true, {
    text(size: sized(12pt), row(strong(title), strong(dates)))
    if has(under) {
      v(spaced(6.5pt))
      emph(under)
    }
  })
  bullets(items)
}

#let entries(items, gap: 15pt) = items.join(v(sized(gap)))

// ---------- Heading ----------

#text(size: sized(28pt), weight: "bold", tagged-heading(1, p.name))
#{
  // Where and how to reach you on one line, the web addresses, underlined,
  // on the next. A long line wraps between items, never inside a link.
  let reach = ()
  if has(p.location) { reach.push(p.location) }
  if has(p.phone) { reach.push(p.phone) }
  if has(p.email) { reach.push(email-link(p.email, p.email)) }
  let web = ()
  if has(p.linkedin) { web.push(web-link(p.linkedin, ul(p.linkedin))) }
  if has(p.github) { web.push(web-link(p.github, ul(p.github))) }
  if has(p.website) { web.push(web-link(p.website, ul(p.website))) }
  set text(size: sized(12pt))
  if reach.len() > 0 {
    v(sized(10pt))
    reach.map(box).join([ | ])
  }
  if web.len() > 0 {
    v(spaced(6.5pt))
    web.map(box).join([ | ])
  }
}

// ---------- Sections ----------

#if data.summary.len() > 0 {
  section("Summary", prose(data.summary))
}

#for name in data.order {
  if name in data.extras {
    let extra = data.extras.at(name)
    section(extra.heading, extra-body(extra, bullets))
  } else if name == "Education" and data.education.len() > 0 {
    section(heading-or(hd.education, "Education"), entries(data.education.map(e => {
      let degree = join-present(", ", e.degree, if has(e.gpa) { "GPA " + e.gpa } else { "" })
      // A string, not [ - ]: markup that starts with "- " is a bullet.
      let title = (if has(e.school) { strong(e.school) }, if has(degree) { degree }).filter(part => part != none).join(" - ")
      let items = ()
      if has(e.coursework) { items.push([*Relevant Coursework:* #e.coursework]) }
      if has(e.involvement) { items.push([*Involvement:* #e.involvement]) }
      block(sticky: true, {
        text(size: sized(12pt), row(title, date-range(e.start, e.end)))
        if has(e.location) {
          v(spaced(6.5pt))
          emph(e.location)
        }
      })
      bullets(items)
    }), gap: 7pt))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), entries(data.work.map(w => {
      entry(join-present(" | ", w.role, w.company), date-range(w.start, w.end), under: w.location, items: w.bullets)
    })))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), entries(data.projects.map(pr => {
      // The name and date, then the links on the left and the tech stack on
      // the right, as the jobs above have their place.
      block(sticky: true, {
        text(size: sized(12pt), row(strong(project-name(pr)), strong(pr.date)))
        if pr.links.len() > 0 or has(pr.techStack) {
          v(spaced(6.5pt))
          row(pr.links.map(url => box(web-link(url, ul(url)))).join([ | ]), pr.techStack)
        }
      })
      bullets(pr.bullets)
    })))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, ul(body)), gap: 4.4pt))
  } else if name == "Skills" and data.skills.len() > 0 {
    section(heading-or(hd.skills, "Skills"), text(size: sized(12pt), data.skills.map(s => {
      if has(s.name) { strong(s.name + ":") + [ ] }
      s.details
    }).join(linebreak())))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), entries(data.leadership.map(l => {
      entry(join-present(" | ", l.role, l.organization), date-range(l.start, l.end), under: l.location, items: l.bullets)
    })))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), entries(data.volunteer.map(v => {
      entry(join-present(" | ", v.role, v.organization), date-range(v.start, v.end), under: v.location, items: v.bullets)
    })))
  } else if name == "Awards" and data.awards.len() > 0 {
    section(heading-or(hd.awards, "Awards & Certifications"), text(size: sized(12pt), data.awards.map(a => row(
      {
        strong(a.name)
        if has(a.organization) { [, #a.organization] }
      },
      a.date,
    )).join(v(spaced(4.4pt)))))
  }
}
