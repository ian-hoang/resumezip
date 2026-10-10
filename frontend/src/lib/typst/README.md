# Resume PDFs (Typst)

Resumes are compiled to PDF entirely in the browser with [Typst](https://typst.app)
via [typst.ts](https://github.com/Myriad-Dreamin/typst.ts). Nothing is sent to a
server to build a PDF.

- `resumeData.ts` maps the editor's resume data to the JSON the templates read.
  Existing section arrays keep their original shape. The profile's summary is
  `summary`, paragraphs every template prints under "Summary" above the
  sections. Text and list sections a person adds are mapped into `extras`,
  keyed by their `extra:<id>` ordering reference. Empty bodies have no printable descriptor.
  Prose stays literal; custom lists use the existing bold/italic bullet runs.
- `compile.ts` is what the UI calls. It runs the compiler in a Web Worker, and
  replaces the worker if it goes quiet with work to do: 30 s while the compiler
  and fonts download (each bit that arrives counts, so slow connections finish),
  20 s once it has loaded, or at once if the compiler breaks. The worker also
  checks in as each slow step starts (building the compiler, each compile), so
  the limit applies to one step at a time. Previews compile one at a time:
  while one runs, only the newest waits, and downloads never wait behind them. Failures say why
  (`PdfFailure`), so the page can say what to do. `loadCompiler` starts the
  download before the first PDF: "Start writing" links call it as a mouse
  rests on one or presses it (template pictures only on a press), a moment
  before the click; the editor calls it at once; and the dashboard after a
  second. On a computer, the home page calls `prefetchCompiler` a second
  after it has loaded, which only downloads the compiler, so it's in hand
  when someone starts writing (`src/components/home/PrefetchCompiler.tsx`);
  phones and tablets may be on metered data, so they skip it. Visitors
  saving data only get it once they open a resume. A new worker also opens
  the connection to jsDelivr while its own script loads.
  `compilerStatus` says how much of the compiler has arrived, which the
  preview's stand-in page shows (`src/components/editor/PrintingPage.tsx`).
  Once it all has, the preview fetches pdf.js's worker, which is otherwise
  only downloaded after the first PDF is made.
- `typst.worker.ts` loads the WebAssembly compiler and the templates once, and
  compiles each request. Before compiling, it downloads the fonts that resume
  needs (see [Fonts](#fonts)), alongside the compiler the first time. Downloads also attach a copy of the resume to the PDF
  (see `src/lib/resumeFile.ts` and `src/lib/import/README.md`).
- `fontFiles.ts` lists the fonts, says which ones a resume needs, and gives
  them to the compiler.
- `templates/*.typ` are the resume templates (the first ones were ported from LaTeX).
  `common.typ` has the shared helpers. They are bundled as strings (see the
  `.typ` rule in `next.config.js`).
  Every template handles `extras` in its order loop with its own section and
  bullet styles. `extra-body` shares only new-kind content formatting;
  paragraphs remain breakable across pages. Omitted
  sections, entries and bullet lines never reach the template data.

## Adding a template

1. Add `templates/<id>.typ`, importing `common.typ` for the data and helpers.
2. Import it in `typst.worker.ts` and add it to `SOURCES`.
3. Add it to `TEMPLATES` in `src/lib/templates.ts` with a picture of its first
   page in `public/previews/<id>.webp` (1280 px wide, from the editor's
   preview), made from its own sample resume in `preview-samples/<id>.json`,
   and its `font`: the family its `#set text(font: ...)` names, which is
   downloaded before its first PDF. A test checks the two match. When it
   uses only some of its family's weights, name those as `weights`, so it
   downloads no more than it prints with.
   Every page that lists templates reads that list.

Templates can only use the fonts in `fonts/`, listed in `fontFiles.ts`. They're
bundled rather than kept in `public/`, so browsers can cache them for good: each
is served under a name with its content's hash, which changes when the font does.

## Fonts

| Files | Font | Source | License |
| --- | --- | --- | --- |
| `NewCM10-*.otf` | New Computer Modern | [typst-assets](https://github.com/typst/typst-assets) | GUST Font License |
| `Lato-*.ttf` | Lato | [Google Fonts](https://fonts.google.com/specimen/Lato) | SIL Open Font License 1.1 |
| `texgyreheros-*.otf` | TeX Gyre Heros | [CTAN](https://ctan.org/pkg/tex-gyre) | GUST Font License |
| `EBGaramond-*.ttf` | EB Garamond | [EBGaramond12](https://github.com/octaviopardo/EBGaramond12) | SIL Open Font License 1.1 |
| `CharisSIL-*.ttf` | Charis SIL | [Google Fonts](https://fonts.google.com/specimen/Charis+SIL) | SIL Open Font License 1.1 |
| `IBMPlexMono-*.ttf` | IBM Plex Mono | [Google Fonts](https://fonts.google.com/specimen/IBM+Plex+Mono) | SIL Open Font License 1.1 |
| `SourceSans3-*.ttf` | Source Sans 3 | [Google Fonts](https://fonts.google.com/specimen/Source+Sans+3) | SIL Open Font License 1.1 |
| `Raleway-v4020-*.otf` | Raleway, as "Raleway-v4020" | [Raleway v4.020](https://github.com/impallari/Raleway) | SIL Open Font License 1.1 |

The compiler knows every font from the start, from what `fonts/info.json` says
about each (its family, style, which characters it has and a hash of the
file), but only reads a font when it prints with it. So a resume downloads its
template's family, and, for any character that family lacks, every font that
has it: Typst picks one of those for that character, just as it would with
every font loaded, so resumes print exactly as they would with all of them.
`fontFiles.test.ts` prints each template's sample, and text in many scripts,
both ways to check. After adding or changing a font, write `info.json` again:

```bash
UPDATE_FONT_INFO=1 npx vitest run src/lib/typst/fontFiles.test.ts
```

New Computer Modern, TeX Gyre Heros and EB Garamond are trimmed copies: Latin
(with Vietnamese), Greek, Cyrillic, punctuation, currency and common symbols,
keeping kerning, ligatures, accents and small caps, without hinting. That halves
their size. Each trimmed font says so in its description (name ID 10), as the
GUST Font License asks. The rest are left as they were, because their licenses
reserve their names ("Lato", "Charis" and "SIL", "Plex", "Source", "Raleway")
for unmodified copies. Raleway comes from its own project rather than Google
Fonts, as the copies Google Fonts serves have no small capitals.

Resumes printed with the trimmed fonts are identical to ones printed with the
originals. To trim a new font the same way, with
[fontTools](https://github.com/fonttools/fonttools) installed:

```bash
pyftsubset FONT --output-file=src/lib/typst/fonts/FONT --no-hinting --notdef-outline \
  --name-IDs='*' --name-languages='*' --name-legacy \
  --layout-features=kern,liga,clig,calt,ccmp,locl,mark,mkmk,rlig,smcp,c2sc \
  --unicodes=U+0000-024F,U+02B0-036F,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-218F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2713-2717,U+FB00-FB06
```

`--name-legacy` matters: some fonts, like TeX Gyre Heros, only carry the
family name Typst looks for in their older name records.

