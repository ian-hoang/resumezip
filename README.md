<a href="https://www.tryresumezip.com">
  <img src=".github/assets/banner.webp" width="100%" alt="resumezip: Make the resume that gets you the interview. The editor, with a resume's sections and fields on the left and its live PDF on the right, rising out of a meadow">
</a>

<p align="center">
  <b>resumezip is a free, open-source resume builder that runs in your browser.</b><br>
  Write your resume, see what a recruiter would skip, and download it. No account.
</p>

<p align="center">
  <a href="https://www.tryresumezip.com"><b>Start writing</b></a>
  &nbsp;·&nbsp;
  <a href="https://www.tryresumezip.com/templates">Templates</a>
  &nbsp;·&nbsp;
  <a href="https://www.tryresumezip.com/review">Review a resume</a>
  &nbsp;·&nbsp;
  <a href="#run-it-yourself">Run it yourself</a>
</p>

<p align="center">
  <a href="https://github.com/ian-hoang/resumezip/actions/workflows/ci.yml"><img src="https://github.com/ian-hoang/resumezip/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e5be6" alt="MIT license"></a>
  <a href="https://github.com/ian-hoang/resumezip/stargazers"><img src="https://img.shields.io/github/stars/ian-hoang/resumezip?style=flat&color=2e5be6" alt="GitHub stars"></a>
</p>

<br>

### Write next to the page you'll send

The page on the right is the PDF you'll download, and it changes as you type. Drag sections into any order, add your own, and leave out what doesn't fit this job. Bullets take bold and italic. Paste a paper's DOI or arXiv link and its citation fills itself in. The Style tab sets text size, spacing, margins and paper size, and can keep it all to one page.

<p align="center">
  <img src=".github/assets/write.webp" width="80%" alt="The editor: the resume's sections on the left, the Profile fields in the middle, and the live PDF on the right">
</p>

### Find what to fix before you send it

The Check tab scores the resume out of 100 the way applicant tracking systems read it, and marks each problem on the page: bullets with no result, dates missing or out of order, a section left out, a typo. It all runs in your browser. Ask for AI notes when you want a second read.

<p align="center">
  <img src=".github/assets/check.webp" width="55%" alt="The Check tab: an ATS score of 98 out of 100, Strong, with the checks listed and their problems circled and underlined on the page">
</p>

### See it the way a recruiter does

