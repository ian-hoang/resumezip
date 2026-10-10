import { describe, expect, test } from "vitest"
import { answerIn, DRIVE_FILE_SCOPE, DriveError, GOOGLE_CLIENT_ID, signInUrl, uploadPdf } from "./googleDrive"

describe("signInUrl", () => {
  test("asks Google for a token for the files resumezip saves, back to this site's signed-in page", () => {
    const url = new URL(signInUrl("https://www.tryresumezip.com", "state-1"))
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: "https://www.tryresumezip.com/google-drive",
      response_type: "token",
      scope: DRIVE_FILE_SCOPE,
      state: "state-1",
    })
  })
})

describe("answerIn", () => {
  test("reads Google's token, how long it lasts, and the sign-in it's for", () => {
    const fragment = `#state=state-1&access_token=ya29.token&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(DRIVE_FILE_SCOPE)}`
    expect(answerIn(fragment)).toEqual({ state: "state-1", token: "ya29.token", expiresIn: 3599 })
  })

  test("takes a token without a time as lasting an hour", () => {
    expect(answerIn("#state=s&access_token=t")).toEqual({ state: "s", token: "t", expiresIn: 3600 })
  })

  test("reads why there's no token", () => {
    expect(answerIn("#error=access_denied&state=s")).toEqual({ state: "s", error: "access_denied" })
    expect(answerIn("#error=server_error&state=s")).toEqual({ state: "s", error: "server_error" })
  })

  test("counts a token without the Drive scope, which the person can untick, as declined", () => {
    expect(answerIn("#state=s&access_token=t&scope=openid")).toEqual({ state: "s", error: "access_denied" })
  })

  test("isn't an answer without the sign-in it's for", () => {
    expect(answerIn("")).toBeNull()
    expect(answerIn("#access_token=t")).toBeNull()
  })
})

/** A stand-in for fetch that answers once, and notes what was asked. */
function fakeFetch(answer: Response | Error) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    requests.push({ url, init })
    if (answer instanceof Error) throw answer
    return answer
  }) as unknown as typeof fetch
  return { fetcher, requests }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const pdf = new File(["%PDF-1.7 the resume"], "Ada's resume.pdf", { type: "application/pdf" })
const failureOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "saved",
    (error) => (error instanceof DriveError ? error.failure : error),
  )

describe("uploadPdf", () => {
  test("sends the PDF under its name with the token alone, and gives back the address that opens it", async () => {
    const link = "https://drive.google.com/file/d/abc/view?usp=drivesdk"
    const { fetcher, requests } = fakeFetch(json({ id: "abc", webViewLink: link }))
    expect(await uploadPdf("ya29.token", pdf, fetcher)).toBe(link)

    const [{ url, init }] = requests
    expect(url).toBe("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink")
    expect(init).toMatchObject({ method: "POST", credentials: "omit", referrerPolicy: "no-referrer" })
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer ya29.token")
    const boundary = headers["Content-Type"].match(/^multipart\/related; boundary=(\S+)$/)![1]
    const parts = (await (init.body as Blob).text()).split(`--${boundary}`)
    expect(parts).toEqual([
      "",
      `\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"Ada's resume.pdf","mimeType":"application/pdf"}\r\n`,
      "\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7 the resume\r\n",
      "--",
    ])
  })

  test("says why Drive didn't take it", async () => {
    const quota = { error: { code: 403, errors: [{ reason: "storageQuotaExceeded" }] } }
    expect(await failureOf(uploadPdf("t", pdf, fakeFetch(new TypeError("Failed to fetch")).fetcher))).toBe("offline")
    expect(await failureOf(uploadPdf("t", pdf, fakeFetch(json({ error: { code: 401 } }, 401)).fetcher))).toBe("signed-out")
    expect(await failureOf(uploadPdf("t", pdf, fakeFetch(json(quota, 403)).fetcher))).toBe("full")
    expect(await failureOf(uploadPdf("t", pdf, fakeFetch(json({ error: { code: 403, errors: [] } }, 403)).fetcher))).toBe("drive")
    expect(await failureOf(uploadPdf("t", pdf, fakeFetch(new Response("Bad gateway", { status: 502 })).fetcher))).toBe("drive")
    // Saved, but with no address to open it by.
    expect(await failureOf(uploadPdf("t", pdf, fakeFetch(json({ id: "abc" })).fetcher))).toBe("drive")
  })
})
