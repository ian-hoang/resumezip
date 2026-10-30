"use client"

import Image from "next/image"
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { ArrowRight, Check, ChevronDown, Copy, Layers, PenLine, Upload, type LucideIcon } from "lucide-react"
import { cleanTag, type ResumeWithId } from "@/lib/resume"
import { DEFAULT_TEMPLATE, TEMPLATES, templateById, type TemplateId } from "@/lib/templates"
import { PAPER_NAMES, PAPERS, readTune, TEMPLATE_SETTINGS, type Paper } from "@/lib/tune"
import { SEGMENT, SEGMENTS, sheetPill } from "@/components/pills"
import { useThumb } from "@/components/useThumb"
import Modal, { CancelButton } from "./Modal"
import { MENU_ITEM, MENU_PANEL, useMenu } from "./MoreMenu"
import PagePicture from "./PagePicture"
import { editedPhrase } from "./ResumeGrid"
import TypePicker from "./TypePicker"
import { nameOf } from "./useListActions"

/** How a new resume starts: empty, from a file, or as a copy of one here. */
type Start = "blank" | "file" | "copy"

const STARTS: { id: Start; label: string; icon: LucideIcon }[] = [
  { id: "blank", label: "Start blank", icon: PenLine },
  { id: "file", label: "Open a file", icon: Upload },
  { id: "copy", label: "Copy one", icon: Copy },
]

/** The template a resume is printed in and the paper it's printed on. */
interface Look {
  template: TemplateId
  paper: Paper
}

const lookOf = (resume: ResumeWithId | undefined): Look => {
  const template = templateById(resume?.selectedTemplate).id
  return { template, paper: readTune(resume?.tune).tune?.paper ?? TEMPLATE_SETTINGS[template].paper }
}

// What each start's panel sits in: a grey tray the same height for all three, so the dialog keeps its size
// between them, unless the type's chips need more room on a narrow screen.
const TRAY = "min-h-[188px] rounded-[28px] border border-hairline bg-[#f5f6f8] p-1.5"

interface CreateResumeModalProps {
  /** Types of the person's own already in use, to pick again. */
  own: string[]
  /** The resumes here, last edited first, one of which can be copied. */
  resumes: ResumeWithId[]
  /** A file is being dragged over the page: the dialog shows where it opens. */
  dragging: boolean
  onClose: () => void
  onCreate: (resume: { title: string; tag: string } & Look) => void
  onCopy: (id: string, look: Look) => void
  /** Opens the browser's file chooser. The dashboard opens the file chosen, which closes this. */
  onChooseFile: () => void
}

/**
 * New resume: a name and a type, as a box to type in with the type's chips
 * under it, and the template and paper at its foot. Or a file to open, or one
 * of the resumes here to copy, from the tabs above.
 */
