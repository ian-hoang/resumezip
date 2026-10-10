import type React from "react"
import type { Metadata } from "next"

// The page is a client component, so its tab title is set here. It's only
// ever opened by Google's sign-in, so search engines leave it out.
export const metadata: Metadata = { title: "Google Drive", robots: { index: false } }

export default function GoogleDriveLayout({ children }: { children: React.ReactNode }) {
  return children
}
