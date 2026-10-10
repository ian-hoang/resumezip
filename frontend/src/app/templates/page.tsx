import type { Metadata } from "next"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { newTemplate } from "@/lib/templates"
import TemplateGallery from "./TemplateGallery"
import { SHEET } from "@/components/site/sheet"

export const metadata: Metadata = { title: "Templates" }

export default function TemplatesPage() {
  // The page is built ahead of time, so the newest template is marked new until a build after it's no longer new.
  const marked = newTemplate(Date.now())

  return (
    <div className="desk flex min-h-screen flex-col">
      <SiteHeader />

      <main className={`${SHEET} flex flex-col gap-10`}>
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="label-mono text-ink-2">Templates</span>
          <h1 className="font-serif text-5xl leading-[1.02] tracking-[-0.03em] md:text-[88px] md:leading-[0.95]">Pick a template.</h1>
          <p className="text-[17px] leading-relaxed text-ink-2">Switch any time; your writing stays put.</p>
        </div>

        <TemplateGallery newId={marked?.id} />
      </main>

      <SiteFooter />
    </div>
  )
}
