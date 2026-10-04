"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { useResumeContext } from "@/context/ResumeContext"
import CreateResumeModal from "@/components/dashboard/CreateResumeModal"
import DeleteResumeModal from "@/components/dashboard/DeleteResumeModal"
import ResumeTable from "@/components/dashboard/ResumeTable"
import PageIntro from "@/components/site/PageIntro"
import SiteFooter from "@/components/site/SiteFooter"
import SiteHeader from "@/components/site/SiteHeader"

export default function DashboardPage() {
  const router = useRouter()
  const { resumes, loaded, deleteResume, createNewResume } = useResumeContext()
  const [creating, setCreating] = useState(false)
  const [resumeToDelete, setResumeToDelete] = useState<Record<string, any> | null>(null)

  const sorted = useMemo(
    () =>
      Object.values(resumes as Record<string, any>).sort(
        (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
      ),
    [resumes],
  )

  const create = (title: string, tag: string) => {
    setCreating(false)
    router.push(`/create/new/${createNewResume(title, tag)}`)
  }

  const count = sorted.length
  const newResumeButton = (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-ink px-[18px] text-sm font-medium text-white transition-colors hover:bg-black"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      New resume
    </button>
  )

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12 px-5 pb-24 pt-16 md:px-8 md:pt-[72px]">
        <PageIntro
          label={loaded ? `${count} ${count === 1 ? "resume" : "resumes"} · stored in this browser` : "Stored in this browser"}
          title="Your resumes"
          actions={count > 0 ? newResumeButton : undefined}
        />

        {loaded && count > 0 && <ResumeTable resumes={sorted} onDelete={setResumeToDelete} />}

        {loaded && count === 0 && (
          <div className="flex flex-col items-start gap-5 border-t border-ink pt-8">
            <p className="font-serif text-[28px] leading-tight tracking-[-0.02em]">No resumes yet.</p>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
              Start one and it'll be saved here, in this browser.
            </p>
            {newResumeButton}
          </div>
        )}

        <div className="flex max-w-[720px] flex-wrap items-baseline gap-x-8 gap-y-3">
          <span className="label-mono text-accent">Stored locally</span>
          <p className="min-w-0 flex-[1_1_320px] text-sm leading-relaxed text-ink-2">
            Resumes live in this browser only. Clearing your browsing data removes them, so download a PDF of anything
            you&apos;d hate to lose.
          </p>
        </div>
      </main>

      <SiteFooter />

      {creating && <CreateResumeModal onClose={() => setCreating(false)} onCreate={create} />}
      {resumeToDelete && (
        <DeleteResumeModal
          resumeTitle={resumeToDelete.resumeTitle}
          onClose={() => setResumeToDelete(null)}
          onDelete={() => {
            deleteResume(resumeToDelete.id)
            setResumeToDelete(null)
          }}
        />
      )}
    </div>
  )
}
