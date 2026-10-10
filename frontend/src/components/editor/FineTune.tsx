"use client"

import { useId, useSyncExternalStore } from "react"
import { useOpenResume, useResumeField } from "@/context/ResumeContext"
import { templateById } from "@/lib/templates"
import { onPreviewFit, previewFit } from "@/lib/typst/compile"
import { printedTune, readTune, SCALES, TEMPLATE_SETTINGS, withSetting, type Paper, type Tune, type TuneScale } from "@/lib/tune"

const PAPER_NAMES: Record<Paper, string> = { "us-letter": "Letter", a4: "A4" }

// Numbers as the panel shows them: no more decimals than they need.
const decimals = (value: number, places: number) => String(Number(value.toFixed(places)))

/** The editor's Fine-tune controls: text size, margins, line spacing, paper, and keeping to one page. */
export default function FineTune() {
  const { update } = useOpenResume()
  const saved = useResumeField("tune")
  const template = templateById(useResumeField("selectedTemplate")).id
  const own = TEMPLATE_SETTINGS[template]
  const printed = printedTune(saved)
  const paper = printed.paper || own.paper
  const set = <Key extends keyof Tune>(key: Key, value: Tune[Key]) => update("tune", withSetting(saved, key, value))

  // What keeping the preview to one page took, once the preview shows these settings.
  const shown = useSyncExternalStore(onPreviewFit, previewFit, () => null)
  const fit = shown && shown.template === template && JSON.stringify(shown.tune) === JSON.stringify(printed) ? shown.fit : null
  const points = (size: number) => decimals(own.size * size, 1)
  const status = !fit
    ? ""
    : !fit.fits
      ? "Still over one page at the smallest size"
      : fit.size < printed.size
        ? `Text set to ${points(fit.size)} pt to fit`
        : ""

  const margin = own.margin * printed.margin
  return (
    <div className="flex flex-col gap-6 font-sans text-ink">
      <Group title="Type">
        <Slider
          label="Text size"
          scale="size"
          value={printed.size}
          shown={`${points(printed.size)} pt`}
          spoken={`${points(printed.size)} points`}
          onChange={(value) => set("size", value)}
        />
        <Slider
          label="Line spacing"
          scale="leading"
          value={printed.leading}
          shown={`${printed.leading.toFixed(2)}×`}
          spoken={`${decimals(printed.leading, 2)} times`}
          onChange={(value) => set("leading", value)}
        />
      </Group>

      <Group title="Page">
        <Slider
          label="Margins"
          scale="margin"
          value={printed.margin}
          shown={paper === "a4" ? `${Math.round(margin * 25.4)} mm` : `${decimals(margin, 2)} in`}
          spoken={paper === "a4" ? `${Math.round(margin * 25.4)} millimeters` : `${decimals(margin, 2)} inches`}
          onChange={(value) => set("margin", value)}
        />
        <PaperChoice value={paper} onChange={(next) => set("paper", next === own.paper ? undefined : next)} />
      </Group>

      <div className="flex flex-col gap-2">
        <Toggle label="Keep it to one page" on={printed.onePage} onChange={(on) => set("onePage", on)} />
        {/* A live region, so the change it made is heard as well as seen. */}
        <p role="status" className="min-h-[1lh] pl-12 text-[13px] leading-snug text-ink-2">
          {printed.onePage ? status : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={() => update("tune", null)}
        disabled={readTune(saved).tune === null}
        className="inline-flex h-8 items-center self-start rounded-full bg-sheet/70 px-3.5 text-[13px] text-ink ring-1 ring-ink/15 transition-[box-shadow,color] hover:ring-ink/40 disabled:cursor-default disabled:bg-transparent disabled:text-ink-2/60 disabled:ring-ink/[0.08]"
      >
        Reset to the template&rsquo;s
      </button>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h3 id={id} className="label-mono text-ink-2">
        {title}
      </h3>
      {children}
    </section>
  )
}

interface SliderProps {
  label: string
  scale: TuneScale
  value: number
  /** The value as the panel shows it ("10.5 pt"), and as a screen reader says it ("10.5 points"). */
  shown: string
  spoken: string
  onChange: (value: number) => void
}

// A real range input, restyled: a hairline track, inked up to a white round
// thumb. The track is the input's own background, so it's drawn the same in
// every browser; the thumb is 16px, so the ink ends at its middle.
function Slider({ label, scale, value, shown, spoken, onChange }: SliderProps) {
  const id = useId()
  const { min, max, step } = SCALES[scale]
  const share = (value - min) / (max - min)
  const ink = `linear-gradient(var(--color-ink), var(--color-ink)) left center / calc(${share} * (100% - 16px) + 8px) 2px no-repeat`
  const hairline = "linear-gradient(var(--color-rule-strong), var(--color-rule-strong)) left center / 100% 1px no-repeat"
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <span aria-hidden className="font-mono text-xs tabular-nums text-ink-2">
          {shown}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={spoken}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        style={{ background: `${ink}, ${hairline}` }}
        className="h-5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-rule-strong [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_1px_3px_rgb(17_19_24/0.22)] [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-0.5 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-rule-strong [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgb(17_19_24/0.22)]"
      />
    </div>
  )
}

// Letter or A4, as two segments of one pill: radio buttons, so arrow keys move between them.
function PaperChoice({ value, onChange }: { value: Paper; onChange: (paper: Paper) => void }) {
  const name = useId()
  return (
    <fieldset className="grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1">
      <legend className="sr-only">Paper</legend>
      {(Object.keys(PAPER_NAMES) as Paper[]).map((paper) => (
        <label
          key={paper}
          className={`cursor-pointer rounded-full py-1.5 text-center text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
            paper === value ? "bg-white text-ink shadow-[0_1px_3px_rgb(17_19_24/0.12)]" : "text-ink-2 hover:text-ink"
          }`}
        >
          <input type="radio" name={name} value={paper} checked={paper === value} onChange={() => onChange(paper)} className="sr-only" />
          {PAPER_NAMES[paper]}
        </label>
      ))}
    </fieldset>
  )
}

// A pill switch: inked, with its white knob to the right, when on.
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-3 self-start rounded-full text-sm"
    >
      <span
        aria-hidden
        className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-ink" : "bg-ink/[0.14]"}`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(17_19_24/0.25)] transition-transform duration-200 ease-glide motion-reduce:transition-none ${
            on ? "translate-x-4" : ""
          }`}
        />
      </span>
      {label}
    </button>
  )
}
