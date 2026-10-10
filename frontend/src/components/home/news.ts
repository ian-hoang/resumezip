// The home page's news bar (NewsBar.tsx): what's new, and whether this
// browser has closed it. Only the news's id is kept, so the next news shows
// even to someone who closed this one.

/** The localStorage key that holds the id of the news last closed. */
export const NEWS_CLOSED_KEY = "news-closed"

export const NEWS = {
  /** A new id shows the bar again to everyone. */
  id: "download-all",
  /** From PR #178: Download all, on the dashboard, and the JSON file beside each Download PDF. */
  text: "Back up every resume in one file with Download all",
  /** For phones, where the whole of `text` doesn't fit. */
  short: "Back up every resume in one file",
  href: "/create/dashboard",
}

/** Whether the news has been closed in this browser. Storage that can't be read hasn't closed it. */
export function newsClosed(storage: Storage | null, id: string = NEWS.id): boolean {
  try {
    return storage?.getItem(NEWS_CLOSED_KEY) === id
  } catch {
    return false
  }
}

/** Remembers the news as closed, where the browser lets the site save. */
export function closeNews(storage: Storage | null, id: string = NEWS.id): void {
  try {
    storage?.setItem(NEWS_CLOSED_KEY, id)
  } catch {
    // Without storage it shows again on the next visit, which is all that's lost.
  }
}
