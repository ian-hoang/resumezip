# resumezip

A free resume builder with no sign-up. Resumes are saved in the browser and
built into PDFs in the browser with [Typst](https://typst.app), so a resume
is never sent to a server.

## Running it

Needs Node 22.12 or newer.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # renders every template and reads it back (see below)
npm run lint
npm run build
```

## How it fits together

- `src/context/ResumeContext.tsx` holds every resume and saves them to
  localStorage. There are no accounts, so that's the only copy.
- `src/app/create/dashboard` lists the resumes; `src/app/create/new/[id]` is
  the editor, with a live preview.
- `src/lib/typst/` builds PDFs in a Web Worker. Its README covers adding a
  template.
- `src/lib/resumeFile.ts`: every downloaded PDF carries its resume, so the PDF
  is the user's save file and opens again exactly.
- `src/lib/import/` opens PDF and Word files and sorts them into the editor's
  fields. Its README explains how.

## Tests

`npm test` renders each template's sample resume (`src/lib/typst/preview-samples`)
to a PDF without its attachment, reads it back through the importer, and
checks it prints the same resume. Fields that don't read back yet are listed in
`KNOWN_GAPS` in `src/lib/import/roundtrip.test.ts`; when you fix one, delete it
there. A new template needs a sample and an entry in that list.

## Deploying

Vercel builds and deploys this folder (`frontend/`).
