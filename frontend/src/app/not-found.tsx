import type { Metadata } from "next"
import Link from "next/link"
import PageIntro from "@/components/site/PageIntro"
import { INK_PILL } from "@/components/pills"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="desk flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-24 pt-12 md:px-10 md:pt-16">
        <PageIntro label="Error 404" title="Page not found">
          This page doesn’t exist. It may have moved, or the address may be mistyped.
        </PageIntro>
        <Link href="/" className={`${INK_PILL} mt-10`}>
          Back to home
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
