"use client"

import { Plus } from "lucide-react"
import { DropTile } from "./ResumeGrid"

interface EmptyShelfProps {
  onNew: () => void
  onChooseFile: () => void
  dragging: boolean
}

/**
 * What the dashboard shows before there are any resumes: empty pages where
 * they'll go, the first to start one and the second to open a file. The
 * rest are only outlines.
 */
export default function EmptyShelf({ onNew, onChooseFile, dragging }: EmptyShelfProps) {
  return (
    <div className="flex flex-col gap-8 border-t border-ink pt-8">
      <div className="flex flex-col gap-3">
        <p className="font-serif text-[28px] leading-tight tracking-[-0.02em]">No resumes yet.</p>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-2">
          Start one, or open a resume you already have: a PDF, a Word file, or a JSON file from resumezip.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 xl:grid-cols-5">
        <li className="min-w-0">
          <button type="button" onClick={onNew} className="new-slot">
            <span className="new-slot-plus" aria-hidden="true">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[16px] font-medium text-ink md:text-[17px]">New resume</span>
          </button>
        </li>
        <li className={`min-w-0 ${dragging ? "relative z-[45]" : ""}`}>
          <DropTile onChooseFile={onChooseFile} dragging={dragging} />
        </li>
        {/* Where later resumes go: outlines only, fading out, as many as fit on the row. */}
        {[0.7, 0.45, 0.25].map((opacity, index) => (
          <li
            key={opacity}
            aria-hidden="true"
            style={{ opacity }}
            className={`aspect-[8.5/11] rounded-[2px] border border-dashed border-rule-strong ${
              index === 0 ? "hidden md:block" : index === 1 ? "hidden lg:block" : "hidden xl:block"
            }`}
          />
        ))}
      </ul>
    </div>
  )
}
