import type { Metadata } from "next"
import Link from "next/link"
import PageIntro from "@/components/site/PageIntro"
import { INK_PILL } from "@/components/pills"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { PAPER_FRAME, SHEET } from "@/components/site/sheet"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="desk desk-bright flex min-h-screen flex-col">
      <SiteHeader />
      <div className={PAPER_FRAME}>
        {/* The frame fills the screen, as the dashboard's does, so the few words are in its middle,
            as "Resume not found" is in the editor. */}
        <main className={`${SHEET} flex flex-col items-center justify-center text-center`}>
          <PageIntro label="Error 404" title="Page not found">
            This page doesn’t exist. It may have moved, or the address may be mistyped.
          </PageIntro>
          <Link href="/" className={`${INK_PILL} mt-10`}>
            Back to home
          </Link>
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
