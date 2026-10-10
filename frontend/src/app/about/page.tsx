import type { Metadata } from "next"
import { Star } from "lucide-react"
import EmailContact from "@/components/site/EmailContact"
import { INK_PILL } from "@/components/pills"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { SHEET } from "@/components/site/sheet"
import { TEMPLATES } from "@/lib/templates"

export const metadata: Metadata = { title: "About" }

const REPO_URL = "https://github.com/ian-hoang/resumezip"
const ISSUES_URL = `${REPO_URL}/issues`
const LINKEDIN_URL = "https://www.linkedin.com/company/resumezip"

const SECTION = "mt-16 grid gap-6 border-t border-ink pt-6 md:grid-cols-3 md:gap-12"
const HEADING = "font-serif text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]"
const TEXT_LINK = "text-ink underline underline-offset-4 hover:decoration-2"

// What resumezip holds to. Each has to stay true of the app: check the code before changing one.
const PROMISES = [
  { title: "Free", text: "Every template and download. No ads, no paid plans." },
  { title: "Private", text: "Your resume stays in your browser. No account, no copy." },
  { title: "Open source", text: "All of the code is on GitHub, for anyone to check." },
]

const MICROSOFT_STARTUPS_URL = "https://www.microsoft.com/en-us/startups"

/** Microsoft's four squares, in its colors. */
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  )
}

/** GitHub's mark, in the text's color. */
function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

/** "resumezip" in running text, in the logo's own lettering at the text's size. */
function Wordmark() {
  return <span className="font-logo font-medium tracking-[-0.02em] text-ink">resumezip</span>
}

// The resume's section headings and its lines with a date at the right, as Jake's lays them out.
const RESUME_HEADING = "mt-5 border-b border-ink pb-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] md:text-[13px]"
const RESUME_ROW = "flex justify-between gap-4"

/**
 * resumezip introduced as it'd introduce anyone: a one-page resume, in the
 * look of Jake's template, saying what it's done. Each line has to stay true
 * of the app, as the promises do; the number of templates is counted.
 */
function OwnResume() {
  return (
    <figure
      aria-label="resumezip’s own resume"
      className="w-full max-w-[600px] bg-white xl:max-w-[480px] 2xl:max-w-[600px] px-6 py-8 font-serif text-[13px] leading-normal text-ink shadow-[0_1px_0_rgb(17_19_24/0.06),0_30px_60px_-30px_rgb(30_40_90/0.5)] md:rotate-1 md:px-12 md:py-10 md:text-[14.5px]"
    >
      <div className="text-center">
        <p className="text-[28px] leading-tight tracking-[-0.01em] md:text-[32px]">resumezip</p>
        <p className="mt-1 text-[12px] md:text-[12.5px]">tryresumezip.com | github.com/ian-hoang/resumezip | MIT license</p>
      </div>
      <p className={RESUME_HEADING}>Experience</p>
      <p className={`${RESUME_ROW} mt-2`}>
        <b>Resume builder</b>
        <span>Mar 2025 – Present</span>
      </p>
      <p className={`${RESUME_ROW} italic`}>
        <span>Your own browser</span>
        <span>No account</span>
      </p>
      <ul className="mt-1.5 list-disc pl-5">
        <li>Turned what people write into a PDF on their own device, in {TEMPLATES.length} templates</li>
        <li>
          Kept <b>0</b> copies of anyone’s resume, by having no server to keep them on
        </li>
        <li>Opened its own PDFs again on any computer, each carrying its resume</li>
      </ul>
      <p className={RESUME_HEADING}>Skills</p>
      <p className="mt-2">
        <b>Promises:</b> Free, Private, Open source
        <br />
        <b>Reads:</b> PDF, Word and its own JSON backups
      </p>
    </figure>
  )
}

export default function AboutPage() {
  return (
    <div className="desk flex min-h-screen flex-col">
      <SiteHeader />
      <main className={SHEET}>
        <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-12">
          <div className="flex flex-col gap-5">
            <span className="label-mono text-ink-2">About</span>
            <h1 className="font-serif text-5xl leading-[1.02] tracking-[-0.03em] md:text-[80px] md:leading-[0.95]">
              Here’s <em className="whitespace-nowrap text-accent">our resume.</em>
            </h1>
            <p className="max-w-[600px] text-[17px] leading-relaxed text-ink-2">
              Many resume builders charge you to download your own resume, and keep a copy. <Wordmark /> doesn’t: every template is free and
              made for the hiring software (ATS) that reads it, and your resume stays in your browser.
            </p>
          </div>
          <OwnResume />
        </div>

        {/* One plain line, set apart by hairlines, rather than a logo wall. */}
        <p className="mt-10 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-ink/15 py-3 pr-2">
          <span className="label-mono text-ink-2">Part of</span>
          <a
            href={MICROSOFT_STARTUPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 underline-offset-4 hover:underline"
          >
            <MicrosoftLogo />
            <span className="font-serif text-[22px] leading-none tracking-[-0.01em]">Microsoft for Startups</span>
          </a>
        </p>

        <section className={SECTION} aria-labelledby="promises">
          <h2 id="promises" className={HEADING}>
            What it promises
          </h2>
          <ul className="grid gap-8 sm:grid-cols-3 md:col-span-2">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex flex-col gap-2">
                <span className="font-serif text-[22px] italic leading-tight text-accent">{promise.title}</span>
                <span className="text-[15px] leading-relaxed text-ink-2">{promise.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={SECTION} aria-labelledby="made">
          <h2 id="made" className={HEADING}>
            How it’s made
          </h2>
          <div className="md:col-span-2">
            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">
              Your PDF is typeset by Typst, running in your own browser, so your resume never has to be sent anywhere to become a page. The
              PDF carries your resume inside it, which is how resumezip opens it again on any computer.
            </p>
          </div>
        </section>

        {/* Where Contact used to be: /contact comes here. */}
        <section id="contact" className={`${SECTION} scroll-mt-28`} aria-labelledby="contact-heading">
          <div className="flex flex-col gap-3">
            <h2 id="contact-heading" className={HEADING}>
              Get in touch
            </h2>
            <p className="text-[15px] leading-relaxed text-ink-2">Found a bug or have an idea? I read every message.</p>
          </div>
          <div className="flex flex-col gap-5 md:col-span-2">
            <EmailContact />
            <p className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
              <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                Report a bug on GitHub
              </a>
              <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                Find us on LinkedIn
              </a>
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={`${HEADING} flex items-center gap-3 self-start`}>
            <GitHubLogo className="h-7 w-7 shrink-0 md:h-8 md:w-8" />
            Star it on GitHub
          </h2>
          <div className="md:col-span-2">
            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">
              No ads, no paid plans. If <Wordmark /> helped you, a star helps others find it.
            </p>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`group ${INK_PILL} mt-6`}>
              {/* Yellow under the pointer, as the header's star is. */}
              <Star
                className="h-4 w-4 transition-colors duration-200 group-hover:fill-[#facc15] group-hover:text-[#facc15] motion-reduce:transition-none"
                aria-hidden="true"
              />
              Star on GitHub
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
