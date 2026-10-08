// The AI review (lib/review): the editor sends a resume's text here when the
// person asks for feedback, and this asks Claude. The text is passed on and
// forgotten: it isn't logged or kept, and errors are logged without it.

import Anthropic from "@anthropic-ai/sdk"
import { ReviewFailed, reviewResume } from "@/lib/review/claude"
import { limiter } from "@/lib/review/limit"
import { LIMITS, readRequest } from "@/lib/review/review"

// A review takes Claude a while; past this the host ends the function.
export const maxDuration = 120

const limit = limiter()

const reply = (body: object, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })

// Who's asking, as far as the host can tell, for counting requests.
const sender = (request: Request) =>
  request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

// Asked from the site itself, as browsers say for every POST from a page.
function fromSite(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  // Without a key, as when running it yourself, there's no AI review.
  if (!process.env.ANTHROPIC_API_KEY) return reply({ error: "unavailable" }, 503)
  if (!fromSite(request)) return reply({ error: "forbidden" }, 403)

  // Too long to read, by what it says, then by what it is.
  if (Number(request.headers.get("content-length")) > LIMITS.body) return reply({ error: "too long" }, 413)
  const text = await request.text()
  if (new TextEncoder().encode(text).length > LIMITS.body) return reply({ error: "too long" }, 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return reply({ error: "bad request" }, 400)
  }
  const review = readRequest(body)
  if (!review) return reply({ error: "bad request" }, 400)

  const allowed = limit.take(sender(request))
  if (!allowed.allowed) return reply({ error: "busy" }, 429, { "Retry-After": String(allowed.retryAfter) })

  try {
    // The SDK's own retries and time limit fit inside maxDuration.
    const client = new Anthropic({ maxRetries: 1, timeout: 55_000 })
    return reply(await reviewResume(client, review, request.signal))
  } catch (error) {
    if (error instanceof ReviewFailed) {
      console.warn("AI review: no review:", error.message)
      return reply({ error: "no review" }, 502)
    }
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("AI review: rate limited by the API")
      return reply({ error: "busy" }, 429, { "Retry-After": "60" })
    }
    if (error instanceof Anthropic.APIError) {
      // Its message is the API's, never the resume.
      console.error(`AI review: API error ${error.status}: ${error.message}`)
      return reply({ error: "unavailable" }, 503)
    }
    console.error("AI review failed:", error instanceof Error ? error.name : "unknown error")
    return reply({ error: "failed" }, 500)
  }
}
