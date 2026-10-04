"use client"

import type React from "react"

import Link from "next/link"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"

const SECTION = "mt-16 grid gap-8 border-t border-ink pt-6 md:grid-cols-3 md:gap-12"
const HEADING = "font-serif text-[28px] leading-[1.15] tracking-[-0.02em] md:text-[32px]"
const LABEL = "label-mono text-ink-2"
const FIELD =
  "w-full border-0 border-b border-rule-strong bg-transparent py-2 text-base text-ink outline-none focus:border-accent placeholder:text-ink-2/60"

const CONTACT_EMAIL = "resumezipio@gmail.com"

const SUBJECTS: Record<string, string> = {
  general: "General inquiry",
  support: "Technical support",
  feedback: "Feedback",
  partnership: "Partnership opportunity",
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // There's no server to send from, so hand the message to the visitor's
  // email app, addressed and filled in.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = `[resumezip] ${SUBJECTS[formData.subject] ?? "Message"}`
    const body = `${formData.message}\n\n${formData.name}${formData.email ? ` (${formData.email})` : ""}`
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setIsSubmitted(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-24 pt-16 md:px-10 md:pt-20">
        <PageIntro label="Contact" title="Get in touch">
          Have questions or feedback? We’d love to hear from you.
        </PageIntro>

        <section className={SECTION}>
          <div>
            <h2 className={HEADING}>Send a message</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-2">We’ll respond as soon as possible.</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Want to know how your privacy is protected? Read our{" "}
              <Link href="/terms" className="text-ink underline underline-offset-4 hover:decoration-2">
                terms and privacy policy
              </Link>
              .
            </p>
          </div>

          <div className="max-w-2xl md:col-span-2">
            {isSubmitted ? (
              <div>
                <h3 className="font-serif text-[28px] leading-[1.15] tracking-[-0.02em]">Check your email app</h3>
                <p className="mt-3 text-base leading-relaxed text-ink-2">
                  Your message should be open there, ready to send. If nothing opened, email us at{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-4">
                    {CONTACT_EMAIL}
                  </a>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-6 inline-flex h-11 cursor-pointer items-center rounded-[4px] border border-rule-strong px-5 text-sm text-ink transition-colors hover:border-ink"
                >
                  Back to the form
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className={LABEL}>
                      Your name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="John Doe"
                      className={FIELD}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className={LABEL}>
                      Email address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="you@example.com"
                      className={FIELD}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="subject" className={LABEL}>
                    Subject
                  </label>
                  <div className="relative">
                    {/* Muted while the placeholder option is showing (a required select with no value is :invalid). */}
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className={`${FIELD} cursor-pointer appearance-none pr-6 invalid:text-ink-2`}
                    >
                      <option value="" disabled>
                        Select a subject
                      </option>
                      <option value="general">General inquiry</option>
                      <option value="support">Technical support</option>
                      <option value="feedback">Feedback</option>
                      <option value="partnership">Partnership opportunity</option>
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="message" className={LABEL}>
                    Your message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    placeholder="Type your message here…"
                    className="w-full resize-y rounded-[4px] border border-rule bg-sheet px-3.5 py-3 text-base leading-relaxed text-ink outline-none focus:border-accent placeholder:text-ink-2/60"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="inline-flex h-11 cursor-pointer items-center rounded-[4px] bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black"
                  >
                    Send with your email app
                  </button>
                </div>
              </form>
            )}
            <p className="sr-only" aria-live="polite">
              {isSubmitted ? "Your email app should now be open with your message." : ""}
            </p>
          </div>
        </section>

        <section className={SECTION}>
          <h2 className={HEADING}>Email</h2>
          <div className="md:col-span-2">
            <p className="text-base leading-relaxed text-ink-2">For any inquiries, you can also reach us by email.</p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-block font-serif text-2xl tracking-[-0.02em] text-ink underline decoration-1 underline-offset-4 hover:decoration-2 md:text-[28px]"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
