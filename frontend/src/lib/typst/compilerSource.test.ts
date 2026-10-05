import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { COMPILER_FILE, COMPILER_INTEGRITY, COMPILER_PACKAGE, COMPILER_VERSION, compileChecked } from "./compilerSource"

// After updating the compiler package, update COMPILER_VERSION and COMPILER_INTEGRITY to match.
test("the compiler loaded from jsDelivr is the installed one", () => {
  const dir = path.resolve("node_modules", COMPILER_PACKAGE)
  expect(JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version).toBe(COMPILER_VERSION)
  const hash = createHash("sha384").update(readFileSync(path.join(dir, COMPILER_FILE))).digest("base64")
  expect(COMPILER_INTEGRITY).toBe(`sha384-${hash}`)
})

describe("downloading the compiler", () => {
  // An empty WebAssembly module with 100 bytes of padding in a custom section.
  const wasm = Buffer.concat([Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 0, 102, 1, 0x78]), Buffer.alloc(100)])
  const integrity = `sha384-${createHash("sha384").update(wasm).digest("base64")}`
  const IDLE_MS = 250
  const quarters = [0, 1, 2, 3].map((i) => wasm.subarray((i * wasm.length) / 4, ((i + 1) * wasm.length) / 4))

  // /whole sends the file, /silent never answers, /stops sends a quarter and
  // stops, and /slow sends a quarter every 0.1 s: 0.4 s in all, longer than
  // the wait, but never a gap that long.
  const server = createServer((req, res) => {
    if (req.url === "/silent") return
    res.writeHead(200, { "Content-Type": "application/wasm" })
    if (req.url === "/whole") res.end(wasm)
    else if (req.url === "/stops") res.write(quarters[0])
    else quarters.forEach((piece, i) => setTimeout(() => (i === 3 ? res.end(piece) : res.write(piece)), (i + 1) * 100))
  })
  let base = ""
  beforeAll(() => new Promise<void>((done) => server.listen(0, "127.0.0.1", () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    done()
  })))
  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  test("compiles the file when it matches", async () => {
    expect(await compileChecked(`${base}/whole`, integrity, IDLE_MS)).toBeInstanceOf(WebAssembly.Module)
  })

  test("refuses a file that doesn't match", async () => {
    const other = `sha384-${createHash("sha384").update("something else").digest("base64")}`
    await expect(compileChecked(`${base}/whole`, other, IDLE_MS)).rejects.toThrow("isn't the expected file")
  })

  test("gives up when the server never answers", async () => {
    await expect(compileChecked(`${base}/silent`, integrity, IDLE_MS)).rejects.toThrow("Nothing arrived")
  })

  test("gives up when the download stops partway", async () => {
    await expect(compileChecked(`${base}/stops`, integrity, IDLE_MS)).rejects.toThrow("Nothing arrived")
  })

  test("waits for a slow download that keeps sending", async () => {
    expect(await compileChecked(`${base}/slow`, integrity, IDLE_MS)).toBeInstanceOf(WebAssembly.Module)
  })
})
