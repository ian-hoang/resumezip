"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, X } from "lucide-react"
import { getStorage } from "@/lib/resumeKeys"
import { closeNews, NEWS, newsClosed } from "./news"

/**
 * A line across the top of the home page, over the video, saying what's new.
 * Closed, it stays closed in this browser. It lies over the page rather than
 * pushing it down, as only the browser knows whether it shows: the header
 * keeps its place either way.
 */
export default function NewsBar() {
  const [shown, setShown] = useState(false)
  useEffect(() => setShown(!newsClosed(getStorage())), [])
  if (!shown) return null

  const close = () => {
    const hadFocus = document.activeElement
    closeNews(getStorage())
    setShown(false)
    // The button goes with the bar; the keyboard carries on from the header's first link instead of the top of the page.
    if (hadFocus instanceof HTMLButtonElement) document.querySelector<HTMLElement>("header a")?.focus()
  }

  return (
    <aside
      aria-label="News"
      className="news-bar absolute inset-x-0 top-0 z-50 flex h-9 items-center justify-center border-b border-white/10 bg-black/50 pl-4 pr-12 text-[13px] text-white backdrop-blur-md"
    >
      <Link href={NEWS.href} className="group flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-soft" />
        <span className="shrink-0 font-semibold">New:</span>
        <span className="truncate text-white/85 underline-offset-4 group-hover:text-white group-hover:underline">
          <span className="sm:hidden">{NEWS.short}</span>
          <span className="max-sm:hidden">{NEWS.text}</span>
        </span>
        <ArrowRight
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
      <button
        type="button"
        aria-label="Close the news"
        onClick={close}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  )
}
