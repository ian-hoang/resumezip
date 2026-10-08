// How often one visitor can ask for a review, so the API key can't be used
// up by someone asking over and over. It's counted in memory, by each copy
// of the server function, so it slows a visitor down rather than stopping
// them for good: a firewall rule on the host and a spending limit on the API
// key are what cap the cost.

/** At most `max` requests in any `ms` milliseconds. */
export interface Window {
  ms: number
  max: number
}

export const WINDOWS: readonly Window[] = [
  { ms: 10 * 60_000, max: 5 },
  { ms: 24 * 60 * 60_000, max: 20 },
]

// Visitors remembered at once, so memory can't grow without end.
const KEPT = 10_000

/**
 * Counts requests by who sent them. `take` says whether one more is allowed
 * now, and counts it if it is; otherwise it says how many seconds until it would be.
 */
export function limiter(windows: readonly Window[] = WINDOWS, now: () => number = Date.now) {
  const longest = Math.max(...windows.map((window) => window.ms))
  const seen = new Map<string, number[]>()
  return {
    take(who: string): { allowed: true } | { allowed: false; retryAfter: number } {
      const at = now()
      const times = (seen.get(who) ?? []).filter((time) => at - time < longest)
      for (const { ms, max } of windows) {
        const inWindow = times.filter((time) => at - time < ms)
        if (inWindow.length >= max) {
          seen.set(who, times)
          return { allowed: false, retryAfter: Math.ceil((inWindow[0] + ms - at) / 1000) }
        }
      }
      // Maps keep the order things were added in: moving to the end keeps the oldest first.
      seen.delete(who)
      seen.set(who, [...times, at])
      if (seen.size > KEPT) seen.delete(seen.keys().next().value!)
      return { allowed: true }
    },
  }
}
