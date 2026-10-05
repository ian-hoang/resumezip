import { describe, expect, test } from "vitest"
import { cleanLink } from "./lines"

describe("cleanLink", () => {
  test("drops what pdf.js adds to a LaTeX link written without https://", () => {
    expect(cleanLink("www.linkedin.com/in/someone/.pdf#[0,{\"name\":\"Fit\"}]")).toBe("www.linkedin.com/in/someone")
    expect(cleanLink("http://www.linkedin.com/in/someone/.pdf#[0,{%22name%22:%22Fit%22}]")).toBe("http://www.linkedin.com/in/someone")
  })

  test("leaves real links alone, including links to PDFs", () => {
    expect(cleanLink("https://github.com/someone")).toBe("https://github.com/someone")
    expect(cleanLink("https://example.com/paper.pdf#page=2")).toBe("https://example.com/paper.pdf#page=2")
    expect(cleanLink("mailto:someone@example.com")).toBe("mailto:someone@example.com")
  })
})
