# resumezip

A free resume builder with no sign-up. Resumes are saved in the browser and
built into PDFs in the browser with [Typst](https://typst.app), and resumezip
doesn't store them.

## Running it

Uses Node 24, set by `engines` in `package.json`, which CI and Vercel build with.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # renders every template and reads it back (see below)
npm run lint
npm run format  # Prettier; CI checks it
npm run build
npm run test:browser   # after a build; see below
```

## How it fits together

- `src/context/ResumeContext.tsx` shares the resumes with the dashboard and
  the editor (`src/app/create/layout.tsx`); other pages' "Start writing"
  links only look for their keys (`src/lib/resumeKeys.ts`).
  `src/lib/resumeStore.ts` holds them and saves each one to localStorage under
  a key of its own, shortly after typing stops; `src/lib/resumeStorage.ts`
  does the reading and writing. There are no accounts, so that's the only copy.
- `src/app/create/dashboard` lists the resumes; `src/app/create/editor` is
  the editor, with a live preview. It's one static page that `next.config.js`
  serves at every resume's address, `/create/new/<id>`. The editor reads the
  open resume a field at a time (`useResumeField`), so each keystroke
  re-renders only the form it's typed in; `useResumeContext` re-renders with
  every change.
- `src/lib/resumeSections.ts` owns the sections a person adds: text or bullet
  lists, each kept under an id of its own in `extraSections` and placed in the
  saved section order as `extra:<id>`. (The summary isn't one; it's a profile
  field.) Opening an old resume adds none.
  `resolveSections` is the order the editor shows and the PDF prints. A new
  resume starts with the core sections; Publications, Volunteer, Leadership and
  Awards & Certifications are `optional` (`components/editor/sections.ts`) and
  show once they're in the saved order, from Add section, or have entries.
- The boxes for bullets, the summary and text sections
  (`src/components/editor/StyledBox.tsx`) show bold, italic, underlined and
  linked words as they print, without their marks, and save them as
  `**bold**`, `*italic*`, `***both***`, `__underline__` and `[words](address)`,
  read with the PDF's own code (`src/lib/marks.ts`). A "_", "[" or backslash
  typed as a word is saved behind a backslash; resumes from before underline
  and links are escaped as they're read (`withMarks`). Selecting words shows a
  toolbar over them (`SelectionToolbar.tsx`). Each box is an editable div that
  makes each edit itself (`styledText.ts`) and draws it (`boxDom.ts`), with
  its own undo. Only words an input method composes are left to the browser,
  and read back once it's done.
- `src/lib/typst/` builds PDFs in a Web Worker. Its README covers adding a
  template.
- `src/lib/resumeFile.ts`: every downloaded PDF carries its resume, so the PDF
  is the user's save file and opens again exactly. Sections, entries and
  bullets left out of the PDF (`src/lib/leftOut.ts`) aren't in it, and stay
  only in the browser. A resume with sections the person added, even empty
  ones, is saved as version 2; one without, as version 1, which resumezip from
  before added sections can open too. Both versions open, and a damaged file,
  or one from a newer resumezip, says so rather than guess. A resumezip from
  before added sections, still open in a tab, leaves them out of what it
  downloads. A JSON download (the ▾ beside Download PDF) is the same format with
  everything the PDF leaves out: the name and tag, what's left out, and what
  the checker was told. Download all, on the dashboard, holds every resume as
  a list under `resumes`. "Open a file" opens both.
- `src/lib/word.ts` makes the Word file in the same menu: the PDF's words in
  one plain layout for every template, as a zip of XML files written without a
  package (`src/lib/zip.ts`). It carries the PDF's attachment, with CRC-32s of
  its text and its links' addresses, so it opens again exactly until another
  app changes either.
  Word drops the attachment when it saves, and then the file opens like any
  Word file.
- `src/lib/latex/` makes the LaTeX file in the same menu, to keep editing on
  Overleaf: the PDF's words laid out as its template is. Each template in
  `src/lib/typst/templates/` has a LaTeX twin in `src/lib/latex/templates/`
  with its fonts, sizes and layout. It compiles with pdfLaTeX, Overleaf's
  default, unless the resume has letters pdfLaTeX can't print (Cyrillic,
  Greek, Vietnamese); then the file asks for XeLaTeX, and the editor says so.
  It doesn't carry the resume, so "Open a file" doesn't read it.
- Save to Google Drive, in the same ▾ menu, uploads the PDF straight from the
  browser once Google's sign-in window hands back a token (`src/lib/googleDrive.ts`
  explains how). `/google-drive` is the page that window comes back to.
- `src/lib/import/` opens PDF and Word files and sorts them into the editor's
  fields. Its README explains how.
- `src/lib/check/` is the resume checker: fixed rules that say what to fix on
  a resume, and where. Its README covers writing a rule.
- `/review` reviews a resume file without adding it: it's opened as "Open a
  file" opens it, read the way hiring software reads it, and its text checked
  by the grammar checker, so every rule runs, as the editor's Check runs them
  (`src/lib/review/review.ts`). A PDF is read and marked on its own pages. A
  Word or JSON file, which has no pages of its own, or a PDF that turns its
  pages, is printed in its template first (Jake's, for one from elsewhere).
  The verdict ("Almost there") comes from the editor's score bands
  (`verdict.ts`), and each note is scribbled on the page where `marks.ts`
  finds it, its note shown when the scribble is pointed at. "Fix it in the
  editor" adds the resume and opens the editor in Check. All of that happens
  in the browser; the AI notes don't.
- AI notes, on `/review` and in the editor's Check: `src/lib/review/ai/`
  sends the resume's printed lines to `src/app/api/review/route.ts`, the
  site's one server function, which asks the first AI service that answers
  and hands back its notes, keeping nothing. It tries Claude
  (`ANTHROPIC_API_KEY`), then OpenAI (`OPENAI_API_KEY`), then Azure OpenAI
  (`AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT` and
  `AZURE_OPENAI_DEPLOYMENT`), each only when its key is set, in `.env.local`
  on your own machine; with none, the AI notes are off. On `npm run dev`,
  with `GEMINI_API_KEY` set, it asks Gemini instead, and Azure only when
  Gemini can't answer, so trying them spends no credit. The browser keeps the
  notes by the printed lines' hash (`saved.ts`), so the same resume isn't
  asked about twice.
- `next.config.js` sends security headers with everything the site serves.
  Its Content-Security-Policy names every site the app sends anything to
  (`connect-src`), and browsers refuse to send to any other. A new one goes
  there too, or it's refused, and the browser tests that use it fail.

## Tests

`npm test` renders each template's sample resume (`src/lib/typst/preview-samples`)
to a PDF without its attachment, reads it back through the importer, and
checks it prints the same resume. Fields that don't read back yet are listed in
`KNOWN_GAPS` in `src/lib/import/roundtrip.test.ts`; when you fix one, delete it
there. It does the same with each sample's Word file, read as if Word had saved
it without its attachment (`src/lib/import/wordRoundtrip.test.ts`). A new
template needs a sample and an entry in both lists.

It also reads each sample as plain text, the way hiring software reads a PDF,
before the importer works anything out (`src/lib/import/readsCleanly.test.ts`):
letters a font joined into one sign, dates split over two lines, sections out
of order, contact details below the first heading, and headings run into the
text beside them. What a sample reads wrongly that's let be is listed in its
`KNOWN_PROBLEMS`. It writes what it finds to
`src/app/templates/how-they-read/results.json`, which `/templates/how-they-read`
shows, and fails when that's out of date: run it with `UPDATE_READ_RESULTS=1`
to write it again.

`npm run test:browser` runs the browser tests in `e2e/` against the production
build, in Chrome and in WebKit (Safari's engine). They make a resume, check the
preview, download the PDF, reload, and open the PDF again; and they check every
page for errors and serious accessibility problems. The first time, install the
browsers with `npx playwright install chromium webkit`. They run on port 3100,
so a dev server on 3000 can keep running.

On every pull request, GitHub Actions type-checks, lints, checks the
formatting, runs the tests and builds the site (`.github/workflows/ci.yml`). The browser tests run next to it,
split across jobs that run at the same time (two for Chrome, five for WebKit, which is slower), and `main` only
accepts a pull request once the checks and both browsers pass. It
also audits the packages that ship, as a report that doesn't block merging. Dependabot opens update pull requests weekly.

The workflows name each action by its full commit SHA, with the version in a
comment (`actions/checkout@<sha> # v7.0.1`), so a tag moved to other code can't
change what runs. Dependabot updates the SHA and the comment together, monthly.
Pin any new action the same way.

Issues are labelled by priority, from "P0: critical" to "P3: low". A bug
report starts at the priority its answer to "How bad is it?" gives it, and a
maintainer can move it. A pull request that fixes an issue (its description
says "fixes" and the issue number) gets that issue's priority label, even if
the issue gets one later, and moves with it when the issue moves
(`.github/workflows/pr-priority.yml`). Greptile's dashboard is set to review
pull requests by label, so fixes for urgent issues get a review.

## Deploying

Vercel builds and deploys this folder (`frontend/`). Only `main` deploys, to
the live site. Pull requests don't get preview deployments, since they use
the same free allowance; CI's build already shows a pull request builds.

To get a preview, for example to try a change on a phone, push the branch
under a `preview/` name, then delete it when you're done:

```bash
git push origin HEAD:preview/my-change
git push origin --delete preview/my-change
```

Which branches deploy is set in `vercel.json`.
