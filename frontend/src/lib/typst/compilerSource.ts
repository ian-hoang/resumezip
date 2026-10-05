// The Typst compiler is a 28 MB WebAssembly file, the biggest thing the editor
// downloads. It's loaded from jsDelivr, which serves npm packages from a global
// CDN, compressed and cached for a year, and checked against its hash so a
// changed file is refused. typst.worker.ts falls back to the copy bundled with
// the app if jsDelivr can't be reached.

export const COMPILER_PACKAGE = "@myriaddreamin/typst-ts-web-compiler"
export const COMPILER_VERSION = "0.7.0"
export const COMPILER_FILE = "pkg/typst_ts_web_compiler_bg.wasm"
export const COMPILER_CDN_URL = `https://cdn.jsdelivr.net/npm/${COMPILER_PACKAGE}@${COMPILER_VERSION}/${COMPILER_FILE}`

/** The file's SHA-384, for subresource integrity. compilerSource.test.ts checks it against the installed package. */
export const COMPILER_INTEGRITY = "sha384-YB32Rpk4pOvEGytOZweRBgdbuwNueLVpzJUQojjit/A8AveMWxDW8eT9ROz98jDo"
