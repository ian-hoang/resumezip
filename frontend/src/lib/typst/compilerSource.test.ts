import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"
import { COMPILER_FILE, COMPILER_INTEGRITY, COMPILER_PACKAGE, COMPILER_VERSION } from "./compilerSource"

// After updating the compiler package, update COMPILER_VERSION and COMPILER_INTEGRITY to match.
test("the compiler loaded from jsDelivr is the installed one", () => {
  const dir = path.resolve("node_modules", COMPILER_PACKAGE)
  expect(JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version).toBe(COMPILER_VERSION)
  const hash = createHash("sha384").update(readFileSync(path.join(dir, COMPILER_FILE))).digest("base64")
  expect(COMPILER_INTEGRITY).toBe(`sha384-${hash}`)
})
