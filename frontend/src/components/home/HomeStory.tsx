"use client"

import type React from "react"
import { Fragment, type RefObject, useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import LiquidLens from "@/components/LiquidLens"
import { INK_GLASS_PILL } from "@/components/pills"
import { StartWritingLink } from "@/components/site/StartWriting"
import FloatingStart from "./FloatingStart"
import { BEATS, CLICK, STORY_LENGTH, clamp, glide, inOut, lerp, out3, smooth, span, storyAt } from "./motion"
import type { Stroke } from "./pen"
import { EDITOR, MARKS, type Overlay, type StageLayout, cameraAt, layoutStage, marksOnPicture, strokeTimes, wayInAt } from "./stage"

// Visitors who ask for less motion get the story as still sections.
const lessMotion = (onChange: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const useLessMotion = () =>
  useSyncExternalStore(
    lessMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )

// The marks on the editor's picture, the same at every size: the picture scales, and they with it.
const MARKED = marksOnPicture()

// The pointer that clicks the editor's menus open, as a share of the editor's width, and where its
// tip is on it, as shares of its size.
const POINTER = 0.026
const TIP = [5 / 24, 3 / 24] as const

/**
 * The home page as a story the scroll plays, on a stage pinned to the screen:
 * the first screen (`hero`) on the meadow lifts away as the editor rises out of
 * the grass, then what it does is marked on it by hand, left to right, each with
 * a note and an arrow, its menus clicked open to be marked, and then the way in.
 */
export default function HomeStory({ hero }: { hero: React.ReactNode }) {
  const router = useRouter()
  // The address to write to was at the story's end, and links were made to it there (/#contact, and
  // /about#contact, which /about's redirect keeps): they go to the contact page. Replaced in the app,
  // not by location.replace(): a browser that kept /contact's old permanent redirect to /#contact
  // would go round in a loop.
  useEffect(() => {
    if (window.location.hash === "#contact") router.replace("/contact")
  }, [router])
  return useLessMotion() ? <StillStory hero={hero} /> : <MovingStory hero={hero} />
}

/** What the marks say, for screen readers: the story shows them as handwriting. */
function Said() {
  return (
    <section className="sr-only" aria-labelledby="what-it-does">
      <h2 id="what-it-does">What it does</h2>
      <ul>
        {MARKS.map((mark) => (
          <li key={mark.said}>{mark.said}</li>
        ))}
      </ul>
    </section>
  )
}

/** A handwritten note, a line at a time. */
function Note({
  lines,
  ref,
  style,
}: {
  lines: readonly string[]
  ref?: (element: HTMLParagraphElement | null) => void
  style?: React.CSSProperties
}) {
  return (
    <p ref={ref} className="home-hand" style={style}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  )
}

interface StrokesProps {
  strokes: Stroke[][]
  /** The first mark's index, when these are some marks' strokes but not all. */
  first?: number
  masks: RefObject<(SVGPathElement | null)[][]>
  prefix: string
}

/**
 * The strokes of the marker, each drawn in by a mask along its middle, as the
 * story draws it: `masks` collects the masks' paths, by mark, then stroke.
 */
function Strokes({ strokes, first = 0, masks, prefix }: StrokesProps) {
  return (
    <>
      <defs>
        {strokes.map((drawn, k) =>
          drawn.map((stroke, j) => (
            <mask key={`${first + k}-${j}`} id={`${prefix}-${first + k}-${j}`}>
              <path
                ref={(path) => {
                  masks.current[first + k] ??= []
                  masks.current[first + k][j] = path
                }}
                d={stroke.center}
                fill="none"
                stroke="#fff"
                strokeWidth={stroke.width * 2.6 + 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1}
                visibility="hidden"
              />
            </mask>
          )),
        )}
      </defs>
      {strokes.map((drawn, k) => (
        <g key={first + k} data-mark={first + k}>
          {drawn.map((stroke, j) => (
            <path key={j} className="home-mark" d={stroke.outline} mask={`url(#${prefix}-${first + k}-${j})`} />
          ))}
        </g>
      ))}
    </>
  )
}

/** A picture laid over the editor's, where it lies on it. */
function OverlayPicture({ overlay, ref }: { overlay: Overlay; ref: (element: HTMLImageElement | null) => void }) {
  const [left, top, right, bottom] = overlay.box
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={overlay.src}
      alt=""
      fetchPriority="low"
      className="home-overlay"
      style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${(right - left) * 100}%`, height: `${(bottom - top) * 100}%` }}
    />
  )
}

interface WayInProps {
  ref?: RefObject<HTMLElement | null>
  copyRef?: RefObject<HTMLDivElement | null>
  onFocus?: () => void
}

/** The way in, at the end: over the editor, in the site's frosted glass. */
function WayIn({ ref, copyRef, onFocus }: WayInProps) {
  return (
    <section ref={ref} aria-labelledby="way-in" className="home-cta glass glass-float" onFocus={onFocus}>
      <span aria-hidden="true" className="home-cta-shadow" />
      <LiquidLens bevel={26} strength={1.25} />
      <div ref={copyRef} className="home-cta-copy text-center">
        <p className="label-mono text-ink-2">Your turn</p>
        <h2 id="way-in" className="mt-3 text-balance font-serif text-[clamp(36px,3.5vw,50px)] leading-[1.02] tracking-[-0.035em]">
          Ready when <em className="text-accent">you are.</em>
        </h2>
        <p className="mt-3.5 text-balance text-[15.5px] leading-normal text-ink-2 sm:text-[17px]">
          Every template is free, and{" "}
          <Link href="/private-resume-builder" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            your resume stays in your browser
          </Link>
          .
        </p>
        <StartWritingLink className={`${INK_GLASS_PILL} mt-6`} preloadOnHover>
          Start writing <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </StartWritingLink>
      </div>
    </section>
  )
}

function MovingStory({ hero }: { hero: React.ReactNode }) {
  const id = useId().replace(/[^a-z0-9]/gi, "")
  const story = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const heroBox = useRef<HTMLDivElement>(null)
  const meadow = useRef<HTMLImageElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const editor = useRef<HTMLElement>(null)
  const lens = useRef<HTMLDivElement>(null)
  const inkBox = useRef<HTMLDivElement>(null)
  const wayIn = useRef<HTMLElement>(null)
  const wayInCopy = useRef<HTMLDivElement>(null)
  // The masks that draw each mark on the editor, each arrow's, and each note.
  const markMasks = useRef<(SVGPathElement | null)[][]>([])
  const arrowMasks = useRef<(SVGPathElement | null)[][]>([])
  const notes = useRef<(HTMLParagraphElement | null)[]>([])
  // Each mark's loop on the editor.
  const loops = useRef<(SVGSVGElement | null)[]>([])
  // Each mark's menu, if it has one: all of it, its button pressed, and it open.
  const menus = useRef<(HTMLDivElement | null)[]>([])
  const pressed = useRef<(HTMLImageElement | null)[]>([])
  const opened = useRef<(HTMLImageElement | null)[]>([])
  const pointer = useRef<SVGSVGElement>(null)
  // Laid out once the screen is measured: the arrows and notes are only drawn after that.
  const [layout, setLayout] = useState<StageLayout | null>(null)
  // The small Start writing at the screen's foot shows between the first screen's and the way in's.
  const [between, setBetween] = useState(false)
  // Draws the story where it is; set once the stage is measured. A new layout redraws it.
  const redraw = useRef<() => void>(() => {})
  // The way in shows itself when it's focused: it's at the story's end.
  const toEnd = useRef<() => void>(() => {})

  useEffect(() => {
    const parts = { story, stage, heroBox, meadow, shade, editor, lens, inkBox, wayIn, wayInCopy, pointer }
    const el = Object.fromEntries(Object.entries(parts).map(([name, ref]) => [name, ref.current])) as {
      [K in keyof typeof parts]: NonNullable<(typeof parts)[K]["current"]>
    }
    if (Object.values(el).some((part) => !part)) return
    let screen = { width: 0, height: 0 }
    let laid: StageLayout
    let wayInHeight = 0
    // How far each mark is drawn, and how much of its arrow and note shows: the story asks every
    // frame, and drawing a mask again repaints, so what hasn't changed is left as it is.
    let drawnTo: number[] = []
    let shownTo: number[] = []

    function measure() {
      // The stage's height, not the window's: a phone's window grows taller than the stage (100svh)
      // as its toolbar tucks away, and what's laid out past the stage's foot is cut off. A page
      // opened in a hidden tab can be told neither has a size yet.
      const height = el.stage.clientHeight || window.innerHeight
      screen = { width: Math.max(window.innerWidth, 320), height: Math.max(height, 480) }
      laid = layoutStage(screen)
      setLayout(laid)
      // The new arrows aren't drawn yet.
      drawnTo = []
      shownTo = []
      const { editor } = laid
      Object.assign(el.editor.style, {
        width: `${editor.width}px`,
        height: `${editor.height}px`,
        left: `${editor.x}px`,
        top: `${editor.y}px`,
      })
      el.wayIn.style.setProperty("--cta-width", `${wayInAt(laid, screen, 0).width}px`)
      wayInHeight = el.wayInCopy.offsetHeight
      el.pointer.style.width = `${editor.width * POINTER}px`
    }

    /** Mark `i` drawn `t` of the way: its loop, then its arrow, then its note writing in from the left. */
    function draw(i: number, t: number) {
      if (drawnTo[i] === t) return
      drawnTo[i] = t
      // The pen over the first three quarters, the note writing in over the last half.
      const pen = clamp(t / 0.75)
      const strokes = [...(markMasks.current[i] ?? []), ...(arrowMasks.current[i] ?? [])]
      strokeTimes(strokes.length).forEach(([from, to], j) => {
        const done = clamp((pen - from) / (to - from))
        strokes[j]?.setAttribute("stroke-dashoffset", String(1 - done))
        // Not started, it's hidden: Safari draws an empty dash's round cap as a dot.
        strokes[j]?.setAttribute("visibility", done > 0 ? "visible" : "hidden")
      })
      const note = notes.current[i]
      if (!note) return
      const written = clamp((t - 0.45) / 0.55)
      note.style.visibility = written > 0 ? "visible" : "hidden"
      // Past the box's right edge once it's all written: a hand's last letter leans out of it.
      note.style.clipPath = `inset(-30% ${(1 - written) * 112 - 8}% -30% -10%)`
    }

    /** How much of mark `i`'s arrow and note shows. */
    function show(i: number, shown: number) {
      if (shownTo[i] === shown) return
      shownTo[i] = shown
      el.inkBox.querySelector(`[data-mark="${i}"]`)?.setAttribute("opacity", String(shown))
      const note = notes.current[i]
      if (note) note.style.opacity = String(shown)
    }

    function render(v: number) {
      const { height: vh } = screen

      // A part that's out of the story is faded to nothing, not hidden (see .home-stage in home.css),
      // except the first screen, which is hidden too once it's gone, to take its links out of the Tab order.

      // The first screen lifts away, softening, as the editor comes up.
      const gone = smooth(span(v, BEATS.hero))
      el.heroBox.style.opacity = String(1 - gone)
      el.heroBox.style.transform = `translate3d(0, ${-gone * vh * 0.12}px, 0) scale(${1 - 0.04 * gone})`
      el.heroBox.style.filter = gone > 0.01 ? `blur(${gone * 6}px)` : "none"
      el.heroBox.style.visibility = gone > 0.99 ? "hidden" : ""
      // The deeper sky is for the first screen's white words: it goes with them, so the notes' blue
      // ink is written on the plain sky.
      el.shade.style.opacity = String(1 - gone)

      // The camera eases toward the meadow.
      el.meadow.style.transform = `scale(${1 + 0.07 * inOut(span(v, BEATS.push))})`

      // The editor rises out of the grass, coming into focus, then softens a little as the way in
      // arrives, so that's what's sharp. On a phone the camera moves in on each mark.
      const rose = span(v, BEATS.editor)
      const wrap = smooth(span(v, BEATS.wrap))
      el.editor.style.opacity = String(smooth(span(rose, [0, 0.3])))
      if (rose > 0) {
        const up = out3(rose)
        el.editor.style.transform = `translate3d(0, ${(1 - up) * (vh - laid.editor.y + 40)}px, 0) scale(${lerp(0.9, 1, up)})`
        const blur = 10 * (1 - smooth(span(rose, [0.35, 1]))) + 2.5 * wrap
        el.editor.style.filter = blur > 0.1 ? `blur(${blur}px)` : "none"
      }
      const camera = cameraAt(v, laid.cameras)
      el.lens.style.transform = `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`

      // Each thing is marked in turn, left to right. A mark on a button that opens a menu has it
      // opened first, by the pointer's click, and closed again before the next starts. Beside the
      // editor every mark stays, with its arrow and note, until they all step back for the way in;
      // on a phone, where the camera moves on, each makes way for the next.
      let clicking = -1
      BEATS.notes.forEach((beat, i) => {
        const t = span(v, beat)
        const open = 1 - smooth(span(v, BEATS.closes[i]))
        const kept = laid.beside || i === BEATS.notes.length - 1 ? 1 : open
        show(i, kept)
        // React lets go of the marks' elements before this effect is cleaned up, so a frame
        // already queued as the page is left finds them gone: there's nothing to draw then.
        const loop = loops.current[i]
        if (!loop) return
        loop.style.opacity = String(kept * (1 - wrap))
        const menu = menus.current[i]
        if (!menu) return draw(i, t)
        draw(i, span(t, CLICK.ink))
        menu.style.opacity = String(open * (1 - wrap))
        const button = pressed.current[i]
        const openedMenu = opened.current[i]
        if (!button || !openedMenu) return
        button.style.opacity = t >= CLICK.press[0] ? "1" : "0"
        const opening = out3(span(t, CLICK.open))
        openedMenu.style.opacity = String(smooth(span(t, CLICK.open)))
        openedMenu.style.transform = `translate3d(0, ${(1 - opening) * -10}px, 0) scale(${lerp(0.97, 1, opening)})`
        if (t > 0 && t < CLICK.leave[1]) clicking = i
      })

      // The pointer glides in to the button, presses it, and leaves once the menu is open.
      if (clicking >= 0) {
        const t = span(v, BEATS.notes[clicking])
        const [x, y] = MARKS[clicking].menu!.click
        const glided = inOut(span(t, CLICK.glide))
        const size = laid.editor.width * POINTER
        const left = (x + (1 - glided) * 0.07) * laid.editor.width - TIP[0] * size
        const top = (y + (1 - glided) * 0.18) * laid.editor.height - TIP[1] * size
        const press = Math.sin(Math.PI * span(t, CLICK.press))
        el.pointer.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${1 - 0.18 * press})`
        el.pointer.style.opacity = String(smooth(span(t, [0, 0.06])) * (1 - smooth(span(t, CLICK.leave))))
      } else el.pointer.style.opacity = "0"
      el.inkBox.style.opacity = String(1 - wrap)

      // The way in, always wholly on screen.
      const arriving = span(v, BEATS.cta)
      const shown = out3(arriving)
      const at = wayInAt(laid, screen, wayInHeight)
      el.wayIn.style.transform = `translate3d(${at.x}px, ${at.y + (1 - shown) * 46}px, 0) scale(${lerp(0.96, 1, shown)})`
      el.wayIn.style.setProperty("--glass-in", String(shown))
      el.wayInCopy.style.opacity = String(smooth(span(arriving, [0.25, 1])))
      el.wayIn.style.pointerEvents = arriving > 0.6 ? "auto" : "none"

      setBetween(v > BEATS.hero[1] && v < BEATS.cta[0])
    }

    // The scroll sets where the story is going; each frame eases toward it, so a mouse wheel's
    // steps glide rather than jump.
    let target = 0
    let shown = 0
    let last = 0
    let frame = 0
    const read = () => {
      const box = el.story.getBoundingClientRect()
      target = storyAt(box.top, box.height, window.innerHeight)
    }
    const step = (now: number) => {
      frame = 0
      shown = glide(shown, target, last ? Math.min(64, now - last) : 16.7)
      last = now
      render(shown)
      if (shown !== target) frame = requestAnimationFrame(step)
      else last = 0
    }
    const onScroll = () => {
      read()
      if (!frame) frame = requestAnimationFrame(step)
    }
    const snap = () => {
      read()
      shown = target
      render(shown)
    }
    const onResize = () => {
      measure()
      snap()
    }
    redraw.current = () => {
      drawnTo = []
      shownTo = []
      render(shown)
    }
    toEnd.current = () => {
      if (shown >= BEATS.cta[1]) return
      const box = el.story.getBoundingClientRect()
      window.scrollTo({ top: window.scrollY + box.top + box.height - window.innerHeight, behavior: "smooth" })
    }

    measure()
    snap()
    // The way in is kept on screen by its height, which changes when its text reflows: once its
    // fonts arrive after it was first measured, as well as with its width.
    const reflow = new ResizeObserver(() => {
      if (el.wayInCopy.offsetHeight === wayInHeight) return
      wayInHeight = el.wayInCopy.offsetHeight
      render(shown)
    })
    reflow.observe(el.wayInCopy)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(frame)
      reflow.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      redraw.current = () => {}
    }
  }, [])

  // A new layout has new arrows: draw them to where the story is.
  useEffect(() => redraw.current(), [layout])

  // The pictures are decoded while the first screen is up: Safari otherwise decodes each one when
  // it's first drawn, and the scroll stalls for that frame.
  useEffect(() => {
    for (const image of story.current?.querySelectorAll("img") ?? []) image.decode().catch(() => {})
  }, [])

  return (
    <div ref={story} className="home-story" style={{ height: `calc(${STORY_LENGTH}vh + 100svh)` }}>
      <div ref={stage} className="home-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={meadow} src="/home/meadow.webp" alt="" className="home-meadow" />
        <div ref={shade} aria-hidden="true" className="home-shade" />
        <div ref={heroBox} className="home-hero">
          {hero}
        </div>
        {/* The editor, and the marks on it, under the camera (`lens`), which moves in on a phone. */}
        <figure ref={editor} aria-hidden="true" className="home-editor">
          <div ref={lens} className="home-lens">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EDITOR.src} alt="" />
            {MARKS.map(({ menu, said }, i) => {
              // Over its menu, so it stays round the button once the menu has closed.
              const loop = (
                <svg
                  ref={(element) => {
                    loops.current[i] = element
                  }}
                  viewBox={`0 0 ${EDITOR.width} ${EDITOR.height}`}
                >
                  <Strokes strokes={[[MARKED[i]]]} first={i} masks={markMasks} prefix={`${id}-mark`} />
                </svg>
              )
              if (!menu) return <Fragment key={said}>{loop}</Fragment>
              // The menu, with its button pressed.
              return (
                <Fragment key={said}>
                  <div
                    ref={(element) => {
                      menus.current[i] = element
                    }}
                    className="home-menu"
                  >
                    <OverlayPicture
                      overlay={menu.button}
                      ref={(element) => {
                        pressed.current[i] = element
                      }}
                    />
                    <OverlayPicture
                      overlay={menu.open}
                      ref={(element) => {
                        opened.current[i] = element
                      }}
                    />
                  </div>
                  {loop}
                </Fragment>
              )
            })}
            {/* A pointer, its tip at its top left: a picture of a click. */}
            <svg ref={pointer} viewBox="0 0 24 24" className="home-pointer">
              <path d="M5 3l14 8.6-6.3 1.4 3.7 6.9-2.9 1.5-3.6-7L5 19z" />
            </svg>
          </div>
        </figure>
        <div aria-hidden="true" className="home-grass">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/grass.webp" alt="" />
        </div>
        {/* The arrows and notes, over the editor and the sky round it. A picture, which screen readers skip (Said tells them). */}
        <div ref={inkBox} aria-hidden="true" className="home-ink-layer">
          {layout && (
            <>
              <svg width="100%" height="100%">
                <Strokes strokes={layout.arrows} masks={arrowMasks} prefix={`${id}-arrow`} />
              </svg>
              {layout.notes.map((note, i) => (
                <Note
                  key={MARKS[i].said}
                  ref={(element) => {
                    notes.current[i] = element
                  }}
                  lines={MARKS[i].note}
                  style={{
                    left: note.x,
                    top: note.y,
                    fontSize: note.size,
                    textAlign: note.align,
                    translate: note.align === "left" ? "0" : note.align === "right" ? "-100%" : "-50%",
                    rotate: `${note.turn}deg`,
                    visibility: "hidden",
                  }}
                />
              ))}
            </>
          )}
        </div>
        <WayIn ref={wayIn} copyRef={wayInCopy} onFocus={() => toEnd.current()} />
      </div>
      <Said />
      <FloatingStart shown={between} />
    </div>
  )
}

/** The story without motion: the first screen, then the editor with every mark and the notes, then the way in, on the meadow. */
function StillStory({ hero }: { hero: React.ReactNode }) {
  return (
    <div className="home-still">
      <div className="home-hero">{hero}</div>
      <figure aria-hidden="true" className="home-editor">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={EDITOR.src} alt="" />
        <svg viewBox={`0 0 ${EDITOR.width} ${EDITOR.height}`} className="home-still-marks">
          {MARKED.map((stroke) => (
            <path key={stroke.outline} className="home-mark" d={stroke.outline} />
          ))}
        </svg>
      </figure>
      <div aria-hidden="true" className="home-still-notes">
        {MARKS.map((mark) => (
          <Note key={mark.said} lines={mark.note} />
        ))}
      </div>
      <Said />
      <WayIn />
      <div aria-hidden="true" className="home-grass">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/home/grass.webp" alt="" />
      </div>
    </div>
  )
}
