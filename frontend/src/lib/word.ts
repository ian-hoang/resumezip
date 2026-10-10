// The resume as a Word file (.docx), to change in Word, Google Docs, Pages or
// LibreOffice. Nothing turns a Typst template into Word, so every template
// gets the same plain layout: one column, the name as the title, the contact
// line, then each section under a Word heading. An entry's name is in bold
// with its dates on a right tab stop, its role under it in italics with its
// place, then its bullets as a real Word list. The words come from
// toTemplateData, as the PDF's do, so the headings and their order match and
// what's left out of the PDF isn't in it either. It's set in Arial, which
// every computer has, rather than the templates' fonts.
//
// A .docx is a zip of XML files (lib/zip.ts). Like the PDF, it carries its
// resume as resumezip.json. Word drops files it doesn't know when it saves.
// An app that kept the attachment but changed the text would bring back the
// resume as it was before the change, so the attachment also has the CRC-32
// of the text it was written with.

import { SECTIONS, type SectionName } from "@/components/editor/sections"
import type { Resume } from "@/lib/resume"
import { ATTACHMENT_NAME, toAttachment, WORD_DOCUMENT } from "@/lib/resumeFile"
import { toTemplateData, type TemplateData } from "@/lib/typst/resumeData"
import { crc32, zip } from "@/lib/zip"

/** A Word file's type, for a download. */
export const WORD_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/** Text in one style, linked to `link` if it has one. */
interface Piece {
  text: string
  bold?: boolean
  italic?: boolean
  link?: string
}

/** The paragraph styles in STYLES, by id. */
type Style = "Normal" | "Title" | "Subtitle" | "Heading1" | "BodyText" | "Entry" | "EntryDetails" | "ListBullet" | "ListNumber"

// The lists in NUMBERING, by id.
const BULLETS = 1
const CITATIONS = 2

// Letter paper with half-inch margins, as the templates' pages are, in
// twentieths of a point (1,440 to the inch). Dates and places are set on a
// tab stop at the right margin.
const PAGE = { width: 12240, height: 15840, margin: 720 }
const RIGHT_TAB = PAGE.width - 2 * PAGE.margin

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
const RELATIONSHIPS = "http://schemas.openxmlformats.org/package/2006/relationships"
const OFFICE_RELATIONSHIPS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

// The document's own relationships: styles, numbering and settings, then one for each link.
const FIRST_LINK = 4

// What XML can't hold, which pasted text can bring: control characters other
// than tab and line breaks, and half of an emoji (a surrogate without its
// pair). Whole emoji are matched so they're kept.
const NOT_XML = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF\0-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g

const escape = (text: string) =>
  text
    .replace(NOT_XML, (match) => (match.length === 2 ? match : ""))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

// A run of text in one style. A line break in it stays one, and a tab is a
// space, since tab stops here are for dates.
function run({ text, bold, italic }: Piece, link: boolean): string {
  const style = `${link ? '<w:rStyle w:val="Hyperlink"/>' : ""}${bold ? "<w:b/><w:bCs/>" : ""}${italic ? "<w:i/><w:iCs/>" : ""}`
  const lines = text
    .replace(/\t/g, " ")
    .split(/\r\n?|\n/)
    .map((line) => `<w:t xml:space="preserve">${escape(line)}</w:t>`)
  return `<w:r>${style && `<w:rPr>${style}</w:rPr>`}${lines.join("<w:br/>")}</w:r>`
}

const TAB = "<w:r><w:tab/></w:r>"

// Profile and project links are stored without "https://" (see resumeData.ts).
const web = (url: string) => `https://${url}`

