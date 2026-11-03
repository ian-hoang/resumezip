import { Layers, PenLine } from "lucide-react"
import { BLUE_PILL } from "@/components/pills"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { CARD_SHEET, COUNT_BADGE, PAPER_FRAME } from "@/components/site/sheet"
import { StartWritingLink } from "@/components/site/StartWriting"
import StructuredData from "@/components/site/StructuredData"
import { pageMetadata } from "@/lib/site"
import { breadcrumbs, TEMPLATES_CRUMB } from "@/lib/structuredData"
import { DEFAULT_TEMPLATE, newTemplate, TEMPLATES } from "@/lib/templates"
import TemplateGallery from "./TemplateGallery"

export const metadata = pageMetadata({
  path: "/templates",
  title: "Templates",
  description:
    "Free resume templates made for the hiring software (ATS) that reads them. Pick one, write in your browser, and download the PDF.",
})

export default function TemplatesPage() {
  // The page is built ahead of time, so the newest template is marked new until a build after it's no longer new.
  const marked = newTemplate(Date.now())

  return (
    <div className="desk desk-bright flex min-h-screen flex-col">
      <SiteHeader />
      <StructuredData data={breadcrumbs([TEMPLATES_CRUMB])} />

      <div className={PAPER_FRAME}>
        <main className={CARD_SHEET}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className={COUNT_BADGE}>
              <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{TEMPLATES.length} templates · All free</span>
            </p>
            {/* A blank resume in the default template, for someone who'd rather pick one later. */}
            <StartWritingLink template={DEFAULT_TEMPLATE} className={`${BLUE_PILL} max-sm:w-full`} preloadOnHover>
              <PenLine aria-hidden="true" />
              Start blank
            </StartWritingLink>
          </div>

          <div className="mt-9 flex flex-col gap-2 md:mt-2.5">
            <h1 className="text-balance font-serif text-[38px] leading-[1.05] tracking-[-0.025em] sm:text-[52px] md:text-[64px] md:leading-[1.02]">
              Pick a <em className="pr-[0.04em] text-accent">template</em>.
            </h1>
            <p className="text-balance text-[16px] leading-snug text-ink-3 md:text-[18.5px]">Switch any time; your writing stays put.</p>
          </div>

          <TemplateGallery newId={marked?.id} />
        </main>
      </div>

      <SiteFooter />
    </div>
  )
}
