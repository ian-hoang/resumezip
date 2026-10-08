import { expect, test } from "vitest"
import { limiter } from "./limit"

test("allows a few requests in each window, and says how long until the next", () => {
  let now = 0
  const limit = limiter(
    [
      { ms: 60_000, max: 2 },
      { ms: 600_000, max: 3 },
    ],
    () => now,
  )
  expect(limit.take("a")).toEqual({ allowed: true })
  now = 10_000
  expect(limit.take("a")).toEqual({ allowed: true })
  expect(limit.take("a")).toEqual({ allowed: false, retryAfter: 50 })
  // Someone else is counted on their own.
  expect(limit.take("b")).toEqual({ allowed: true })

  // A minute after the first, one more, then the longer window is full.
  now = 60_000
  expect(limit.take("a")).toEqual({ allowed: true })
  now = 130_000
  expect(limit.take("a")).toEqual({ allowed: false, retryAfter: 470 })
  now = 600_000
  expect(limit.take("a")).toEqual({ allowed: true })
})
