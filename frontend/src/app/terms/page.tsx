"use client"

import type React from "react"
import Link from "next/link"
import { useRef, useState } from "react"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"

type TabId = "terms" | "privacy" | "faq"

const TABS: { id: TabId; label: string; items: { title: string; body: string }[] }[] = [
  {
    id: "terms",
    label: "Terms of service",
    items: [
      {
        title: "What you’re agreeing to",
        body: "By using resumezip, you agree to these terms. If you don’t agree, please don’t use the site.",
      },
      {
        title: "What we actually do",
        body: "We help you build resumes that look like you spent hours on them (even if you didn’t). You enter your info, your browser runs it through our templates, and out comes a professional-looking PDF. All for free.",
      },
      {
        title: "Your PDF stays with you",
        body: "Your PDF is built in your browser and never uploaded to us. What you type is saved in your browser too, so clearing your browser data deletes your resumes. Download the ones you love.",
      },
      {
        title: "Third parties",
        body: "None. There are no accounts or logins, and your resume never leaves your browser.",
      },
      {
        title: "The legal bit",
        body: "No guarantees: things might break, and since everything’s free, there are no refunds. We’re not responsible for your resume’s success or failure. We wish you all the best.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy policy",
    items: [
      {
        title: "What we know about you",
        body: "Basically nothing. There are no accounts, and what you type in (jobs, skills, world domination plans) is saved in your own browser, not on our servers. Our host keeps basic request logs to keep the site running smoothly.",
      },
      {
        title: "Why we use that info",
        body: "Your browser uses your input to build your resume, and saves it so you can pick up where you left off on the same device. That’s it.",
      },
      {
        title: "Where your resume goes",
        body: "Nowhere. Your PDF is built in your browser and stays on your device unless you send it somewhere. You can rebuild it any time from your saved info.",
      },
      {
        title: "Data sharing and selling",
        body: "I don’t even know how to sell data. Your resume isn’t for sale, and neither are you.",
      },
    ],
  },
  {
    id: "faq",
    label: "FAQ",
    items: [
      {
        title: "Is resumezip really free?",
        body: "Yes, 100%. No fees, no upsells, no “pay $10 a month to continue.”",
      },
      {
        title: "How long is my resume stored?",
        body: "Your PDF isn’t stored at all: it’s built in your browser whenever you need it. What you type stays in your browser until you delete the resume or clear your browser data.",
      },
      {
        title: "Can I get feedback on my resume?",
        body: "Not yet. Feedback features are in progress (pinky promise).",
      },
      {
        title: "Do you share or sell my data?",
        body: "No. Your data stays private, in your own browser.",
      },
      {
        title: "Do I need an account?",
        body: "Nope. Open the builder and go. Your resumes are saved in the browser you use, so come back on the same device to keep editing.",
      },
    ],
  },
]

export default function TermsAndPrivacy() {
  const [activeTab, setActiveTab] = useState<TabId>("terms")
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern).
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1
    const targets: Record<string, number> = {
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowRight: index === last ? 0 : index + 1,
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    setActiveTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-24 pt-16 md:px-8 md:pt-20">
        <PageIntro label="Legal" title="Terms & privacy">
          We’re committed to transparency and protecting your data. These aren’t too boring, I promise.
        </PageIntro>

        <div
          role="tablist"
          aria-label="Terms, privacy and FAQ"
          className="mt-14 flex flex-wrap gap-x-6 border-b border-rule md:gap-x-8"
        >
          {TABS.map((tab, index) => {
            const selected = tab.id === activeTab
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  tabRefs.current[index] = element
                }}
                type="button"
                role="tab"
                id={`${tab.id}-tab`}
                aria-selected={selected}
                aria-controls={tab.id}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={`-mb-px cursor-pointer border-b-[1.5px] py-3 text-[15px] transition-colors ${
                  selected ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {TABS.map((tab) => (
          <div
            key={tab.id}
            id={tab.id}
            role="tabpanel"
            aria-labelledby={`${tab.id}-tab`}
            hidden={tab.id !== activeTab}
            tabIndex={0}
          >
            <h2 className="sr-only">{tab.label}</h2>
            <ol className="divide-y divide-rule">
              {tab.items.map((item, index) => (
                <li key={item.title} className="grid gap-3 py-7 md:grid-cols-3 md:gap-12">
                  <h3 className="flex items-baseline gap-4 font-serif text-[22px] leading-snug tracking-[-0.02em]">
                    <span className="label-mono shrink-0 text-ink-2">{String(index + 1).padStart(2, "0")}</span>
                    {item.title}
                  </h3>
                  <p className="max-w-2xl text-base leading-relaxed text-ink-2 md:col-span-2">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}

        <section className="mt-16 grid gap-6 border-t border-ink pt-6 md:grid-cols-3 md:gap-12">
          <h2 className="font-serif text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]">Questions?</h2>
          <div className="md:col-span-2">
            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">
              If you have any questions or concerns about our terms or privacy policy, don’t hesitate to get in
              touch.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex h-11 items-center rounded-[4px] bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              Contact us
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
