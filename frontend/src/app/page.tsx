import Image from "next/image"
import Link from "next/link"
import HeroVideo from "@/components/home/HeroVideo"
import HowItWorks from "@/components/home/HowItWorks"
import PrefetchCompiler from "@/components/home/PrefetchCompiler"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { StartWritingLink } from "@/components/site/StartWriting"
import { TEMPLATES } from "@/lib/templates"

const REPO_URL = "https://github.com/ian-hoang/resumezip"

const QUESTIONS = [
  {
    question: "Is it really free?",
    answer: "Yes. Every template and every download. No ads, no trial, no watermark.",
  },
  {
    question: "Do you keep my resume?",
    answer: (
      <>
        No. It’s saved in this browser, and we don’t store it. The code is{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#171717] underline underline-offset-4 hover:decoration-2"
        >
          open source
        </a>
        , so anyone can check.
      </>
    ),
  },
  {
    question: "How do I edit it later, or on another computer?",
    answer: "Open the PDF you downloaded. resumezip reads your resume back out of it.",
  },
]

function ArrowUpRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 9l6-6M4 3h5v5" />
    </svg>
  )
}

export default function Home() {
  return (
    <div className="bg-sheet font-system text-[#171717]">
      <section className="relative flex min-h-[max(680px,100svh)] flex-col overflow-hidden bg-black text-white">
        <HeroVideo />
        <div aria-hidden="true" className="absolute inset-0 bg-black/25" />

        <SiteHeader variant="overlay" starOnGitHub />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pt-6 md:px-10">
          <h1 className="max-w-[1000px] text-balance font-serif text-[56px] leading-[0.92] tracking-[-0.045em] max-[359px]:text-[52px] sm:text-[80px] lg:text-[116px] lg:leading-[0.88]">
            {/* A line for each sentence. At 56px each is a few pixels wider than a 320px screen leaves, so it's a little smaller there. */}
            Your resume. Not our data.
          </h1>
        </div>

        <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 flex-wrap items-end justify-between gap-8 px-5 pb-6 pt-12 md:px-10 md:pb-10">
          <div className="flex w-full max-w-[420px] flex-col gap-7 bg-white px-7 pb-5 pt-7 text-[#171717]">
            <p className="text-xl leading-[1.35] tracking-[-0.015em]">
              resumezip is a free, open-source resume builder that runs in your browser. Pick a template, write, and download the PDF.
            </p>
            <StartWritingLink className="group flex items-center justify-between gap-4 border-t border-[#171717] pt-4" preloadOnHover>
              <span className="label-caps decoration-2 underline-offset-4 group-hover:underline">Start writing</span>
              <span className="inline-flex h-7 w-7 items-center justify-center bg-accent text-white transition duration-200 group-hover:bg-[#2550d4] motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5">
                <ArrowUpRight />
              </span>
            </StartWritingLink>
          </div>
          <div className="flex max-w-[340px] flex-col gap-4">
            <span className="label-caps">Free · Saved in your browser</span>
            <p className="text-xl leading-[1.35] tracking-[-0.015em]">Nothing to install. No sign-up.</p>
            <Link
              href="/templates"
              className="label-caps inline-flex h-11 items-center gap-3 self-start border border-white/70 px-[18px] transition-colors hover:bg-white hover:text-[#171717]"
            >
              See templates <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-accent text-white">
        <div className="flex flex-col gap-24 px-5 pb-24 pt-8 md:gap-[200px] md:px-10 md:pb-[120px]">
          <span className="label-section">Why resumezip</span>
          <div className="flex max-w-[760px] flex-col gap-8">
            <p className="font-serif text-5xl leading-[0.95] tracking-[-0.04em] md:text-[80px] md:leading-[0.92]">You keep it. We don’t.</p>
            <p className="max-w-[520px] text-xl leading-[1.35] tracking-[-0.015em]">
              No account, and no copy on our side. To switch devices, open your PDF or Word file on the new one.
            </p>
            <StartWritingLink
              className="label-caps inline-flex h-11 items-center gap-3 self-start border border-white px-[18px] transition-colors hover:bg-white hover:text-accent"
              preloadOnHover
            >
              Start writing <ArrowUpRight />
            </StartWritingLink>
          </div>
        </div>
      </section>

      <HowItWorks />

      <section aria-labelledby="templates" className="bg-accent text-white">
        <div className="border-b border-white/25">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-7 md:px-10">
            <h2 id="templates" className="label-section">
              Templates
            </h2>
            <Link
              href="/templates"
              className="label-caps inline-flex h-10 items-center gap-3 border border-white px-4 transition-colors hover:bg-white hover:text-accent"
            >
              See all <ArrowUpRight />
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
              <div className="relative aspect-[8.5/11] w-full overflow-hidden bg-white ring-2 ring-transparent transition-shadow group-hover:ring-[#171717]">
                <Image
                  src={template.image}
                  alt={`${template.name} template`}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <span className="label-caps">{template.name}</span>
            </StartWritingLink>
          ))}
        </div>
      </section>

      <section aria-labelledby="questions" className="bg-white">
        <div className="border-b border-[#d4d4d4]">
          <div className="px-5 py-7 md:px-10">
            <h2 id="questions" className="label-section text-accent">
              Questions
            </h2>
          </div>
        </div>
        <dl className="grid md:grid-cols-3">
          {QUESTIONS.map((item, index) => (
            <div
              key={item.question}
              className={`flex flex-col gap-4 border-[#d4d4d4] px-5 pb-12 pt-8 md:px-10 md:pb-20 md:pt-10 ${
                index > 0 ? "border-t md:border-l md:border-t-0" : ""
              }`}
            >
              <dt className="font-serif text-[32px] leading-none tracking-[-0.03em] md:text-[44px]">{item.question}</dt>
              <dd className="max-w-[420px] text-base leading-[1.35] tracking-[-0.015em] text-[#5c5c5c] md:text-xl">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SiteFooter />
      <PrefetchCompiler />
    </div>
  )
}
