import type { Metadata } from "next"
import Image from "next/image"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"
import { StartWritingLink } from "@/components/site/StartWriting"
import { TEMPLATES } from "@/lib/templates"

export const metadata: Metadata = { title: "Templates" }

export default function TemplatesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-12 px-5 pb-24 pt-16 md:px-10 md:pt-20">
        <PageIntro label="Templates" title="Pick a template.">
          Switch any time; your writing stays put.
        </PageIntro>

        <div className="grid grid-cols-1 gap-x-8 gap-y-12 border-t border-ink pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((template) => (
            <StartWritingLink key={template.id} template={template.id} className="group flex flex-col gap-4">
              <div
                data-page
                className="relative aspect-[8.5/11] w-full overflow-hidden bg-sheet ring-1 ring-rule transition-shadow group-hover:ring-ink"
              >
                <Image
                  src={template.image}
                  alt={`${template.name} template`}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-rule pt-3">
                <span className="text-[15px]">{template.name}</span>
                <span className="text-sm text-ink-2 underline-offset-4 group-hover:text-ink group-hover:underline">Use template</span>
              </div>
            </StartWritingLink>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
