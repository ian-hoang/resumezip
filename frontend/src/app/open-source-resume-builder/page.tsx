import type React from "react"
import Link from "next/link"
import PromisePage, { PromiseSection } from "@/components/site/PromisePage"
import { TEXT_LINK } from "@/components/site/sheet"
import { pageMetadata, REPO_URL } from "@/lib/site"
import { CODE, onGitHub } from "./code"

const PATH = "/open-source-resume-builder"
const NAME = "Open-source resume builder"

export const metadata = pageMetadata({
  path: PATH,
  title: NAME,
  description:
    "resumezip’s code is public on GitHub under the MIT License. Read how your resume is saved and made into a PDF, report a problem, or run it yourself.",
})

function Code({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a href={onGitHub(path)} className={TEXT_LINK}>
      {children}
    </a>
  )
}

export default function OpenSource() {
  return (
    <PromisePage
      path={PATH}
      name={NAME}
      heading={
        <>
          An <em className="text-accent">open-source</em> resume builder
        </>
      }
      intro="All of resumezip’s code is on GitHub, under the MIT License. You don’t have to take our word for what it does with your resume: you can read it."
      limits={[
        "Open source doesn’t mean anyone can see your resume. The code is public; your resume is saved in your browser, and we don’t store it.",
        "There’s no app to install. resumezip runs in your browser, or on your own computer if you run the code yourself.",
      ]}
      questions={[
        {
          question: "Can I use the code in my own project?",
          answer: (
            <>
              Yes, under the <Code path={CODE.license}>MIT License</Code>: keep its notice with the code.
            </>
          ),
        },
        {
          question: "Does open source mean it’s free?",
          answer: (
            <>
              resumezip is free either way, with{" "}
              <Link href="/no-sign-up-resume-builder" className={TEXT_LINK}>
                no sign-up
              </Link>{" "}
              and{" "}
              <Link href="/resume-builder-no-watermark" className={TEXT_LINK}>
                no watermark on your PDF
              </Link>
              .
            </>
          ),
        },
        {
          question: "How do I report a problem or ask for something?",
          answer: (
            <>
              Open an issue on{" "}
              <a href={`${REPO_URL}/issues`} className={TEXT_LINK}>
                GitHub
              </a>
              , or{" "}
              <Link href="/contact" className={TEXT_LINK}>
                write to us
              </Link>
              .
            </>
          ),
        },
      ]}
    >
      <PromiseSection id="check" heading="What you can check">
        <p>
          <Code path={CODE.storage}>Where your resume is saved</Code>: in your browser’s storage, unless you save a PDF to your own Google
          Drive. <Code path={CODE.pdf}>How your PDF is made</Code>: by Typst, running in your browser. And{" "}
          <Code path={CODE.sites}>the list of sites the app’s pages may connect to</Code>, in its security policy, with why each one is
          there.
        </p>
      </PromiseSection>

      <PromiseSection id="templates" heading="The templates too">
        <p>
          Each <Code path={CODE.templates}>template</Code> is a file you can read and change, and so is every{" "}
          <Code path={CODE.checks}>check</Code> the editor runs on your resume. A test reads each template’s sample back as plain text, the
          way hiring software does.
        </p>
      </PromiseSection>

      <PromiseSection id="run" heading="Run it yourself">
        <p>
          With Node 24, clone{" "}
          <a href={REPO_URL} className={TEXT_LINK}>
            the repository
          </a>
          , then run <code>npm install</code> and <code>npm run dev</code> in its <code>frontend</code> folder. resumezip opens on your own
          computer.
        </p>
      </PromiseSection>
    </PromisePage>
  )
}
