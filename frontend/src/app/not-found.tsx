import type { Metadata } from "next"
import Link from "next/link"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-24 pt-16 md:px-10 md:pt-20">
        <PageIntro label="Error 404" title="Page not found">
          This page doesn’t exist. It may have moved, or the address may be mistyped.
        </PageIntro>
        <Link
          href="/"
          className="mt-10 inline-flex h-11 items-center rounded-[4px] bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black"
        >
          Back to home
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
