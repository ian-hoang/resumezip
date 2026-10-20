import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { BUDGET_MS, wakeAll } from "@/lib/review/ai/providers"
import { POST } from "./route"

const LINES = [
  { id: "u1", text: "Marcus Bell", bullet: false },
  { id: "u2", text: "Responsible for working on backend services", bullet: true },
]
const NOTES = { notes: [{ tone: "red", line: "u2", quote: "Responsible for", title: "Vague", why: "No result.", suggestion: "Built [X]" }] }

let address = 0
function post(body: unknown = { lines: LINES }, headers: Record<string, string> = {}) {
  address++
  return POST(
    new Request("https://www.tryresumezip.com/api/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://www.tryresumezip.com",
        "x-forwarded-for": `10.0.0.${address}`,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  )
}

const CLAUDE = "api.anthropic.com"
const OPENAI = "api.openai.com"
const AZURE = "example.openai.azure.com"
const GEMINI = "generativelanguage.googleapis.com"

const claudeMessage = (content: unknown[], stopReason: string) =>
  Response.json({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason: stopReason,
    usage: { input_tokens: 1, output_tokens: 1 },
  })

// Each service's answer: Claude's Messages API, or the chat completions API OpenAI and Azure share.
const answered = (url: string, content: unknown) =>
  new URL(url).host === CLAUDE
    ? claudeMessage([{ type: "text", text: JSON.stringify(content) }], "end_turn")
    : Response.json({
        choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      })
const answering =
  (content: unknown = NOTES) =>
  async (url: string | URL | Request) =>
    answered(String(url), content)

const fetched = vi.fn<typeof fetch>()
const asked = () => fetched.mock.calls.map(([url]) => new URL(String(url)).host)

beforeEach(() => {
  wakeAll()
  fetched.mockReset()
  vi.stubGlobal("fetch", fetched)
  vi.stubEnv("AZURE_OPENAI_API_KEY", "azure-key")
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://example.openai.azure.com/")
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.4-mini")
  vi.stubEnv("OPENAI_API_KEY", "openai-key")
  vi.stubEnv("ANTHROPIC_API_KEY", "claude-key")
  vi.stubEnv("GEMINI_API_KEY", "")
  vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test("asks Claude first, with the lines and the answer schema, and hands back its notes", async () => {
  fetched.mockImplementation(answering())
  const response = await post()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ notes: NOTES.notes })
  expect(asked()).toEqual([CLAUDE])
  const [url, init] = fetched.mock.calls[0]
  expect(String(url)).toBe("https://api.anthropic.com/v1/messages")
  expect(new Headers(init!.headers).get("x-api-key")).toBe("claude-key")
  const sent = JSON.parse(init!.body as string)
  expect(sent.model).toBe("claude-sonnet-5-5")
  expect(sent.output_config).toMatchObject({ effort: "low", format: { type: "json_schema" } })
  expect(sent.messages[0].content).toContain("[u2] • Responsible for working on backend services")
})

test.each([
  ["a refusal", () => claudeMessage([], "refusal")],
  [
    "an answer cut off by its token limit, even one that parses",
    () => claudeMessage([{ type: "text", text: JSON.stringify(NOTES) }], "max_tokens"),
  ],
  ["an answer that isn't JSON", () => claudeMessage([{ type: "text", text: "Here are your notes:" }], "end_turn")],
  ["an answer with no text", () => claudeMessage([{ type: "thinking", thinking: "", signature: "x" }], "end_turn")],
])("asks OpenAI when Claude sends %s", async (_, reply) => {
  fetched.mockResolvedValueOnce(reply()).mockImplementation(answering())
  const response = await post()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ notes: NOTES.notes })
  expect(asked()).toEqual([CLAUDE, OPENAI])
})

test("asks OpenAI and then Azure when the ones before are busy, and passes a busy one over for a minute", async () => {
  fetched
    .mockResolvedValueOnce(new Response("Too many requests", { status: 429 }))
    .mockResolvedValueOnce(new Response("down", { status: 500 }))
    .mockImplementation(answering())
  expect((await post()).status).toBe(200)
  expect(asked()).toEqual([CLAUDE, OPENAI, AZURE])
  const sent = JSON.parse(fetched.mock.calls[1][1]!.body as string)
  // The same model as Azure's deployment.
  expect(sent.model).toBe("gpt-5.4-mini")
  expect(sent.response_format.json_schema.strict).toBe(true)
  expect((await post()).status).toBe(200)
  expect(asked().slice(3)).toEqual([AZURE])
})

test("passes a service whose credit has run out over for an hour", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  fetched
    .mockResolvedValueOnce(
      Response.json(
        { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } },
        { status: 400 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json(
        { error: { message: "You exceeded your current quota.", type: "insufficient_quota", code: "insufficient_quota" } },
        { status: 429 },
      ),
    )
    .mockImplementation(answering())
  expect((await post()).status).toBe(200)
  vi.setSystemTime(Date.now() + 30 * 60_000)
  expect((await post()).status).toBe(200)
  expect(asked()).toEqual([CLAUDE, OPENAI, AZURE, AZURE])
  vi.setSystemTime(Date.now() + 31 * 60_000)
  expect((await post()).status).toBe(200)
  expect(asked().slice(4)).toEqual([CLAUDE])
})

