import Link from "next/link"
import { Check, X } from "lucide-react"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import StructuredData from "@/components/site/StructuredData"
import { PAPER_FRAME, SHEET } from "@/components/site/sheet"
import { pageMetadata } from "@/lib/site"
import { breadcrumbs, TEMPLATES_CRUMB } from "@/lib/structuredData"
import { TEMPLATES, templatePath } from "@/lib/templates"
import { READING_CHECKS, READING_RESULTS, WHY_NOT } from "./checks"

const PAGE = { name: "How each template reads", path: "/templates/how-they-read" }

export const metadata = pageMetadata({
  path: PAGE.path,
  title: PAGE.name,
  description:
    "Every resumezip template’s sample PDF, read back as plain text the way hiring software reads it, on every change to the code. What’s checked, and what it finds.",
})

const TEST_URL = "https://github.com/ian-hoang/resumezip/blob/main/frontend/src/lib/import/readsCleanly.test.ts"

const SECTION = "grid gap-6 border-t border-ink pt-6 md:grid-cols-3 md:gap-12"
const HEADING = "font-serif text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]"
const TEXT_LINK = "text-ink underline underline-offset-4 hover:decoration-2"

// Built from results.json, which the test writes and checks, so it says what the samples read today.
const failing = TEMPLATES.filter(({ id }) => READING_CHECKS.some((check) => READING_RESULTS[id][check.id].length > 0))

export default function HowTheyReadPage() {
  return (
    <div className="desk desk-bright flex min-h-screen flex-col">
      <SiteHeader />
      <StructuredData data={breadcrumbs([TEMPLATES_CRUMB, PAGE])} />

      <div className={PAPER_FRAME}>
        <main className={`${SHEET} flex flex-col gap-16`}>
          <PageIntro
            label="Templates"
            title={
              <>
                How each template <em className="text-accent">reads</em>
              </>
            }
          >
            <p className="text-pretty">
              Hiring software reads the text in your PDF, not how it looks. Each time resumezip’s code changes, a test prints every
              template’s sample resume and reads it back as plain text, the way that software does. Here’s what it checks, and what it
              finds.
            </p>
          </PageIntro>

          <section aria-labelledby="checked" className={SECTION}>
            <h2 id="checked" className={HEADING}>
              What’s checked
            </h2>
            <dl className="flex flex-col gap-5 md:col-span-2">
              {READING_CHECKS.map((check) => (
                <div key={check.id} className="flex flex-col gap-1">
                  <dt className="text-[17px] font-medium text-ink">{check.name}</dt>
                  <dd className="text-pretty text-[17px] leading-relaxed text-ink-2">{check.text}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="results" className={SECTION}>
            <h2 id="results" className={HEADING}>
              What it finds
            </h2>
            {/* On a phone, a line for each template; the table needs more room than that. */}
            <ul className="flex flex-col border-t border-ink text-[15px] md:hidden">
              {TEMPLATES.map((template) => {
                const missed = READING_CHECKS.filter((check) => READING_RESULTS[template.id][check.id].length > 0)
                return (
                  <li key={template.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                    <Link href={templatePath(template)} className={TEXT_LINK}>
                      {template.name}
                    </Link>
                    {missed.length === 0 ? (
                      <span className="text-ink">
                        {READING_CHECKS.length} of {READING_CHECKS.length} checks
                      </span>
                    ) : (
                      <a href={`#${template.id}`} className="text-right text-ink-2 underline underline-offset-4 hover:text-ink">
                        {READING_CHECKS.length - missed.length} of {READING_CHECKS.length}: not{" "}
                        {missed.map((check) => check.short).join(", ")}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="hidden md:col-span-2 md:block">
              <table className="w-full border-collapse text-left text-[15px]">
                <caption className="sr-only">Each template’s sample, and whether it reads as typed for each check</caption>
                <thead>
                  <tr className="label-mono border-b border-ink text-ink-2">
                    <th scope="col" className="py-3 pr-4 font-normal">
                      Template
                    </th>
                    {READING_CHECKS.map((check) => (
                      <th key={check.id} scope="col" className="px-2 py-3 text-center font-normal">
                        {check.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATES.map((template) => (
                    <tr key={template.id} className="border-b border-rule">
                      <th scope="row" className="py-3 pr-4 font-normal">
                        <Link href={templatePath(template)} className={TEXT_LINK}>
                          {template.name}
                        </Link>
                      </th>
                      {READING_CHECKS.map((check) => (
                        <td key={check.id} className="px-2 py-3 text-center">
                          {READING_RESULTS[template.id][check.id].length === 0 ? (
                            <>
                              <Check className="mx-auto h-5 w-5 text-ink" strokeWidth={2.25} aria-hidden="true" />
                              <span className="sr-only">Reads as typed</span>
                            </>
                          ) : (
                            <a href={`#${template.id}`} className="inline-flex text-ink-2 hover:text-ink">
                              <X className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                              <span className="sr-only">Doesn’t read as typed: see why below</span>
                            </a>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {failing.length > 0 && (
            <section aria-labelledby="not-as-typed" className={SECTION}>
              <h2 id="not-as-typed" className={HEADING}>
                Where it doesn’t
              </h2>
              <div className="flex flex-col gap-10 md:col-span-2">
                {failing.map((template) => (
                  <div key={template.id} id={template.id} className="flex scroll-mt-28 flex-col gap-3">
                    <h3 className="text-[20px] font-medium text-ink">{template.name}</h3>
                    <p className="text-pretty text-[17px] leading-relaxed text-ink-2">{WHY_NOT[template.id]}</p>
                    <p className="label-mono text-ink-2">What the test read</p>
                    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
                      {READING_CHECKS.flatMap((check) =>
                        READING_RESULTS[template.id][check.id].map((message) => <li key={message}>{message}</li>),
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="limits" className={SECTION}>
            <h2 id="limits" className={HEADING}>
              What it can’t tell you
            </h2>
            <div className="flex flex-col gap-4 text-pretty text-[17px] leading-relaxed text-ink-2 md:col-span-2">
              <p>
                These checks show that a template’s words come out of its PDF as they were typed. Every hiring system reads a little
                differently, so no one can promise how one will read a resume, and we don’t.
              </p>
              <p>
                The test is open for anyone to read and run:{" "}
                <a href={TEST_URL} className={TEXT_LINK}>
                  readsCleanly.test.ts on GitHub
                </a>
                .
              </p>
            </div>
          </section>
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}
