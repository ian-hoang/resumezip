# Contributing to resumezip

Thanks for helping. resumezip is a resume builder that runs in the browser:
no accounts, no server of its own, and it doesn't store anyone's resume.
Every change has to keep it that way.

## Before you start

- Bugs and small fixes: open a pull request.
- Anything bigger, like a new feature, a new template or a new package:
  open an issue first, or comment on the one that exists, so we agree on it
  before you build it.
- New here? Issues labeled
  [good first issue](https://github.com/ian-hoang/resumezip/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
  are a good place to start. Comment on one to say you're taking it.

## Running it

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

It uses Node 24. There are no accounts, keys or settings to set up.
[`frontend/README.md`](frontend/README.md) explains how the code fits together.

## Making a change

1. Fork the repo and make a branch from `main`. Keep each pull request to one
   change.
2. Run the same checks as CI, in `frontend/`:

   ```bash
   npx tsc --noEmit
   npm run lint
   npx prettier --check .   # npm run format fixes it
   npm test
   npm run build
   npm run test:browser   # the first time: npx playwright install chromium webkit
   ```

3. Open the pull request. If it fixes an issue, write "Closes #" and the
   issue's number in the description, so the issue closes when it merges.
   Add a screenshot for anything you can see.

CI checks every pull request. For a first pull request, it starts once a
maintainer approves the run. A pull request can merge once "Check" and
"Browser tests" pass and the maintainer has reviewed it. Automated reviewers
may also comment. Take them as suggestions; you don't have to answer each one.

## Ground rules

- **We don't store resumes.** They're saved in the browser, and resumezip
  keeps no copy. Don't add analytics, trackers or ads. The app contacts other
  sites to download its PDF engine (from jsDelivr) and to fetch something the
  person asked for, like a paper's details from its DOI. Anything new that
  sends what someone writes to another site is discussed in an issue first.
- **Saved resumes keep working.** Resumes only exist in visitors' browsers
  and in the PDFs they downloaded. If you change how a resume is stored, older
  ones must still open.
- **Templates stay readable by hiring software.** No icons or graphics, and
  contact details and links are printed as text.
  [`frontend/src/lib/typst/README.md`](frontend/src/lib/typst/README.md)
  explains adding a template; each one needs a sample resume and a picture.
- **Words on the site are short and plain.** Write "resumezip" in lower case,
  and don't write how many templates there are, since that keeps changing.
- **New packages are discussed first.** Visitors download whatever the app
  uses.

Checker rules have their own guide:
[`frontend/src/lib/check/README.md`](frontend/src/lib/check/README.md).

## Security

Please report security problems
[privately](https://github.com/ian-hoang/resumezip/security/advisories/new),
not in a public issue.

## License

By contributing, you agree that your work is shared under the
[MIT License](LICENSE), like the rest of resumezip.
