import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { BLUE_PILL, sheetPill } from "@/components/pills"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { CARD_SHEET, PAPER_FRAME } from "@/components/site/sheet"
import { StartWritingLink } from "@/components/site/StartWriting"
import StructuredData from "@/components/site/StructuredData"
import { pageMetadata, SHARE_IMAGE_SIZE } from "@/lib/site"
import { breadcrumbs, TEMPLATES_CRUMB } from "@/lib/structuredData"
import { printedName, type Template, TEMPLATES, templateBySlug, templateImageAlt, templatePath, templateSlug } from "@/lib/templates"
import { ABOUT } from "./about"

// A page for each template, built ahead of time; any other address is a 404.
export const dynamicParams = false

export function generateStaticParams() {
  return TEMPLATES.map((template) => ({ template: templateSlug(template) }))
}

interface TemplatePageProps {
  params: Promise<{ template: string }>
}

const titleOf = (template: Template) => `${template.name} resume template`

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
  const template = templateBySlug((await params).template)
  if (!template) return {}
  return pageMetadata({
    path: templatePath(template),
    title: titleOf(template),
    description: ABOUT[template.id].description,
    // Drawn by opengraph-image.tsx beside it.
    image: { url: `${templatePath(template)}/opengraph-image`, ...SHARE_IMAGE_SIZE, alt: templateImageAlt(template) },
  })
}

/**
 * A template's own page, on the sheet the templates page is on: its page big
 * on a card, what it's like and Use, which starts a resume with it, and the
 * other templates.
 */
export default async function TemplatePage({ params }: TemplatePageProps) {
  const template = templateBySlug((await params).template)
  if (!template) notFound()
  const about = ABOUT[template.id]
  const tags: readonly string[] = template.tags

  return (
    <div className="desk desk-bright flex min-h-screen flex-col">
      <SiteHeader />
      <StructuredData data={breadcrumbs([TEMPLATES_CRUMB, { name: titleOf(template), path: templatePath(template) }])} />

      <div className={PAPER_FRAME}>
        <main className={CARD_SHEET}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-3 text-[15px]">
              <Link href="/templates" className="group inline-flex items-center gap-3 text-ink-3 hover:text-ink">
                <span className="white-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink">
                  <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                Templates
              </Link>
              <span aria-hidden="true" className="text-ink-3">
                /
              </span>
              <span aria-current="page" className="truncate text-ink">
                {template.name}
              </span>
            </nav>
            <div className="flex items-center gap-2.5 max-sm:w-full max-sm:[&>*]:flex-1">
              <StartWritingLink template={template.id} className={BLUE_PILL} preloadOnHover>
                Use {template.name}
                <ArrowRight aria-hidden="true" />
              </StartWritingLink>
            </div>
          </div>

          <div className="mt-[30px] grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
            {/* The template's own picture, made from its sample resume. */}
            <div className="tile self-start md:sticky md:top-28">
              <div className="tile-page rounded-[23px] max-sm:rounded-[17px]">
                <Image
                  src={template.image}
                  alt={templateImageAlt(template)}
                  fill
                  priority
                  sizes="(min-width: 768px) 45vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col md:pt-2">
              <span className="label-mono text-ink-3">{[...tags, "Free"].join(" · ")}</span>
              <h1 className="mt-3.5 text-balance font-serif text-[44px] leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]">
                {printedName(template)} resume <em className="pr-[0.04em] text-accent">template</em>
              </h1>
              <p className="mt-3 text-[16px] text-ink-3">Set in {template.font} · Letter or A4</p>
              {about.text.map((paragraph) => (
                <p key={paragraph} className="mt-4 max-w-[620px] text-pretty text-[16px] leading-relaxed text-ink-2">
                  {paragraph}
                </p>
              ))}
              {about.latex && (
                <p className="mt-4 max-w-[620px] text-pretty text-[16px] leading-relaxed text-ink-2">
                  You don’t need LaTeX or Overleaf: fill in the form and your browser makes the PDF. To keep editing in Overleaf too,
                  download a LaTeX file from the editor.
                </p>
              )}

              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
                <StartWritingLink
                  template={template.id}
                  className={sheetPill("blue", "h-[46px] px-[22px] text-[16px] font-medium")}
                  preloadOnHover
                >
                  Use {template.name}
                  <ArrowRight aria-hidden="true" />
                </StartWritingLink>
                <span className="text-[14px] text-ink-3">Switch any time; your writing stays put.</span>
              </div>
              <p className="mt-3 text-[14px] text-ink-3">
                Free, with{" "}
                <Link
                  href="/no-sign-up-resume-builder"
                  className="text-ink-2 underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                >
                  no sign-up
                </Link>{" "}
                and{" "}
                <Link
                  href="/resume-builder-no-watermark"
                  className="text-ink-2 underline decoration-rule-strong underline-offset-4 hover:decoration-ink"
                >
                  no watermark
                </Link>
                .
              </p>
            </div>
          </div>

          <nav aria-labelledby="other-templates" className="mt-14 flex flex-col gap-4">
            <h2 id="other-templates" className="label-mono text-ink-3">
              Other templates
            </h2>
            {/* Names only: a picture of every other template would draw the eye away from this one's. */}
            <ul className="flex flex-wrap items-baseline gap-y-1 font-serif text-[28px] leading-[1.25] tracking-[-0.03em] sm:text-[36px]">
              {TEMPLATES.filter((other) => other.id !== template.id).map((other, i, others) => (
                <li key={other.id} className="whitespace-nowrap">
                  <Link href={templatePath(other)} className="text-ink transition-colors hover:text-accent">
                    {other.name}
                  </Link>
                  {i < others.length - 1 && (
                    <span aria-hidden="true" className="px-[0.35em] italic text-rule-strong">
                      /
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}
