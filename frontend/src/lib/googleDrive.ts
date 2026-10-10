// Saves a PDF to the person's Google Drive, straight from the browser.
//
// Google asks them first, in a window of its own, and sends that window back
// to SIGNED_IN_PATH with a token in the address's fragment (OAuth 2.0's
// implicit flow). That page passes the token here over a BroadcastChannel,
// rather than through window.opener: Google's sign-in pages can send
// Cross-Origin-Opener-Policy, which cuts the popup off from this page. The
// token only reaches the files resumezip saves (the drive.file scope), and is
// kept in memory.
//
// Google Identity Services does the same, but its script runs inside the
// editor, with access to every saved resume. It would also have to load after
// the press and before the window opens, and browsers block a window opened
// after a wait.

/** The resumezip web client in the resumezip-511201 Google Cloud project. Not a secret: it's in every sign-in address. */
export const GOOGLE_CLIENT_ID = "351466788509-kslpt0ea0ebvf05vmvjl4b2ck8eioh2l.apps.googleusercontent.com"
/** Only the files this app saves, and none of the person's others. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"
/**
 * Where Google sends its window back to. Each site's address for it is one of
 * the client's authorized redirect URIs, which can't have wildcards, so
 * preview deployments can't sign in.
 */
export const SIGNED_IN_PATH = "/google-drive"
/** The BroadcastChannel the signed-in page answers on. */
export const SIGN_IN_CHANNEL = "google-drive"

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink"

/** The address that opens Google's sign-in, coming back to this site's SIGNED_IN_PATH with `state`. */
export function signInUrl(origin: string, state: string): string {
  const query = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: origin + SIGNED_IN_PATH,
    response_type: "token",
    scope: DRIVE_FILE_SCOPE,
    state,
  })
  return `${AUTH}?${query}`
}

/** What Google's window came back with: a token for `expiresIn` seconds, or why there's none (as "access_denied"). */
export type SignInAnswer = { state: string; token: string; expiresIn: number } | { state: string; error: string }

/**
 * Google's answer, from the fragment of the address it sent its window back
 * to, or null if it isn't one. A token without the Drive scope, which the
 * person can untick, counts as declined.
 */
export function answerIn(fragment: string): SignInAnswer | null {
  const answer = new URLSearchParams(fragment.replace(/^#/, ""))
  const state = answer.get("state")
  if (!state) return null
  const token = answer.get("access_token")
  const scope = answer.get("scope")
  if (token && (scope === null || scope.split(" ").includes(DRIVE_FILE_SCOPE))) {
    // Google's tokens last an hour; one without a time is taken as lasting that long.
    const expiresIn = Number(answer.get("expires_in")) || 3600
    return { state, token, expiresIn }
  }
  return { state, error: answer.get("error") || "access_denied" }
}

/**
 * Why Drive didn't take the PDF: `offline`, it couldn't be reached; `signed-out`,
 * the token was refused, so the next try signs in again; `full`, the Drive has
 * no room; `drive`, anything else.
 */
export type DriveFailure = "offline" | "signed-out" | "full" | "drive"

export class DriveError extends Error {
  constructor(
    message: string,
    readonly failure: DriveFailure,
  ) {
    super(message)
  }
}

// The reasons Google gives in an error answer, as "storageQuotaExceeded".
function reasonsIn(body: unknown): string[] {
  const errors = (body as { error?: { errors?: unknown } } | null)?.error?.errors
  if (!Array.isArray(errors)) return []
  return errors
    .map((error) => (error as { reason?: unknown } | null)?.reason)
    .filter((reason): reason is string => typeof reason === "string")
}

/**
 * Saves `file`, a PDF, to the top of the person's Drive under its own name, as
 * a new file beside any saved before. Gives back the address that opens it in
 * Drive. Only the file and the token are sent: no cookies, and no referrer.
 */
export async function uploadPdf(token: string, file: File, fetcher: typeof fetch = fetch): Promise<string> {
  const boundary = `resumezip-${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name: file.name, mimeType: "application/pdf" })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ])
  let response: Response
  try {
    response = await fetcher(UPLOAD, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
  } catch (error) {
    throw new DriveError(`Couldn't reach Google Drive: ${error}`, "offline")
  }
  const answer: unknown = await response.json().catch(() => null)
  if (response.ok) {
    const link = (answer as { webViewLink?: unknown } | null)?.webViewLink
    if (typeof link === "string" && link.startsWith("https://")) return link
    throw new DriveError("Google Drive didn't say where the file is", "drive")
  }
  const reasons = reasonsIn(answer)
  const message = `Google Drive answered ${response.status}${reasons.length ? ` (${reasons.join(", ")})` : ""}`
  if (response.status === 401) throw new DriveError(message, "signed-out")
  if (reasons.includes("storageQuotaExceeded")) throw new DriveError(message, "full")
  throw new DriveError(message, "drive")
}
