"use client"

import { useEffect } from "react"
import { prefetchCompiler, savingData } from "@/lib/typst/compile"

// How long after the home page has loaded the PDF compiler starts to download.
const SETTLE_MS = 1_000

/**
 * On a computer, downloads the PDF compiler once the home page has loaded and
 * settled, so it doesn't hold up the page's own pictures, and the
 * editor's first preview needn't wait for it. Computers are rarely on metered
 * data; phones and tablets may be, and iPhones don't tell the page, so they
 * and visitors saving data only download it as they start writing (see
 * StartWriting.tsx). A mouse or trackpad stands for a computer.
 */
export default function PrefetchCompiler() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || savingData()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = () => {
      timer = setTimeout(prefetchCompiler, SETTLE_MS)
    }
    if (document.readyState === "complete") settle()
    else addEventListener("load", settle, { once: true })
    return () => {
      removeEventListener("load", settle)
      clearTimeout(timer)
    }
  }, [])
  return null
}
