"use client"

import type React from "react"
import { useId, useState } from "react"
import Link from "next/link"

const REPO_URL = "https://github.com/ian-hoang/resumezip"
const TEXT_LINK = "text-[#171717] underline underline-offset-4 hover:decoration-2"

// Each answer has to stay true of the app: check the code before changing one.
const QUESTIONS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "Is it really free?",
    answer: "Yes. Every template and every download. No ads, no trial, no watermark.",
  },
  {
    question: "Do you keep my resume?",
    answer: (
      <>
        No. It’s saved in this browser, and we don’t store it. The code is{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
          open source
        </a>
        , so anyone can check.
      </>
    ),
  },
  {
    question: "How do I edit it later, or on another computer?",
    answer: (
      <>
        On{" "}
        <Link href="/create/dashboard" className={TEXT_LINK}>
          Your resumes
        </Link>
        , open the PDF you downloaded: resumezip reads your resume back out of it. A JSON file, from the ▾ beside Download PDF, opens the
        same way, and keeps what you left out of the PDF too.
      </>
    ),
  },
  {
    question: "Will hiring software be able to read it?",
    answer:
      "Yes. The PDF is real text, not a picture, and its links and contact details are printed as text, so hiring software can read every word.",
  },
  {
    question: "Can I bring the resume I already have?",
    answer:
      "Yes. Open a PDF or Word (.docx) file from Your resumes, and resumezip sorts it into the editor’s fields for you to check. It’s read in your browser, not uploaded.",
  },
  {
    question: "What happens if I clear my browser?",
    answer:
      "The resumes saved in it go too, as we don’t keep a copy. Keep the PDFs you download, or a JSON file of them all from Download all, and open it to bring them back. Safari also clears a site’s data after seven days of use without a visit.",
  },
  {
    question: "Can I use it on my phone?",
    answer: "Yes. On a phone, the editor has an Edit and Preview switch at the bottom: write, then see the page as it will print.",
  },
]

/** Opens on the one people ask most. */
const FIRST_OPEN = 1

/** The home page's questions: one answer open at a time. */
export default function Questions() {
  const [open, setOpen] = useState<number | null>(FIRST_OPEN)
  const id = useId()

  return (
    <section aria-labelledby="questions" data-tone="light" data-tick className="bg-white">
      <div className="grid gap-10 px-5 pb-24 pt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,9fr)] md:gap-10 md:px-10 md:pb-[120px] md:pt-[72px]">
        <div className="flex flex-col gap-4">
          <h2 id="questions" className="label-section text-accent">
            Questions
          </h2>
          <p className="max-w-[420px] font-serif text-5xl leading-[0.95] tracking-[-0.04em] md:text-[64px]">Asked before you start.</p>
        </div>

        <div className="flex flex-col gap-2.5">
          {QUESTIONS.map((item, index) => {
            const expanded = open === index
            const button = `${id}-q${index}`
            const panel = `${id}-a${index}`
            return (
              <div
                key={item.question}
                className={`border transition-colors duration-200 ${expanded ? "border-[#171717]" : "border-[#d4d4d4] hover:border-[#a3a3a3]"}`}
              >
                <h3>
                  <button
                    id={button}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panel}
                    onClick={() => setOpen(expanded ? null : index)}
                    className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left text-lg leading-[1.3] tracking-[-0.015em] md:px-6 md:py-6 md:text-xl"
                  >
                    {item.question}
                    <span aria-hidden="true" className="question-sign relative h-3.5 w-3.5 shrink-0" data-open={expanded || undefined} />
                  </button>
                </h3>
                {/* Grows to its height; closed, inert keeps the keyboard and screen readers out. */}
                <div
                  id={panel}
                  inert={!expanded}
                  className={`grid transition-[grid-template-rows,visibility] duration-300 ease-glide motion-reduce:transition-none ${
                    expanded ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[620px] px-5 pb-6 text-base leading-[1.5] tracking-[-0.01em] text-[#5c5c5c] md:px-6 md:text-[17px]">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
