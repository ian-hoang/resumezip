# resumezip

A free resume builder with no sign-up. Resumes are saved in the browser and
built into PDFs in the browser with [Typst](https://typst.app), so a resume
is never sent to a server.

## Running it

Uses Node 24, set by `engines` in `package.json`, which CI and Vercel build with.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # renders every template and reads it back (see below)
npm run lint
npm run build
npm run test:browser   # after a build; see below
```

## How it fits together

- `src/context/ResumeContext.tsx` shares the resumes with the app.
  `src/lib/resumeStore.ts` holds them and saves each one to localStorage under
  a key of its own, shortly after typing stops; `src/lib/resumeStorage.ts`
  does the reading and writing. There are no accounts, so that's the only copy.
- `src/app/create/dashboard` lists the resumes; `src/app/create/new/[id]` is
  the editor, with a live preview.
- `src/lib/typst/` builds PDFs in a Web Worker. Its README covers adding a
  template.
- `src/lib/resumeFile.ts`: every downloaded PDF carries its resume, so the PDF
  is the user's save file and opens again exactly.
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

On every pull request, GitHub Actions type-checks, lints, runs the tests and
builds the site (`.github/workflows/ci.yml`), and `main` only accepts a pull
request once that passes. The browser tests run in their own job next to it. It also audits the packages that ship, as a report
that doesn't block merging. Dependabot opens update pull requests weekly.

The workflows name each action by its full commit SHA, with the version in a
comment (`actions/checkout@<sha> # v7.0.1`), so a tag moved to other code can't
change what runs. Dependabot updates the SHA and the comment together, monthly.
Pin any new action the same way.

A pull request that fixes a bug (its description says "fixes" and the issue
number) gets that bug's severity label, even if the bug gets one later
(`.github/workflows/pr-severity.yml`). Greptile's dashboard is set to review
pull requests by label, so fixes for serious bugs get a review.

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
