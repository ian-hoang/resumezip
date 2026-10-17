import Link from "next/link"
import { Caveat } from "next/font/google"
import { ArrowUpRight } from "lucide-react"
import LiquidLens from "@/components/LiquidLens"
import HomeStory from "@/components/home/HomeStory"
import PrefetchCompiler from "@/components/home/PrefetchCompiler"
import { INK_PILL, WHITE_PILL } from "@/components/pills"
import StructuredData from "@/components/site/StructuredData"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { StartWritingLink } from "@/components/site/StartWriting"
import { pageMetadata, SITE_DESCRIPTION } from "@/lib/site"
import { HOME_DATA } from "@/lib/structuredData"

export const metadata = pageMetadata({ path: "/", description: SITE_DESCRIPTION })

// The handwriting of the notes on the editor. Only this page uses it, and it's first seen a
// screen and more down, so it isn't preloaded.
const marker = Caveat({ weight: "600", subsets: ["latin"], variable: "--font-caveat", preload: false })

const MICROSOFT_STARTUPS_URL = "https://www.microsoft.com/en-us/startups"

/** Microsoft's four squares, in its colors. */
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  )
}

/** The first screen: the name as the logo writes it, what it is in a line, the way in, and Microsoft for Startups. */
function Hero() {
  return (
    <>
      <h1 className="home-wordmark">resumezip</h1>
      <p className="home-definition">
        A free, open-source resume builder that runs in your browser, and keeps your resume on{" "}
        <em className="text-accent">your own computer.</em>
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <StartWritingLink className={`${INK_PILL} h-11`} preloadOnHover>
          Start writing <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </StartWritingLink>
        <Link href="/templates" className={`${WHITE_PILL} h-11`}>
          See templates
        </Link>
      </div>
      {/* One slim pill of glass, rather than a logo wall. */}
      <a
        href={MICROSOFT_STARTUPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="home-partner glass glass-float transition-[filter] hover:brightness-[1.03]"
      >
        <LiquidLens bevel={16} strength={1} />
        <span className="label-mono text-ink-2">Part of</span>
        <span aria-hidden="true" className="h-[16px] w-px bg-ink/15" />
        <MicrosoftLogo />
        <span className="whitespace-nowrap font-serif text-[16px] leading-none tracking-[-0.01em] sm:text-[17px]">
          Microsoft for Startups
        </span>
      </a>
    </>
  )
}

export default function Home() {
  return (
    <div className="desk flex min-h-screen flex-col">
      <StructuredData data={HOME_DATA} />
      <SiteHeader />
      {/* A column, so the story's pull up behind the header doesn't move the main part with it. */}
      <main className={`flex flex-1 flex-col ${marker.variable}`}>
        <HomeStory hero={<Hero />} />
      </main>
      <SiteFooter ground />
      <PrefetchCompiler />
    </div>
  )
}
