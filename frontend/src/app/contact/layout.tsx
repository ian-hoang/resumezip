import type React from "react"
import type { Metadata } from "next"

// The page is a client component, so its tab title is set here.
export const metadata: Metadata = { title: "Contact" }

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
