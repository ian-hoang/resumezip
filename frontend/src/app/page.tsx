import Image from "next/image"
import Link from "next/link"
import FloatingStart from "@/components/home/FloatingStart"
import FocusWords from "@/components/home/FocusWords"
import HeroVideo from "@/components/home/HeroVideo"
import HomeChrome from "@/components/home/HomeChrome"
import HowItWorks from "@/components/home/HowItWorks"
import Magnetic from "@/components/home/Magnetic"
import NewsBar from "@/components/home/NewsBar"
import PrefetchCompiler from "@/components/home/PrefetchCompiler"
import Questions from "@/components/home/Questions"
import SiteFooter from "@/components/site/SiteFooter"
import { StartWritingLink } from "@/components/site/StartWriting"
import { TEMPLATES } from "@/lib/templates"

function ArrowUpRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 9l6-6M4 3h5v5" />
    </svg>
  )
}

// An outline pill on the video and the blue, which fills with white from the bottom as it's pointed at (home.css).
const OUTLINE_PILL =
  "ink-fill inline-flex h-11 items-center self-start rounded-full border px-[18px] text-[15px] font-medium tracking-[-0.01em]"

// Sections say what they're drawn on (data-tone), for the header's tint, and
// data-tick gives them a tick at the side of the page (HomeChrome.tsx).
export default function Home() {
  return (
    // A column, so the margins of the header's strip and the hero, which overlap by the news bar's height, don't collapse.
    <div className="home relative flex flex-col bg-sheet text-ink">
      <NewsBar />
      <HomeChrome />

      <section
        data-hero
        data-tone="dark"
        data-tick
        className="home-hero relative flex min-h-[max(680px,100svh)] flex-col overflow-hidden bg-black text-white"
      >
        <HeroVideo />
        <div aria-hidden="true" className="absolute inset-0 bg-black/25" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 md:px-10">
          <h1 className="max-w-[1000px] text-balance font-serif text-[56px] leading-[0.92] tracking-[-0.045em] max-[359px]:text-[52px] sm:text-[80px] lg:text-[116px] lg:leading-[0.88]">
            {/* A line for each sentence. At 56px each is a few pixels wider than a 320px screen leaves, so it's a little smaller there. */}
            Your resume. Not our <em className="pr-[0.04em] text-accent-soft">data.</em>
          </h1>
        </div>

        <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-wrap items-end justify-between gap-8 px-5 pb-6 pt-12 md:px-10 md:pb-10">
          <div className="flex w-full max-w-[420px] flex-col gap-6 bg-white px-7 pb-6 pt-7 text-ink">
            <p className="text-xl leading-[1.35] tracking-[-0.015em]">
              resumezip is a free, open-source resume builder that runs in your browser. Pick a template, write, and download the PDF.
            </p>
            <Magnetic>
              <StartWritingLink
                className="group flex h-12 items-center justify-between gap-4 rounded-full bg-ink pl-6 pr-1.5 text-white transition-colors hover:bg-black"
                preloadOnHover
              >
                <span className="magnet-pull magnet-pull-soft text-[15px] font-medium tracking-[-0.01em]">Start writing</span>
                <span className="magnet-pull inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink">
                  <ArrowUpRight />
                </span>
              </StartWritingLink>
            </Magnetic>
          </div>
          <div className="flex max-w-[340px] flex-col gap-4">
            <span className="label-mono">Free · Saved in your browser</span>
            <p className="text-xl leading-[1.35] tracking-[-0.015em]">Nothing to install. No sign-up.</p>
            <Link href="/templates" className={`${OUTLINE_PILL} border-white/70`}>
              <span className="ink-fill-label inline-flex items-center gap-2.5">
                See templates <ArrowUpRight />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section data-tone="blue" data-tick className="relative bg-accent text-white">
        <div className="flex flex-col gap-24 px-5 pb-24 pt-8 md:gap-[200px] md:px-10 md:pb-[120px]">
          <span className="label-mono">
            {/* The name stays in lower case, as everywhere. */}
            Why <span className="normal-case">resumezip</span>
          </span>
          <div className="max-w-[760px]">
            <FocusWords
              lines={[
                {
                  text: "You keep it. We don’t.",
                  className: "font-serif text-5xl leading-[0.95] tracking-[-0.04em] md:text-[80px] md:leading-[0.92]",
                  from: 0,
                  to: 0.7,
                  // White at 70% on the blue is 3.6:1.
                  faint: 0.7,
                },
                {
                  // A beat behind the heading.
                  text: "No account, and no copy on our side. To switch devices, open your PDF, or a JSON backup, on the new one.",
                  className: "max-w-[520px] text-xl leading-[1.35] tracking-[-0.015em]",
                  from: 0.35,
                  to: 1,
                  // At 90%, 4.9:1.
                  faint: 0.9,
                },
              ]}
            >
              <StartWritingLink className={`${OUTLINE_PILL} border-white`} preloadOnHover>
                <span className="ink-fill-label inline-flex items-center gap-2.5">
                  Start writing <ArrowUpRight />
                </span>
              </StartWritingLink>
              <span aria-hidden="true" className="focus-rail hidden md:block" />
            </FocusWords>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section aria-labelledby="templates" data-tone="blue" data-tick className="bg-accent text-white">
        <div className="border-b border-white/25">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-7 md:px-10">
            <h2 id="templates" className="label-mono">
              Templates
            </h2>
            <Link href="/templates" className={`${OUTLINE_PILL} border-white`}>
              <span className="ink-fill-label inline-flex items-center gap-2.5">
                See all <ArrowUpRight />
              </span>
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-px bg-white/25">
          {/* A few to show the range; "See all" has the rest. */}
          {TEMPLATES.slice(0, 4).map((template) => (
            <StartWritingLink
              key={template.id}
              template={template.id}
              className="group flex min-w-0 flex-[1_1_260px] flex-col gap-5 bg-accent px-5 pb-7 pt-10 md:px-10"
            >
              <div className="relative aspect-[8.5/11] w-full overflow-hidden bg-white ring-2 ring-transparent transition-shadow group-hover:ring-ink">
                <Image
                  src={template.image}
                  alt={`${template.name} template`}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <span className="font-serif text-[22px] leading-tight tracking-[-0.015em]">{template.name}</span>
            </StartWritingLink>
          ))}
        </div>
      </section>

      <Questions />

      <div data-tone="dark">
        <SiteFooter />
      </div>
      <FloatingStart />
      <PrefetchCompiler />
    </div>
  )
}
