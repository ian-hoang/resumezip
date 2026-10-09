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
  lists. The summary is a profile field. Built-in sections keep their existing
  fields; extras have stable map identities and share the saved section order
  through `extra:<key>` references. Opening an old resume creates none.
  `resolveSections` is the order the editor shows and the PDF prints. A new
  resume starts with the core sections; Publications, Volunteer, Leadership and
  Awards & Certifications are `optional` (`components/editor/sections.ts`) and
  show once they're in the saved order, from Add section, or have entries.
- `src/lib/typst/` builds PDFs in a Web Worker. Its README covers adding a
  template.
- `src/lib/resumeFile.ts`: every downloaded PDF carries its resume, so the PDF
  is the user's save file and opens again exactly. Entries and bullets left out
  of the PDF (`src/lib/leftOut.ts`) aren't in it, and stay only in the browser.
  Attachments use v1 for resumes without public extras and v2 otherwise,
  including explicitly created empty sections. Both versions can be opened;
  damaged or future-version save files produce an error instead of guessed
  content. Older deployed applications may lose new sections when exporting.
- `src/lib/import/` opens PDF and Word files and sorts them into the editor's
  fields. Its README explains how.
- `src/lib/check/` is the resume checker: fixed rules that say what to fix on
  a resume, and where. Its README covers writing a rule.

## Tests

`npm test` renders each template's sample resume (`src/lib/typst/preview-samples`)
to a PDF without its attachment, reads it back through the importer, and
checks it prints the same resume. Fields that don't read back yet are listed in
`KNOWN_GAPS` in `src/lib/import/roundtrip.test.ts`; when you fix one, delete it
there. A new template needs a sample and an entry in that list.

`npm run test:browser` runs the browser tests in `e2e/` against the production
build, in Chrome and in WebKit (Safari's engine). They make a resume, check the
preview, download the PDF, reload, and open the PDF again; and they check every
page for errors and serious accessibility problems. The first time, install the
browsers with `npx playwright install chromium webkit`. They run on port 3100,
so a dev server on 3000 can keep running.

On every pull request, GitHub Actions type-checks, lints, checks the
formatting, runs the tests and builds the site (`.github/workflows/ci.yml`). The browser tests run next to it,
Chrome and WebKit each in a job of their own at the same time, and `main` only
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
