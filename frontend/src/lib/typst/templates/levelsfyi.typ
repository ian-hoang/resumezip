// "Blueprint": Helvetica-style with blue headings, ported from a LaTeX
// template.
#import "common.typ": *

#let p = data.profile
#let hd = data.headings
#let blue = rgb(17, 85, 204)

#set document(title: heading-or(p.name, "Resume"))
#set page(paper: page-paper("us-letter"), margin: page-margin(0.4in))
// Heros has no Cyrillic, and its Greek has no accented letters and is spaced
// for maths, so both come from Source Sans 3: all of a Greek word, or it
// would mix the two fonts.
#set text(font: ((name: "TeX Gyre Heros", covers: regex("\P{Greek}")), "Source Sans 3"), size: sized(10pt), lang: "en", hyphenate: true)
// All vertical spacing below is explicit, measured against the LaTeX output,
// and scaled by Fine-tune (see common.typ). Text lines are measured from
// their cap height (0.729em in this font), so a v(x) before a 10pt line puts
// its baseline x + 7.3pt below the line above.
#set block(spacing: 0pt)
#set par(justify: true, leading: spaced(4.71pt), spacing: 0pt)
// A hyphen added to break a link would read as part of its address, to anyone
// typing it in and to hiring software. A long one breaks where a line may
// break anyway, as after a "/" or a "-" it has.
#show link: set text(hyphenate: false)

#let bullets(items, indent: 11pt, body-indent: 5pt) = if items.len() > 0 {
  list(marker: [•], indent: indent, body-indent: body-indent, spacing: spaced(4.71pt), ..items.map(rich))
}

// \threecolumns: left, page-centred middle, and right. The outer columns share
// the leftover width equally, so the middle stays centred and a long role
// wraps instead of running into it. A long `auto` middle would squeeze them to
// a word a line, then run over them, so each keeps room for the dates,
// unbroken, and for the role up to a fifth of the line (never more than a
// third), and a middle wider than what's left wraps. Only up to a fifth: a long
// role that wraps beside a middle on one line keeps the words in reading order.
#let three-columns(start, middle, end) = layout(size => {
  set par(justify: false)
  set text(hyphenate: false)
  let gutter = 12pt
  let side = calc.min(
    calc.max(measure(end).width, calc.min(measure(start).width, size.width / 5)),
    (size.width - 2 * gutter) / 3,
  )
  let room = size.width - 2 * side - 2 * gutter
  grid(
    columns: (1fr, if measure(middle).width <= room { auto } else { room }, 1fr),
    column-gutter: gutter,
    align: (left + bottom, center + bottom, right + bottom),
    start, middle, end,
  )
})

// Sticky so a heading is never left alone at the bottom of a page.
#let section(title, body) = {
  v(gapped(15.6pt))
  block(sticky: true, {
    text(size: sized(14pt), weight: "bold", fill: blue, tagged-heading(section-level, title))
    v(sized(6.3pt))
    line(length: 100%, stroke: 1pt + blue)
  })
  v(sized(6.45pt))
  body
}

// An entry heading followed by its bullets, `gap` below it at the line spacing.
#let entry(heading, items, gap: 6.6pt, ..list-args) = {
  block(sticky: true, heading)
  if items.len() > 0 {
    v(spaced(gap))
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
)).join(v(sized(8.4pt)))

// ---------- Heading ----------

// Ragged and never hyphenated: justified, a name too long for its line
// would be stretched across it, and hyphenated, broken with a hyphen that
// isn't in it.
#{
  set par(justify: false)
  set text(hyphenate: false)
  v(sized(-2.2pt))
  align(center, text(size: sized(24pt), weight: "bold", tagged-heading(1, p.name)))
  v(sized(15.8pt))
  // Where you are and how to reach you on the left, your profiles on the
  // right. Two share a line, a gap or more apart, when they fit on it, and
  // take a line each when they don't. Not in two columns of half the line: an
  // email, or a link too long to break without a hyphen, would run on into
  // the other half.
  let reach = (
    if has(p.location) { p.location },
    if has(p.phone) { p.phone },
    if has(p.email) { email-link(p.email, underlined(p.email)) },
  ).filter(item => item != none)
  let profiles = (
    if has(p.linkedin) { web-link(p.linkedin, underlined(p.linkedin)) },
    if has(p.github) { web-link(p.github, underlined(p.github)) },
    if has(p.website) { web-link(p.website, underlined(p.website)) },
  ).filter(item => item != none)
  let gap = 12pt
  layout(size => range(calc.max(reach.len(), profiles.len()))
    .map(i => {
      let (start, end) = (reach.at(i, default: []), profiles.at(i, default: []))
      if measure(start).width + gap + measure(end).width <= size.width {
        grid(columns: (1fr, auto), column-gutter: gap, start, end)
      } else {
        grid(columns: 1fr, row-gutter: spaced(4.71pt), start, align(right, end))
      }
    })
    .join(v(spaced(4.71pt))))
}
#v(sized(5pt))

// ---------- Sections ----------

// The profile's summary, above the sections, set as a text section is.
#if data.summary.len() > 0 {
  section("Summary", prose(data.summary))
}

#for name in data.order {
  if name in data.extras {
    let extra = data.extras.at(name)
    section(extra.heading, extra-body(extra, bullets))
  } else if name == "Education" and data.education.len() > 0 {
    // The LaTeX version leaves a little extra room around education entries.
    section(heading-or(hd.education, "Education"), v(sized(2pt)) + data.education.map(e => {
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
    }).join(v(sized(8.4pt))) + v(sized(1.4pt)))
  } else if name == "Work" and data.work.len() > 0 {
    section(heading-or(hd.work, "Experience"), experience(data.work, "company"))
  } else if name == "Leadership" and data.leadership.len() > 0 {
    section(heading-or(hd.leadership, "Leadership"), experience(data.leadership, "organization"))
  } else if name == "Volunteership" and data.volunteer.len() > 0 {
    section(heading-or(hd.volunteer, "Volunteer"), experience(data.volunteer, "organization"))
  } else if name == "Projects" and data.projects.len() > 0 {
    section(heading-or(hd.projects, "Projects"), data.projects.map(pr => entry(
      row(
        project-header(pr, h(4pt) + [|] + h(4pt), url => web-link(url, underlined(url))),
        strong(date-range(pr.start, pr.end)),
      ),
      pr.bullets,
    )).join(v(sized(5.2pt))))
  } else if name == "Publications" and data.publications.len() > 0 {
    section(heading-or(hd.publications, "Publications"), citations(data.publications, (url, body) => web-link(url, underlined(body)), gap: 5.2pt))
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