Drop any resume, PDF or Word, on the [review page](https://www.tryresumezip.com/review). You get the ATS check, the red flags a recruiter would trip on and what's done well, marked on the page. **Fix it in the editor** opens it as a resume you can change.

<img src=".github/assets/review.webp" width="100%" alt="A review: ATS checks Ready, 2 red flags, 7 things done well, and the flags Three jobs in one and Too featurey">

### Pick a template, change it any time

Every template is free, and switching keeps your words. Each one is tested by printing its sample and [reading it back as plain text](frontend/src/lib/import/readsCleanly.test.ts), the way hiring software does.

<table>
  <tr>
    <td align="center"><a href="https://www.tryresumezip.com/templates/jakes"><img src="frontend/public/previews/jakes-resume-template.webp" width="190" alt="Jake's resume template: a sample one-page resume"></a><br>Jake's</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/modern-jakes"><img src="frontend/public/previews/modern-jakes-resume-template.webp" width="190" alt="Modern Jake's resume template: a sample one-page resume"></a><br>Modern Jake's</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/blueprint"><img src="frontend/public/previews/blueprint-resume-template.webp" width="190" alt="Blueprint resume template: a sample one-page resume"></a><br>Blueprint</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/compact"><img src="frontend/public/previews/compact-resume-template.webp" width="190" alt="Compact resume template: a sample one-page resume"></a><br>Compact</td>
  </tr>
  <tr>
    <td align="center"><a href="https://www.tryresumezip.com/templates/ians"><img src="frontend/public/previews/ians-resume-template.webp" width="190" alt="Ian's resume template: a sample one-page resume"></a><br>Ian's</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/harvard"><img src="frontend/public/previews/harvard-resume-template.webp" width="190" alt="Harvard resume template: a sample one-page resume"></a><br>Harvard</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/margin"><img src="frontend/public/previews/margin-resume-template.webp" width="190" alt="Margin resume template: a sample one-page resume"></a><br>Margin</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/swiss"><img src="frontend/public/previews/swiss-resume-template.webp" width="190" alt="Swiss resume template: a sample one-page resume"></a><br>Swiss</td>
  </tr>
  <tr>
    <td align="center"><a href="https://www.tryresumezip.com/templates/mono"><img src="frontend/public/previews/mono-resume-template.webp" width="190" alt="Mono resume template: a sample one-page resume"></a><br>Mono</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/accent"><img src="frontend/public/previews/accent-resume-template.webp" width="190" alt="Accent resume template: a sample one-page resume"></a><br>Accent</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/deedy"><img src="frontend/public/previews/deedy-resume-template.webp" width="190" alt="Deedy resume template: a sample one-page resume"></a><br>Deedy</td>
    <td align="center"><a href="https://www.tryresumezip.com/templates/zero2sudo"><img src="frontend/public/previews/zero2sudo-resume-template.webp" width="190" alt="zero2sudo resume template: a sample one-page resume"></a><br>zero2sudo</td>
  </tr>
  <tr>
    <td align="center" valign="middle" colspan="4"><a href="https://www.tryresumezip.com/templates"><b>See them all →</b></a></td>
  </tr>
</table>

### Download it however you need it

<table>
  <tr>
    <td width="44%" valign="top"><img src=".github/assets/download.webp" width="100%" alt="The Download PDF menu open: Word, LaTeX, Save to Google Drive, JSON and Share PDF"></td>
    <td valign="top">
      <b>PDF</b><br>
      For sending. Your resume is tucked inside it, so it opens again in resumezip exactly as you left it.<br><br>
      <b>Word</b><br>
      To edit in Word, Google Docs or Pages. It opens again too, until another app saves it.<br><br>
      <b>LaTeX</b><br>
      To edit on Overleaf, laid out like your PDF.<br><br>
      <b>JSON</b><br>
      A backup with everything, even what the PDF leaves out.<br><br>
      <b>Google Drive</b><br>
      Puts the PDF in your Drive. Google asks you first.
    </td>
  </tr>
</table>

### Keep every version

The dashboard holds every resume you've made in this browser. Search them, tag them, duplicate one for a new job, and undo a delete. **Open a file** reads in a PDF or Word resume made anywhere else and sorts it into fields for you to check. **Download all** backs everything up in one file.

<img src=".github/assets/dashboard.webp" width="100%" alt="The dashboard: four resumes in different templates, with search, tags, Open a file and New resume">

## Where your resume goes

Nowhere, unless you send it. resumezip has no accounts and no analytics, and keeps no copy of your resume.

| What | Where it happens |
| --- | --- |
| Your resumes | Saved in this browser's storage. That's the only copy. |
| Past reviews | Kept in this browser, with the file you reviewed: the latest 20 |
| Making the PDF | On your device, with [Typst](https://typst.app) running as WebAssembly |
| Spelling and grammar | On your device, with [Harper](https://github.com/Automattic/harper) |
| Opening a PDF or Word file | On your device. Nothing is uploaded. |
| AI notes, for a resume you review on the review page or ask about in the editor | Its text goes through resumezip's one server function to Claude, run by Anthropic, or GPT, run by OpenAI or Microsoft Azure. We don't keep it. |

The only other requests: the PDF engine and the spelling checker download from [jsDelivr](https://www.jsdelivr.com) (files only, nothing of yours goes with them), Save to Google Drive talks to Google when you choose it, and adding a paper by its DOI or link asks [Crossref](https://www.crossref.org) or [doi.org](https://www.doi.org) for its details.

> [!NOTE]
> Safari deletes a site's data after seven days of Safari use without a visit. That's the cost of having no accounts: in Safari, keep your downloaded PDF. It opens again as an editable resume.

<details>
<summary><b>Questions</b></summary>
<br>

**Is it really free?**
Yes. Every template and every download. No ads, no trial, no watermark.

**How do I edit it later, or on another computer?**
Open the PDF you downloaded from the dashboard: resumezip reads your resume back out of it. A JSON backup opens the same way.

**Will hiring software be able to read it?**
Yes. The PDF is real text, not a picture, with no icons or graphics, and its links and contact details are printed as text.

</details>

## How it's built

- **Templates** are [Typst](https://typst.app) files (`frontend/src/lib/typst/templates`), compiled in a Web Worker by [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) so typing stays smooth.
- **Every PDF carries its resume** as an attachment, which is how it opens again exactly.
- **The importer** reads PDFs from anywhere with [pdf.js](https://mozilla.github.io/pdf.js/) and Word files with [mammoth](https://github.com/mwilliamson/mammoth.js), and sorts what it finds into fields.
- **The checker** is a set of fixed rules, plus [Harper](https://github.com/Automattic/harper) for spelling and grammar, all in the browser.
- **AI notes** are the one thing that runs on a server: a function (`frontend/src/app/api/review`) passes a resume's printed text to an AI service and hands back its notes, keeping nothing.

## Run it yourself

You need Node 24.

```bash
git clone https://github.com/ian-hoang/resumezip.git
cd resumezip/frontend
npm install
npm run dev   # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests, including rendering every template and reading it back |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (CI checks it) |
| `npm run build` | A production build |
| `npm run test:browser` | Browser tests in Chromium and WebKit, after a build |

<details>
<summary><b>Where things live</b></summary>
<br>

```
frontend/
├── src/app/                  pages: home, templates, editor, dashboard, review
├── src/app/api/review/       the one server function: AI notes
├── src/components/editor/    the editor: Write, Check and Style, the preview
├── src/lib/typst/            PDF engine, templates and fonts
├── src/lib/import/           opening PDF and Word files
├── src/lib/check/            the resume checker
├── src/lib/latex/            the LaTeX download
└── e2e/                      browser tests
```

[`frontend/README.md`](frontend/README.md) explains how it fits together, and [`frontend/src/lib/typst/README.md`](frontend/src/lib/typst/README.md) covers adding a template.

</details>

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/ian-hoang/resumezip/issues/new/choose). Pull requests are welcome: [CONTRIBUTING.md](CONTRIBUTING.md) covers the checks to run and the few rules every change follows. In short, we don't store resumes, saved resumes keep working, and templates stay readable by hiring software.

Please [report security problems privately](https://github.com/ian-hoang/resumezip/security/advisories/new).

## License

[MIT](LICENSE) © Ian Hoang. The fonts in `frontend/src/lib/typst/fonts` keep their own licenses, listed in [`frontend/src/lib/typst/README.md`](frontend/src/lib/typst/README.md#fonts).

<p align="center">
  <br>
  If resumezip helped you land something, a <a href="https://github.com/ian-hoang/resumezip/stargazers">⭐ on GitHub</a> helps other people find it.
</p>
