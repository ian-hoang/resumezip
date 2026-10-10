import type { Metadata } from "next"
import Link from "next/link"
import { Star } from "lucide-react"
import PageIntro from "@/components/site/PageIntro"
import { INK_PILL } from "@/components/pills"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { SHEET } from "@/components/site/sheet"

export const metadata: Metadata = { title: "About" }

const REPO_URL = "https://github.com/ian-hoang/resumezip"
const LINKEDIN_URL = "https://www.linkedin.com/in/ianhoangdev"

const SECTION = "mt-16 grid gap-6 border-t border-ink pt-6 md:grid-cols-3 md:gap-12"
const HEADING = "font-serif text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]"
const TEXT_LINK = "text-ink underline underline-offset-4 hover:decoration-2"

export default function AboutPage() {
  return (
    <div className="desk flex min-h-screen flex-col">
      <SiteHeader />
      <main className={SHEET}>
        <PageIntro label="About" title="Hi, I’m Ian.">
          I built resumezip because formatting a resume shouldn’t be harder than writing it. It’s free, there’s no sign-up, and I don’t
          store your resume.
        </PageIntro>

        <section className={SECTION}>
          <h2 className={HEADING}>Star it on GitHub</h2>
          <div className="md:col-span-2">
            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">
              resumezip has no ads and no paid plans. If it helped you, a star on GitHub helps other people find it.
            </p>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`${INK_PILL} mt-6`}>
              <Star className="h-4 w-4" aria-hidden="true" />
              Star on GitHub
            </a>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={HEADING}>Say hi</h2>
          <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2 md:col-span-2">
            Found a bug or have an idea?{" "}
            <Link href="/contact" className={TEXT_LINK}>
              Send me a message
            </Link>{" "}
            or find me on{" "}
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
              LinkedIn
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
