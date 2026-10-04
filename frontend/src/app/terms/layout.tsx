import type React from "react"
import type { Metadata } from "next"

// The page is a client component, so its tab title is set here.
export const metadata: Metadata = { title: "Terms & privacy" }

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
