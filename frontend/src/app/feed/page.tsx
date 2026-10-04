import type { Metadata } from "next"
import Link from "next/link"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"

export const metadata: Metadata = { title: "Feed" }

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-24 pt-16 md:px-10 md:pt-20">
        <PageIntro label="Feed" title="Coming soon">
          This feature will be available soon. Check back later.
        </PageIntro>
        <Link
          href="/"
          className="mt-10 inline-flex h-11 items-center rounded-[4px] border border-rule-strong px-5 text-sm text-ink transition-colors hover:border-ink"
        >
          Back to home
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
