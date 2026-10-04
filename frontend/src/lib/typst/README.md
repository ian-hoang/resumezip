# Resume PDFs (Typst)

Resumes are compiled to PDF entirely in the browser with [Typst](https://typst.app)
via [typst.ts](https://github.com/Myriad-Dreamin/typst.ts). Nothing is sent to a
server to build a PDF. (`backend/`, the old Go + LaTeX + S3 service, is no longer
used.)

- `resumeData.ts` maps the editor's resume data to the JSON the templates read.
- `compile.ts` is what the UI calls. It runs the compiler in a Web Worker.
- `typst.worker.ts` loads the WebAssembly compiler, fonts and templates once and
  compiles each request. Downloads also attach a copy of the resume to the PDF
  (see `src/lib/resumeFile.ts` and `src/lib/import/README.md`).
- `templates/*.typ` are the resume templates (the first ones were ported from LaTeX).
  `common.typ` has the shared helpers. They are bundled as strings (see the
  `.typ` rule in `next.config.js`).

## Adding a template

1. Add `templates/<id>.typ`, importing `common.typ` for the data and helpers.
2. Import it in `typst.worker.ts` and add it to `SOURCES`.
3. Add it to `TEMPLATES` in `src/lib/templates.ts` with a picture of its first
   page in `public/previews/<id>.webp` (1280 px wide, from the editor's
   preview). They all show the sample resume in `preview-sample.json`, so
   they're easy to compare. Every page that lists templates reads that list.

Templates can only use the fonts in `public/fonts`, listed in `typst.worker.ts`.

## Fonts

| Files | Font | Source | License |
| --- | --- | --- | --- |
| `NewCM10-*.otf` | New Computer Modern | [typst-assets](https://github.com/typst/typst-assets) | GUST Font License |
| `Lato-*.ttf` | Lato | [Google Fonts](https://fonts.google.com/specimen/Lato) | SIL Open Font License 1.1 |
| `texgyreheros-*.otf` | TeX Gyre Heros | [CTAN](https://ctan.org/pkg/tex-gyre) | GUST Font License |