test("on npm run dev, asks Gemini first when it has a key, and Azure only when Gemini can't answer", async () => {
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("GEMINI_API_KEY", "gemini-key")
  fetched.mockImplementationOnce(answering())
  expect((await post()).status).toBe(200)
  expect(asked()).toEqual([GEMINI])
  const [url, init] = fetched.mock.calls[0]
  expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")
  expect(new Headers(init!.headers).get("authorization")).toBe("Bearer gemini-key")
  expect(JSON.parse(init!.body as string).model).toBe("gemini-3.5-flash-lite")

  fetched.mockResolvedValueOnce(new Response("Too many requests", { status: 429 })).mockImplementation(answering())
  expect((await post()).status).toBe(200)
  expect(asked().slice(1)).toEqual([GEMINI, AZURE])
})

// Gemini's quota error, as its OpenAI-compatible endpoint sends it: the quota that ran out comes after a long message.
const geminiQuota = (quotaId: string) =>
  Response.json(
    [
      {
        error: {
          code: 429,
          message: `You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. ${"\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, model: gemini-3.5-flash-lite".repeat(3)}`,
          status: "RESOURCE_EXHAUSTED",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId }],
            },
          ],
        },
      },
    ],
    { status: 429 },
  )

test("on npm run dev, passes Gemini over for an hour once its free day is used up, but a minute for a busy minute", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.stubEnv("NODE_ENV", "development")
  vi.stubEnv("GEMINI_API_KEY", "gemini-key")
  fetched
    .mockResolvedValueOnce(geminiQuota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"))
    .mockImplementationOnce(answering())
    .mockImplementationOnce(answering())
    .mockResolvedValueOnce(geminiQuota("GenerateRequestsPerDayPerProjectPerModel-FreeTier"))
    .mockImplementation(answering())
  expect((await post()).status).toBe(200)
  vi.setSystemTime(Date.now() + 2 * 60_000)
  expect((await post()).status).toBe(200)
  expect(asked()).toEqual([GEMINI, AZURE, GEMINI])

  vi.setSystemTime(Date.now() + 2 * 60_000)
  expect((await post()).status).toBe(200)
  vi.setSystemTime(Date.now() + 30 * 60_000)
  expect((await post()).status).toBe(200)
  expect(asked().slice(3)).toEqual([GEMINI, AZURE, AZURE])
})

test("never asks Gemini on the live site, even with a key", async () => {
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("GEMINI_API_KEY", "gemini-key")
  fetched.mockImplementation(answering())
  expect((await post()).status).toBe(200)
  expect(asked()).toEqual([CLAUDE])
})

// The first service answers with an error once `ms` have gone by.
const slowFailure = (ms: number) => async () => {
  vi.setSystemTime(Date.now() + ms)
  return new Response("Gateway timeout", { status: 504 })
}

test("gives OpenAI only the time the function has left after a slow Claude", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  const timeouts = vi.spyOn(AbortSignal, "timeout")
  fetched.mockImplementationOnce(slowFailure(40_000)).mockImplementation(answering())
  expect((await post()).status).toBe(200)
  expect(fetched).toHaveBeenCalledTimes(2)
  const [, openai] = timeouts.mock.calls.map(([ms]) => ms)
  expect(openai).toBeLessThanOrEqual(BUDGET_MS - 40_000)
})

test("doesn't ask OpenAI when too little time is left to answer, and says it's busy", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  fetched.mockImplementationOnce(slowFailure(50_000)).mockImplementation(answering())
  const response = await post()
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: "busy" })
  expect(fetched).toHaveBeenCalledTimes(1)
})

test("a request turned away for its lines doesn't count toward the limit", async () => {
  fetched.mockImplementation(answering())
  const from = (body: unknown) => post(body, { "x-forwarded-for": "10.8.8.8" })
  for (let tried = 0; tried < 6; tried++) expect((await from({ lines: [] })).status).toBe(400)
  for (let review = 0; review < 6; review++) expect((await from({ lines: LINES })).status).toBe(200)
  expect((await from({ lines: LINES })).status).toBe(429)
})

test("says it's busy when no service answers", async () => {
  fetched.mockImplementation(async () => new Response("down", { status: 500 }))
  const response = await post()
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: "busy" })
})

test("turns away another site's pages, what the page wouldn't send, and too many reviews from one address", async () => {
  fetched.mockImplementation(answering())
  expect((await post(undefined, { origin: "https://elsewhere.example" })).status).toBe(403)
  expect((await post({ lines: [{ id: "x", text: "Hi", bullet: false }] })).status).toBe(400)
  expect((await post({ lines: Array.from({ length: 400 }, (_, index) => ({ id: `u${index}`, text: "a", bullet: false })) })).status).toBe(
    400,
  )
  expect(fetched).not.toHaveBeenCalled()

  const again = () => post(undefined, { "x-forwarded-for": "10.9.9.9" })
  for (let review = 0; review < 6; review++) expect((await again()).status).toBe(200)
  expect((await again()).status).toBe(429)
})

test("is off without keys", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "")
  vi.stubEnv("AZURE_OPENAI_API_KEY", "")
  vi.stubEnv("OPENAI_API_KEY", "")
  expect((await post()).status).toBe(503)
  expect(fetched).not.toHaveBeenCalled()
})
