# Opening resume files

The dashboard's "Open a file" button (or dropping a file on the page) opens a
PDF or Word file. It all happens in the browser; nothing is uploaded.

- `open.ts` is what the UI calls. pdf.js and mammoth only download when a PDF
  or Word file is opened.
- **resumezip PDFs** carry their resume as an attached file, `resumezip.json`
  (see `src/lib/resumeFile.ts`). Opening one restores the resume exactly. The
  attachment holds what's printed plus the template and section order, never the
  resume's name or tag, since anyone who gets the PDF can read it.
- **Any other file** is read by `lines.ts` into lines of text with their position,
  size, style and links, then sorted into the editor's fields by `parse.ts`. The
  review dialog (`components/dashboard/ImportReview.tsx`) shows the result next to
  the file before anything is saved.

## How parse.ts reads a resume

1. Headings: known names ("Work Experience", "Honors & Awards") first, then lines
   styled the same way.
2. Contact details anywhere near the top, from text and from links.
3. Each section is split into entries: title lines (role, organization, dates,
   place) followed by bullets. Bullets may be glyphs, or only indentation; a line
   that ran to the right edge wraps onto the next.
4. Leftovers go in "Couldn't place", so nothing is silently dropped.

It handles single and two-column layouts, headings in a margin column, dates in a
column of their own, and Word files with or without heading styles and tables.
Scanned PDFs have no text and can't be read.

## Testing changes

The parser was checked field by field against resumes rendered from known data:
every resumezip template, browser-printed PDFs in several common styles, and Word
files. Layouts it hadn't seen scored lower than ones it was tuned on, so test a
change against a few real resumes before relying on it.