/** The address a link goes to, or null for one that isn't an address, which is printed without a link. */
function linkTarget(url: string): string | null {
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/** "Start - End", or whichever of the two is present, as the templates print dates. */
const dateRange = (start: string, end: string) => (start && end ? `${start} - ${end}` : start + end)

/** Groups of pieces, with `separator` between them. */
const joined = (groups: Piece[][], separator: string): Piece[] =>
  groups.flatMap((group, i) => (i ? [{ text: separator }, ...group] : group))

/**
 * A publication as a citation, IEEE style, as the templates print it
 * (`citation` in templates/common.typ), with the resume owner's name in bold:
 *   R. Conde, J. Smith, and A. Lee, “Title of the paper,” Venue, details, date, doi: 10.1/x.
 */
function citation(publication: TemplateData["publications"][number]): Piece[] {
  const { title, authors, venue, details, date, doi, link } = publication
  const rest: Piece[][] = []
  if (venue) rest.push([{ text: venue, italic: true }])
  if (details) rest.push([{ text: details }])
  if (date) rest.push([{ text: date }])
  if (doi) rest.push([{ text: "doi: " }, { text: doi, link: `https://doi.org/${doi}` }])
  else if (link) rest.push([{ text: link, link: web(link) }])

  const out: Piece[] = authors.map((piece) => ({ text: piece.text, bold: piece.me }))
  if (title) {
    if (authors.length) out.push({ text: ", " })
    // The comma after the title, or the closing full stop, goes inside the quotes.
    const mark = /[.?!]$/.test(title) ? "" : rest.length ? "," : "."
    out.push({ text: `“${title}${mark}”${rest.length ? " " : ""}` })
  } else if (authors.length && rest.length) {
    out.push({ text: ", " })
  }
  if (rest.length) {
    out.push(...joined(rest, ", "))
    if (!rest.at(-1)!.at(-1)!.text.endsWith(".")) out.push({ text: "." })
  }
  return out
}

/** Where each section's entries and heading are in TemplateData. */
const SECTION_KEYS: Record<SectionName, keyof TemplateData["headings"]> = {
  Education: "education",
  Work: "work",
  Projects: "projects",
  Publications: "publications",
  Skills: "skills",
  Leadership: "leadership",
  Volunteership: "volunteer",
  Awards: "awards",
}

/** The text of the Word file, and where each of its links goes, in order. */
function documentOf(data: TemplateData): { xml: string; links: string[] } {
  const paragraphs: string[] = []
  const links: string[] = []

  const runs = (pieces: Piece[]) =>
    pieces
      .filter((piece) => piece.text)
      .map((piece) => {
        const target = piece.link && linkTarget(piece.link)
        if (!target) return run(piece, false)
        links.push(target)
        return `<w:hyperlink r:id="rId${FIRST_LINK + links.length - 1}">${run(piece, true)}</w:hyperlink>`
      })
      .join("")

  /**
   * A paragraph: `right` goes on the right margin (in an Entry), `keepNext`
   * keeps it on the same page as the next one, and `list` makes it an item
   * of that list.
   */
  const add = (
    style: Style,
    pieces: Piece[],
    { right = [], keepNext = false, list }: { right?: Piece[]; keepNext?: boolean; list?: number } = {},
  ) => {
    const numbering = list ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${list}"/></w:numPr>` : ""
    const tabbed = right.some((piece) => piece.text)
    // The Entry style has the tab stop too, but Google Docs has no styles of its own like it.
    const tabs = tabbed ? `<w:tabs><w:tab w:val="right" w:pos="${RIGHT_TAB}"/></w:tabs>` : ""
    const props = `<w:pStyle w:val="${style}"/>${keepNext ? "<w:keepNext/>" : ""}${numbering}${tabs}`
    paragraphs.push(`<w:p><w:pPr>${props}</w:pPr>${runs(pieces)}${tabbed ? TAB + runs(right) : ""}</w:p>`)
  }

  const heading = (text: string) => add("Heading1", [{ text }])
  const prose = (texts: string[]) => texts.forEach((text) => add("BodyText", [{ text }]))
  const bullets = (items: Piece[][]) => items.forEach((item) => add("ListBullet", item, { list: BULLETS }))
  /**
   * An entry: its lines, each with something on the left and on the right
   * margin, then its bullets. Lines with nothing on them are left out. The
   * lines stay on a page with each other and the first bullet.
   */
  const entry = (lines: [Piece[], Piece[]][], items: Piece[][] = []) => {
    const shown = lines.filter((line) => line.flat().some((piece) => piece.text))
    shown.forEach(([left, right], i) =>
      add(i ? "EntryDetails" : "Entry", left, { right, keepNext: i < shown.length - 1 || items.length > 0 }),
    )
    bullets(items)
  }
  // An organization's entry: its name and dates, then the role and the place.
  const experience = (organization: string, start: string, end: string, role: string, location: string, items: Piece[][]) =>
    entry(
      [
        [[{ text: organization, bold: true }], [{ text: dateRange(start, end) }]],
        [[{ text: role, italic: true }], [{ text: location, italic: true }]],
      ],
      items,
    )

  const { profile, headings } = data
  if (profile.name) add("Title", [{ text: profile.name }])
  const contacts: Piece[][] = [
    [{ text: profile.location }],
    [{ text: profile.phone }],
    [{ text: profile.email, link: `mailto:${profile.email}` }],
    [{ text: profile.linkedin, link: web(profile.linkedin) }],
    [{ text: profile.website, link: web(profile.website) }],
    [{ text: profile.github, link: web(profile.github) }],
  ].filter(([piece]) => piece.text)
  if (contacts.length) add("Subtitle", joined(contacts, " | "))

  if (data.summary.length) {
    heading("Summary")
    prose(data.summary)
  }

  for (const name of data.order) {
    const extra = data.extras[name]
    if (extra) {
      heading(extra.heading)
      if (extra.kind === "text") prose(extra.paragraphs)
      else bullets(extra.bullets)
      continue
    }
    const key = SECTION_KEYS[name as SectionName]
    if (!key || data[key].length === 0) continue
    // The heading the person wrote, or the one every template prints.
    heading(headings[key] || SECTIONS[name as SectionName].title)
    switch (key) {
      case "education":
        for (const school of data.education) {
          const gpa = school.gpa && `(GPA: ${school.gpa})`
          entry(
            [
              [[{ text: school.school, bold: true }], [{ text: dateRange(school.start, school.end) }]],
              [[{ text: [school.degree, gpa].filter(Boolean).join(" "), italic: true }], [{ text: school.location, italic: true }]],
            ],
            [
              ["Relevant Coursework:", school.coursework],
              ["Involvement:", school.involvement],
            ]
              .filter(([, text]) => text)
              .map(([label, text]) => [{ text: label, bold: true }, { text: ` ${text}` }]),
          )
        }
        break
      case "work":
        for (const job of data.work) experience(job.company, job.start, job.end, job.role, job.location, job.bullets)
        break
      case "leadership":
      case "volunteer":
        for (const role of data[key]) experience(role.organization, role.start, role.end, role.role, role.location, role.bullets)
        break
      case "projects":
        for (const project of data.projects) {
          const parts: Piece[][] = []
          if (project.name) parts.push([{ text: project.name, bold: true, link: project.link ? web(project.link) : undefined }])
          if (project.techStack) parts.push([{ text: project.techStack, italic: true }])
          for (const url of project.links) parts.push([{ text: url, link: web(url) }])
          entry([[joined(parts, " | "), [{ text: project.date }]]], project.bullets)
        }
        break
      case "publications":
        for (const publication of data.publications) add("ListNumber", citation(publication), { list: CITATIONS })
        break
      case "skills":
        for (const skill of data.skills)
          add("Normal", [...(skill.name ? [{ text: `${skill.name}:`, bold: true }, { text: " " }] : []), { text: skill.details }])
        break
      case "awards":
        // Set apart by a bar rather than the comma some templates use, as an award's name can have a comma in it.
        for (const award of data.awards) {
          entry([[[{ text: award.name, bold: true }, { text: award.organization && ` | ${award.organization}` }], [{ text: award.date }]]])
        }
        break
    }
  }

  const page = `<w:pgSz w:w="${PAGE.width}" w:h="${PAGE.height}"/><w:pgMar w:top="${PAGE.margin}" w:right="${PAGE.margin}" w:bottom="${PAGE.margin}" w:left="${PAGE.margin}" w:header="360" w:footer="360" w:gutter="0"/>`
  // Word wants a paragraph in every document, even an empty one.
  const body = paragraphs.join("") || "<w:p/>"
  return {
    xml: `${XML}<w:document xmlns:w="${W}" xmlns:r="${OFFICE_RELATIONSHIPS}"><w:body>${body}<w:sectPr>${page}</w:sectPr></w:body></w:document>`,
    links,
  }
}

const CONTENT_TYPES = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
<Default Extension="xml" ContentType="application/xml"/>\
<Default Extension="json" ContentType="application/json"/>\
<Override PartName="/${WORD_DOCUMENT}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>\
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>\
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>\
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>\
</Types>`

const PACKAGE_RELATIONSHIPS = `${XML}<Relationships xmlns="${RELATIONSHIPS}">\
<Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/officeDocument" Target="${WORD_DOCUMENT}"/>\
<Relationship Id="rId2" Type="${RELATIONSHIPS}/metadata/core-properties" Target="docProps/core.xml"/>\
</Relationships>`

const documentRelationships = (links: string[]) =>
  `${XML}<Relationships xmlns="${RELATIONSHIPS}">\
<Relationship Id="rId1" Type="${OFFICE_RELATIONSHIPS}/styles" Target="styles.xml"/>\
<Relationship Id="rId2" Type="${OFFICE_RELATIONSHIPS}/numbering" Target="numbering.xml"/>\
<Relationship Id="rId3" Type="${OFFICE_RELATIONSHIPS}/settings" Target="settings.xml"/>\
${links.map((link, i) => `<Relationship Id="rId${FIRST_LINK + i}" Type="${OFFICE_RELATIONSHIPS}/hyperlink" Target="${escape(link)}" TargetMode="External"/>`).join("")}\
</Relationships>`

// The document's title, as the PDF's is: the name, or "Resume".
const coreProperties = (title: string) =>
  `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escape(title)}</dc:title></cp:coreProperties>`

// Without a compatibility mode, Word opens the file in Compatibility Mode, as
// one from Word 2007; 15 is Word 2013 and later.
const SETTINGS = `${XML}<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:compat>\
<w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>\
</w:compat></w:settings>`

// Sizes are in half points, spacing in twentieths of a point. Body text is
// 10pt Arial, with no space between lines of a paragraph beyond the font's own.
// Normal repeats the font, as macOS's reader (Quick Look, TextEdit) skips the
// defaults.
// prettier-ignore
const STYLES = `${XML}<w:styles xmlns:w="${W}">\
<w:docDefaults>\
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>\
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>\
</w:docDefaults>\
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>\
<w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>\
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>\
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:spacing w:after="80"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>\
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:jc w:val="center"/></w:pPr></w:style>\
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>\
<w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/></w:pBdr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr>\
<w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>\
<w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr></w:style>\
<w:style w:type="paragraph" w:customStyle="1" w:styleId="Entry"><w:name w:val="Entry"/><w:basedOn w:val="Normal"/><w:next w:val="EntryDetails"/><w:qFormat/>\
<w:pPr><w:tabs><w:tab w:val="right" w:pos="${RIGHT_TAB}"/></w:tabs><w:spacing w:before="100"/></w:pPr></w:style>\
<w:style w:type="paragraph" w:customStyle="1" w:styleId="EntryDetails"><w:name w:val="Entry Details"/><w:basedOn w:val="Entry"/><w:next w:val="ListBullet"/><w:qFormat/>\
<w:pPr><w:spacing w:before="0"/></w:pPr></w:style>\
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="20"/></w:pPr></w:style>\
<w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="40"/></w:pPr></w:style>\
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:u w:val="single"/></w:rPr></w:style>\
</w:styles>`

// Bullets ("•") and citations ("[1]"), each hanging out to the left of its text.
// prettier-ignore
const NUMBERING = `${XML}<w:numbering xmlns:w="${W}">\
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>\
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="216"/></w:pPr></w:lvl>\
</w:abstractNum>\
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>\
<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="[%1]"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="440" w:hanging="440"/></w:pPr></w:lvl>\
</w:abstractNum>\
<w:num w:numId="${BULLETS}"><w:abstractNumId w:val="0"/></w:num>\
<w:num w:numId="${CITATIONS}"><w:abstractNumId w:val="1"/></w:num>\
</w:numbering>`

/**
 * The resume as a Word file, with its resume attached as a PDF's is. Throws
 * a TooLongError for one too long to open again (see toAttachment).
 */
export function toWordFile(resume: Resume): Uint8Array<ArrayBuffer> {
  const data = toTemplateData(resume)
  const { xml, links } = documentOf(data)
  const document = new TextEncoder().encode(xml)
  return zip({
    "[Content_Types].xml": CONTENT_TYPES,
    "_rels/.rels": PACKAGE_RELATIONSHIPS,
    "docProps/core.xml": coreProperties(data.profile.name || "Resume"),
    [WORD_DOCUMENT]: document,
    "word/_rels/document.xml.rels": documentRelationships(links),
    "word/styles.xml": STYLES,
    "word/numbering.xml": NUMBERING,
    "word/settings.xml": SETTINGS,
    [ATTACHMENT_NAME]: toAttachment(resume, { documentCrc32: crc32(document) }),
  })
}
