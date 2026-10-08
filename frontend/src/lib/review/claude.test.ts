import type Anthropic from "@anthropic-ai/sdk"
import { describe, expect, test } from "vitest"
import { ReviewFailed, resumeText, reviewResume } from "./claude"
import type { ReviewRequest } from "./review"

const request: ReviewRequest = {
  type: "professional",
  pieces: [
    { id: "t1", where: "Experience → Amazon · bullet 1", text: "Grew subscriptions\nby 18%." },
    { id: "t2", where: "Experience → Amazon · bullet 2", text: "Used Trello to organize tasks." },
  ],
}

// A stand-in for the SDK's client that answers with `message`, and keeps what it was asked.
function answering(message: Partial<Anthropic.Beta.BetaMessage>) {
  const asked: unknown[] = []
  const client = {
    beta: {
      messages: {
        create: async (params: unknown) => {
          asked.push(params)
          return { stop_reason: "end_turn", content: [], ...message }
        },
      },
    },
  } as unknown as Anthropic
  return { client, asked }
}

const text = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] }) as unknown as Partial<Anthropic.Beta.BetaMessage>

describe("asking Claude for a review", () => {
  test("sends the resume as data, one piece a line", () => {
    expect(resumeText(request)).toBe(
      "<resume>\n[t1] Experience → Amazon · bullet 1: Grew subscriptions by 18%.\n[t2] Experience → Amazon · bullet 2: Used Trello to organize tasks.\n</resume>",
    )
    expect(resumeText({ ...request, type: "academic" })).toMatch(/^It's an academic CV.+\n\n<resume>/)
  })

  test("asks for structured notes, with a fallback if it's declined, and keeps the ones on the resume", async () => {
    const { client, asked } = answering(
      text({
        highlights: [{ id: "t1", quote: "subscriptions by 18%", note: "Growth, in numbers." }],
        redFlags: [
          { id: "t2", quote: "Used Trello", note: "Nobody hires you for Trello." },
          { id: "t2", quote: "Led a team", note: "Not on the resume." },
        ],
      }),
    )
    expect(await reviewResume(client, request)).toEqual({
      highlights: [{ id: "t1", quote: "subscriptions\nby 18%", note: "Growth, in numbers." }],
      redFlags: [{ id: "t2", quote: "Used Trello", note: "Nobody hires you for Trello." }],
    })
    expect(asked[0]).toMatchObject({
      model: "claude-opus-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: { type: "json_schema" } },
    })
  })

  test("fails when there's no review to read", async () => {
    for (const message of [{ stop_reason: "refusal" }, { stop_reason: "max_tokens" }, { content: [{ type: "text", text: "{" }] }] as const) {
      const { client } = answering(message as Partial<Anthropic.Beta.BetaMessage>)
      await expect(reviewResume(client, request)).rejects.toBeInstanceOf(ReviewFailed)
    }
  })
})
