import Link from "next/link"
import PromisePage, { PromiseSection } from "@/components/site/PromisePage"
import { TEXT_LINK } from "@/components/site/sheet"
import { pageMetadata } from "@/lib/site"

const PATH = "/resume-builder-no-watermark"
const NAME = "Free resume builder with no watermark"

export const metadata = pageMetadata({
  path: PATH,
  title: NAME,
  description:
    "Download your resume as a PDF with no watermark: no logo, no “made with” line and no paid plan to remove one. Word and LaTeX downloads are free too.",
})

export default function NoWatermark() {
  return (
    <PromisePage
      path={PATH}
      name={NAME}
      heading={
        <>
          Your PDF, with <em className="text-accent">no watermark</em>
        </>
      }
      intro="No logo in the corner, no “made with” line at the bottom, and no paid plan to take them off. What you write is all that’s printed."
      limits={[
        "It doesn’t make cover letters.",
        "The LaTeX file starts with a comment saying it’s from resumezip. Comments aren’t printed, and you can delete it.",
      ]}
      questions={[
        {
          question: "Do I need an account to download?",
          answer: (
            <>
              No.{" "}
              <Link href="/no-sign-up-resume-builder" className={TEXT_LINK}>
                There’s no sign-up
              </Link>{" "}
              at all: press Download PDF and it’s saved.
            </>
          ),
        },
        {
          question: "Is there a limit on downloads?",
          answer: (
            <>
              No. Download as often as you like, in any template. Your browser makes each PDF, so each one costs nothing, and{" "}
              <Link href="/open-source-resume-builder" className={TEXT_LINK}>
                the code that makes it
              </Link>{" "}
              is open for anyone to read.
            </>
          ),
        },
        {
          question: "What’s the file attached to my PDF?",
          answer:
            "A copy of your resume, named resumezip.json, so resumezip can open the PDF for editing again. It isn’t printed, and the page’s text is only what you wrote.",
        },
      ]}
    >
      <PromiseSection id="printed" heading="What’s on the page">
        <p>
          Your writing, in the template you picked, and nothing else. No template prints resumezip’s name, a logo or a link back to the
          site, and there’s no paid version that prints less.
        </p>
      </PromiseSection>

      <PromiseSection id="downloads" heading="Every download is free">
        <p>
          A PDF to send, a Word file to edit in Word, Google Docs or Pages, a LaTeX file for Overleaf, and a JSON backup. None of them is
          behind a plan.
        </p>
      </PromiseSection>

      <PromiseSection id="reads" heading="What hiring software reads">
        <p>
          Hiring software reads the text in your PDF, so a watermark can end up read as part of your resume. resumezip’s PDFs only have your
          words to read. Each time the code changes, a test reads every template’s sample back as plain text to check it.
        </p>
      </PromiseSection>
    </PromisePage>
  )
}