export default function CreateResumeModal({ own, resumes, dragging, onClose, onCreate, onCopy, onChooseFile }: CreateResumeModalProps) {
  const id = useId()
  const [start, setStart] = useState<Start>("blank")
  // A file dragged over the page shows where it opens, and the tab the person was on comes back if it's taken away.
  const shown: Start = dragging ? "file" : start
  const [title, setTitle] = useState("")
  const [tag, setTag] = useState("professional")
  const [blankLook, setBlankLook] = useState<Look>({ template: DEFAULT_TEMPLATE, paper: TEMPLATE_SETTINGS[DEFAULT_TEMPLATE].paper })
  const [copyId, setCopyId] = useState(resumes[0]?.id ?? "")
  const original = resumes.find((resume) => resume.id === copyId)
  // The copy's template and paper, once changed here; until then, the original's.
  const [copyLook, setCopyLook] = useState<Look | null>(null)
  const look = shown === "copy" ? (copyLook ?? lookOf(original)) : blankLook
  const setLook = (next: Look) => (shown === "copy" ? setCopyLook(next) : setBlankLook(next))
  const tabs = useThumb(shown)
  const tabRefs = useRef(new Map<Start, HTMLButtonElement>())

  // Arrow keys, Home and End move between the tabs and open each (WAI-ARIA tabs pattern).
  const onTabKey = (event: KeyboardEvent, index: number) => {
    const last = STARTS.length - 1
    const next = { ArrowLeft: index === 0 ? last : index - 1, ArrowRight: index === last ? 0 : index + 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    setStart(STARTS[next].id)
    tabRefs.current.get(STARTS[next].id)?.focus()
  }

  return (
    <Modal title="New resume" onClose={onClose} fade large closeButton>
      <form
        className="flex flex-col sm:min-h-[370px]"
        onSubmit={(event) => {
          event.preventDefault()
          if (shown === "file") onChooseFile()
          else if (shown !== "copy") onCreate({ title: title.trim() || "Untitled resume", tag: cleanTag(tag), ...look })
          else if (original) onCopy(original.id, look)
        }}
      >
        <div
          ref={tabs.group}
          role="tablist"
          aria-label="How to start"
          className={`${SEGMENTS} mt-[21px] self-start overflow-x-auto no-scrollbar`}
        >
          <span ref={tabs.thumb} aria-hidden="true" className={`segment-thumb ${tabs.placed ? "" : "invisible"}`} />
          {STARTS.map((option, index) => {
            const selected = option.id === shown
            const Icon = option.icon
            return (
              <button
                key={option.id}
                ref={(element) => {
                  if (element) tabRefs.current.set(option.id, element)
                  else tabRefs.current.delete(option.id)
                }}
                type="button"
                role="tab"
                id={`${id}-${option.id}`}
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setStart(option.id)}
                onKeyDown={(event) => onTabKey(event, index)}
                // Until the white pill is placed, the chosen tab draws its own.
                // On a phone, without their icons, so all three fit.
                className={`${SEGMENT} px-3 max-sm:text-[14px] max-sm:[&_svg]:hidden sm:px-[15px] ${selected ? "text-ink" : "text-ink-3 hover:text-ink"} ${
                  selected && !tabs.placed ? "bg-sheet shadow-[0_1px_3px_rgb(17_19_24/0.14)]" : ""
                }`}
              >
                <Icon aria-hidden="true" />
                {option.label}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${shown}`} className="mt-[15px]">
          {/* Each start's panel fades in as it's chosen (`starting:` is CSS @starting-style). */}
          <div key={shown} className="transition-opacity duration-200 ease-out motion-reduce:transition-none starting:opacity-0">
            {shown === "blank" ? (
              <NameBox title={title} onTitle={setTitle} tag={tag} onTag={setTag} own={own} />
            ) : shown === "file" ? (
              <FileDrop dragging={dragging} onChooseFile={onChooseFile} />
            ) : (
              <CopyList
                resumes={resumes}
                chosen={original?.id}
                onChoose={(next) => {
                  setCopyId(next)
                  setCopyLook(null)
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-[23px] flex flex-wrap items-center gap-x-2.5 gap-y-3">
          {/* A template and paper for the new resume, or for the copy; none while there's nothing to copy. */}
          {(shown === "blank" || (shown === "copy" && original)) && (
            <div className="flex items-center gap-2.5">
              <ChoiceMenu
                label="Template"
                icon={<Layers aria-hidden="true" />}
                value={look.template}
                options={TEMPLATES.map((template) => ({ value: template.id, name: template.name, image: template.image }))}
                onChange={(template) => setLook({ ...look, template })}
              />
              <ChoiceMenu
                label="Paper"
                value={look.paper}
                options={PAPERS.map((paper) => ({ value: paper, name: PAPER_NAMES[paper] }))}
                onChange={(paper) => setLook({ ...look, paper })}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <CancelButton className={sheetPill("text", "h-11 px-4 text-[15px]")} />
            <button
              type="submit"
              disabled={shown === "copy" && !original}
              className={sheetPill("blue", "h-11 px-[18px] text-[15px] font-medium")}
            >
              {shown === "file" ? (
                <>
                  <Upload aria-hidden="true" />
                  Choose a file
                </>
              ) : (
                <>
                  Create
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/**
 * The name, in a white box like a prompt's, which has the focus as the dialog
 * opens, and the type's chips under it on the grey tray. A press anywhere on
 * the box goes to its input.
 */
function NameBox({
  title,
  onTitle,
  tag,
  onTag,
  own,
}: {
  title: string
  onTitle: (title: string) => void
  tag: string
  onTag: (tag: string) => void
  own: string[]
}) {
  const inputId = useId()
  const helpId = useId()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className={`${TRAY} flex flex-col`}>
      <div
        onMouseDown={(event) => {
          if (event.target === input.current) return
          event.preventDefault()
          input.current?.focus()
        }}
        className="cursor-text rounded-[22px] bg-sheet px-[21px] pb-[19px] pt-[19px] shadow-[inset_0_0_0_1px_#e3e5ea] transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_1px_#cfd3da] motion-reduce:transition-none"
      >
        <label htmlFor={inputId} className="block text-[13px] font-medium leading-4 text-ink-3">
          Name
        </label>
        <input
          ref={input}
          id={inputId}
          data-autofocus
          type="text"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          placeholder="Software engineer, 2026"
          autoComplete="off"
          aria-describedby={helpId}
          className="mt-1 block w-full bg-transparent text-[21px] leading-7 tracking-[-0.01em] text-ink outline-none placeholder:text-[#a2a6ae]"
        />
        <p id={helpId} className="mt-[17px] text-[13px] leading-4 text-ink-3">
          Only you see this. It isn&apos;t printed.
        </p>
      </div>
      <div className="px-2 pb-1 pt-[12px]">
        <TypePicker value={tag} onChange={onTag} own={own} />
      </div>
    </div>
  )
}

/** Where a file opens: dropped anywhere on the page, or chosen. The whole tray chooses one too, as Choose a file does. */
function FileDrop({ dragging, onChooseFile }: { dragging: boolean; onChooseFile: () => void }) {
  return (
    <div
      onClick={onChooseFile}
      className={`flex min-h-[188px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed px-6 py-6 text-center transition-colors duration-200 ${
        dragging ? "border-accent bg-accent/[0.05]" : "border-[#d4d7dd] bg-[#f9fafb] hover:border-[#b9bec7]"
      }`}
    >
      <span className="mb-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-sheet text-ink shadow-[0_0_0_1px_rgb(17_19_24/0.06),0_4px_10px_-3px_rgb(17_19_24/0.15)]">
        <Upload className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-[16px] font-medium text-ink">{dragging ? "Drop it here" : "Drop a PDF, Word or JSON file"}</span>
      <span className="text-[13px] text-ink-3">It&apos;s read in this browser, not uploaded.</span>
    </div>
  )
}

/** The resumes here, last edited first, to choose one to copy: the copy is named after it, with its type. */
function CopyList({ resumes, chosen, onChoose }: { resumes: ResumeWithId[]; chosen: string | undefined; onChoose: (id: string) => void }) {
  const name = useId()
  if (resumes.length === 0) {
    return (
      <div className="flex min-h-[188px] items-center justify-center rounded-[28px] border border-dashed border-[#d4d7dd] bg-[#f9fafb] px-6 text-center text-[15px] text-ink-3">
        No resumes to copy yet.
      </div>
    )
  }
  return (
    <div className={`${TRAY} h-[188px]`}>
      <div
        role="radiogroup"
        aria-label="Resume to copy"
        className="flex h-full flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-[22px] bg-sheet p-1.5 shadow-[inset_0_0_0_1px_#e3e5ea]"
      >
        {resumes.map((resume) => {
          const checked = resume.id === chosen
          return (
            <label
              key={resume.id}
              className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-[16px] px-2.5 py-[7px] transition-colors duration-150 has-[:focus-visible]:shadow-[inset_0_0_0_1.5px_rgb(17_19_24/0.22)] ${
                checked ? "bg-[#f1f3f8]" : "hover:bg-[#f7f8fa]"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={resume.id}
                checked={checked}
                onChange={() => onChoose(resume.id)}
                className="sr-only"
              />
              <PagePicture
                id={resume.id}
                resume={resume}
                sizes="30px"
                className="h-[39px] w-[30px] shrink-0 shadow-[0_0_0_1px_rgb(17_19_24/0.1)]"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium tracking-[-0.01em] text-ink">{nameOf(resume)}</span>
                <span className="truncate text-[13px] text-ink-3">
                  {[templateById(resume.selectedTemplate).name, editedPhrase(resume.updatedAt)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Check className={`h-4 w-4 shrink-0 text-accent ${checked ? "" : "invisible"}`} aria-hidden="true" />
            </label>
          )
        })}
      </div>
    </div>
  )
}

interface Choice<Value extends string> {
  value: Value
  name: string
  /** A picture of it, as a template's first page. */
  image?: string
}

/** A white pill showing a choice, the template or the paper, which opens a menu of the others above it. */
function ChoiceMenu<Value extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string
  icon?: ReactNode
  value: Value
  options: Choice<Value>[]
  onChange: (value: Value) => void
}) {
  const { open, setOpen, button, menu, close, onKeyDown, shown, closing } = useMenu()
  const menuId = useId()
  const list = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value) ?? options[0]
  // It opens with the chosen one in the middle of the list, which useMenu gives the keyboard without scrolling.
  useLayoutEffect(() => {
    const scroller = list.current
    const chosen = scroller?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (open && scroller && chosen) scroller.scrollTop = chosen.offsetTop - (scroller.clientHeight - chosen.offsetHeight) / 2
  }, [open])
  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label} ${current.name}`}
        onClick={() => setOpen((open) => !open)}
        className="white-button inline-flex h-9 items-center gap-2.5 rounded-full px-3.5 text-[14px] font-medium tracking-[-0.01em] [&_svg]:size-4"
      >
        {icon}
        {current.name}
        <ChevronDown
          className={`-ml-0.5 !size-3.5 text-ink-2 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {shown && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          inert={closing}
          className={`${MENU_PANEL} choice-menu bottom-full left-0 mb-2 ${closing ? "is-closing" : ""}`}
        >
          {/* The choices scroll inside the glass, not the glass itself: its frost is a layer of its own
              (.glass::before), which would scroll away with them and leave the menu see-through. */}
          <div
            ref={list}
            className="relative -m-1.5 flex max-h-[min(344px,55dvh)] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-[inherit] p-1.5"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === value}
                tabIndex={-1}
                onClick={() => {
                  close(true)
                  onChange(option.value)
                }}
                className={`${MENU_ITEM} shrink-0 text-ink`}
              >
                {option.image && (
                  <Image
                    src={option.image}
                    alt=""
                    width={22}
                    height={28}
                    className="h-7 w-[22px] shrink-0 bg-sheet object-cover object-top shadow-[0_0_0_1px_rgb(17_19_24/0.1)]"
                  />
                )}
                <span className="flex-1 whitespace-nowrap">{option.name}</span>
                <Check className={`h-4 w-4 shrink-0 text-accent ${option.value === value ? "" : "invisible"}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
