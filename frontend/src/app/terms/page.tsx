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
        title: "Using resumezip",
        body: "By using resumezip, you agree to these terms. If you don’t, please don’t use the site.",
      },
      {
        title: "What it does",
        body: "You fill in your details and pick a template, and your browser turns them into a PDF. It’s free.",
      },
      {
        title: "Your resumes",
        body: "What you write is yours. It’s saved only in your browser, so clearing your browser data deletes it. Download a PDF of anything you want to keep.",
      },
      {
        title: "No accounts",
        body: "There’s nothing to sign up for, and no outside service ever sees your resume.",
      },
      {
        title: "No guarantees",
        body: "resumezip is provided as is. It may have bugs or downtime, and we can’t promise any result from using it.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy policy",
    items: [
      {
        title: "What we collect",
        body: "Nothing you type. There are no ads or trackers. Our host keeps basic server logs, like which pages were visited, to keep the site running. The editor downloads its PDF engine from jsDelivr, a public code host, which logs downloads the same way.",
      },
      {
        title: "How it’s used",
        body: "What you type is only used in your browser, to build your resume and save your progress.",
      },
      {
        title: "Where your resume goes",
        body: "Nowhere. Your PDF is made on your device and stays there unless you send it to someone.",
      },
      {
        title: "Sharing and selling",
        body: "We don’t share or sell your data. We never receive your resume in the first place.",
      },
    ],
  },
  {
    id: "faq",
    label: "FAQ",
    items: [
      {
        title: "Is resumezip really free?",
        body: "Yes. No fees, no upsells, no subscriptions.",
      },
      {
        title: "Do I need an account?",
        body: "No. Open the builder and start writing.",
      },
      {
        title: "How long are my resumes kept?",
        body: "Until you delete them or clear your browser data. They’re saved in this browser only and don’t sync to other devices.",
      },
      {
        title: "Do you share or sell my data?",
        body: "No. Your resume stays in your browser, so we never see it.",
      },
      {
        title: "Can I get feedback on my resume?",
        body: "Not yet, but it’s on the way.",
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
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-24 pt-16 md:px-10 md:pt-20">
        <PageIntro label="Legal" title="Terms & privacy">
          The short version: your resume stays in your browser, and we never see it.
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
              Ask us anything about these terms or your privacy.
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
