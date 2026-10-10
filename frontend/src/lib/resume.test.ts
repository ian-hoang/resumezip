import { describe, expect, test } from "vitest"
import { cleanTag, MAX_TAG_LENGTH } from "./resume"

describe("cleanTag", () => {
  test("turns a default type's name, in any case, into its id", () => {
    expect(cleanTag("Academic")).toBe("academic")
    expect(cleanTag(" PERSONAL ")).toBe("personal")
    expect(cleanTag("professional")).toBe("professional")
  })

  test("keeps a type of the person's own as written, tidied and cut to length", () => {
    expect(cleanTag("  Data   roles ")).toBe("Data roles")
    expect(cleanTag("a".repeat(MAX_TAG_LENGTH + 10))).toHaveLength(MAX_TAG_LENGTH)
  })

  test("is empty when there's nothing but spaces", () => {
    expect(cleanTag("   ")).toBe("")
  })
})
