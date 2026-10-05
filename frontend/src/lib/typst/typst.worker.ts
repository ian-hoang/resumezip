// Compiles resumes to PDF with the Typst WebAssembly compiler, off the main
// thread so the editor stays responsive. Talk to it through compile.ts.

import { CompileFormatEnum, createTypstCompiler, type TypstCompiler } from "@myriaddreamin/typst.ts/compiler"
import { loadFonts } from "@myriaddreamin/typst.ts/options.init"
import { ATTACHMENT_NAME } from "@/lib/resumeFile"
import common from "./templates/common.typ"
import ian from "./templates/ian.typ"
import jake from "./templates/jake.typ"
import levelsfyi from "./templates/levelsfyi.typ"
import modernjack from "./templates/modernjack.typ"
import referme from "./templates/referme.typ"
import type { CompileRequest, CompileResponse } from "./compile"

const SOURCES: Record<string, string> = {
  "/common.typ": common,
  "/ian.typ": ian,
  "/jake.typ": jake,
  "/levelsfyi.typ": levelsfyi,
  "/modernjack.typ": modernjack,
  "/referme.typ": referme,
}

// Served from public/fonts. Templates can only use these fonts: Typst's
// default CDN-hosted fonts are disabled so everything is served by this app.
const FONTS = [
  "NewCM10-Regular.otf",
  "NewCM10-Bold.otf",
  "NewCM10-Italic.otf",
  "NewCM10-BoldItalic.otf",
  "Lato-Regular.ttf",
  "Lato-Bold.ttf",
  "Lato-Italic.ttf",
  "Lato-BoldItalic.ttf",
  "texgyreheros-regular.otf",
  "texgyreheros-bold.otf",
  "texgyreheros-italic.otf",
  "texgyreheros-bolditalic.otf",
  "EBGaramond-Regular.ttf",
  "EBGaramond-Bold.ttf",
  "EBGaramond-Italic.ttf",
  "EBGaramond-BoldItalic.ttf",
].map((file) => `/fonts/${file}`)

// Downloads wrap the template in a file that also attaches a copy of the
// resume, so templates don't need to know about it. Checked to leave every
// template's layout exactly as it was.
const withAttachment = (template: string) =>
  `#include "/${template}.typ"
#pdf.attach("/${ATTACHMENT_NAME}", relationship: "source", mime-type: "application/json", description: "This resume's content, so resumezip can open the PDF for editing again")
`

let compiler: Promise<TypstCompiler> | null = null

async function createCompiler(): Promise<TypstCompiler> {
  const instance = createTypstCompiler()
  await instance.init({
    getModule: () =>
      new URL("@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm", import.meta.url),
    beforeBuild: [loadFonts(FONTS, { assets: false })],
  })
  for (const [path, source] of Object.entries(SOURCES)) instance.addSource(path, source)
  return instance
}

function getCompiler(): Promise<TypstCompiler> {
  // Forget a failed start (e.g. a network error) so the next request retries.
  compiler ??= createCompiler().catch((error) => {
    compiler = null
    throw error
  })
  return compiler
}

addEventListener("message", async ({ data: { id, template, data, attachment } }: MessageEvent<CompileRequest>) => {
  let response: CompileResponse
  try {
    const typst = await getCompiler()
    // Nothing is awaited between writing the data and compiling it, so
    // concurrent requests can't see each other's data.
    typst.mapShadow("/resume.json", new TextEncoder().encode(JSON.stringify(data)))
    if (attachment !== undefined) {
      typst.mapShadow(`/${ATTACHMENT_NAME}`, new TextEncoder().encode(attachment))
      typst.addSource("/download.typ", withAttachment(template))
    }
    const { result, diagnostics } = await typst.compile({
      mainFilePath: attachment === undefined ? `/${template}.typ` : "/download.typ",
      format: CompileFormatEnum.pdf,
      diagnostics: "unix",
    })
    response = result ? { id, pdf: result } : { id, error: diagnostics?.join("\n") || "Typst produced no output" }
  } catch (error) {
    response = { id, error: error instanceof Error ? error.message : String(error) }
  }
  postMessage(response)
})
