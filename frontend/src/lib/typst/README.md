# Resume PDFs (Typst)

Resumes are compiled to PDF entirely in the browser with [Typst](https://typst.app)
via [typst.ts](https://github.com/Myriad-Dreamin/typst.ts). Nothing is sent to a
server to build a PDF.

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
   preview), made from its own sample resume in `preview-samples/<id>.json`.
   Every page that lists templates reads that list.

Templates can only use the fonts in `public/fonts`, listed in `typst.worker.ts`.

## Fonts

| Files | Font | Source | License |
| --- | --- | --- | --- |
| `NewCM10-*.otf` | New Computer Modern | [typst-assets](https://github.com/typst/typst-assets) | GUST Font License |
| `Lato-*.ttf` | Lato | [Google Fonts](https://fonts.google.com/specimen/Lato) | SIL Open Font License 1.1 |
| `texgyreheros-*.otf` | TeX Gyre Heros | [CTAN](https://ctan.org/pkg/tex-gyre) | GUST Font License |
| `EBGaramond-*.ttf` | EB Garamond | [EBGaramond12](https://github.com/octaviopardo/EBGaramond12) | SIL Open Font License 1.1 |

The editor downloads every font when it starts, so all but Lato are trimmed
copies: Latin (with Vietnamese), Greek, Cyrillic, punctuation, currency and
common symbols, keeping kerning, ligatures, accents and small caps, without
hinting. That halves their size. Each trimmed font says so in its description
(name ID 10), as the GUST Font License asks. Lato is left as it was, because
its license reserves the name "Lato" for unmodified copies.

Resumes printed with the trimmed fonts are identical to ones printed with the
originals. To trim a new font the same way, with
[fontTools](https://github.com/fonttools/fonttools) installed:

```bash
pyftsubset FONT --output-file=public/fonts/FONT --no-hinting --notdef-outline \
  --name-IDs='*' --name-languages='*' --name-legacy \
  --layout-features=kern,liga,clig,calt,ccmp,locl,mark,mkmk,rlig,smcp,c2sc \
  --unicodes=U+0000-024F,U+02B0-036F,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-218F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2713-2717,U+FB00-FB06
```

`--name-legacy` matters: some fonts, like TeX Gyre Heros, only carry the
family name Typst looks for in their older name records.

