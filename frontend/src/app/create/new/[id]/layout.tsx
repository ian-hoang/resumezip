import type React from "react"
import type { Metadata } from "next"

// Shown until the resume loads; the page then puts the resume's name in the tab.
export const metadata: Metadata = { title: "Edit resume" }

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
