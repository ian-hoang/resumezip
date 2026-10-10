"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Menu, Star, X } from "lucide-react"
import Logo from "./Logo"
import { StartWritingLink } from "./StartWriting"

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/create/dashboard", label: "Your resumes" },
  { href: "/about", label: "About" },
]

// Tailwind's `md`, where the header's links replace the menu; in rem like Tailwind's, so the two agree.
const WIDE_HEADER = "(min-width: 48rem)"

const REPO_URL = "https://github.com/ian-hoang/resumezip"

// No display of its own: beside the logo these show from sm up, and in the menu below that.
const PILL = "items-center justify-center whitespace-nowrap rounded-full text-[15px] font-medium tracking-[-0.01em] transition-colors"

interface SitePillProps {
  /** Dark glass over the home page's video and footer; light glass everywhere else. */
  tone?: "dark" | "light"
  /** Slides the pill up out of the way, as the page scrolls down. Keyboard focus brings it back. */
  tucked?: boolean
  /**
   * What "Start writing" does on a page with its own way to start a resume,
   * instead of going to the dashboard: the dashboard opens its New resume dialog.
   */
  onStartWriting?: () => void
}

/**
 * The site's header: a glass pill with the logo, the links, "Start writing"
 * and a star on GitHub. The home page places it itself, under its news bar
 * (components/home/HomeChrome.tsx); every other page has it in SiteHeader's strip.
 */
export function SitePill({ tone = "light", tucked = false, onStartWriting }: SitePillProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dark = tone === "dark"

  useEffect(() => {
    if (!menuOpen) return
    // The menu covers the top of the page, so a tap elsewhere closes it, and what was tapped keeps the focus.
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setMenuOpen(false)
      buttonRef.current?.focus()
    }
    // Turning a phone sideways can show the header's own links, which hide the
    // menu; it shouldn't still be open when the phone is turned back.
    const wide = window.matchMedia(WIDE_HEADER)
    const onResize = () => {
      if (wide.matches) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    wide.addEventListener("change", onResize)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      wide.removeEventListener("change", onResize)
    }
  }, [menuOpen])

  // An ink pill on light glass; over the video's dark glass, a white one.
  const primary = `${PILL} px-[18px] ${dark ? "bg-white text-ink hover:bg-white/85" : "bg-ink text-white hover:bg-black"}`
  const secondary = `${PILL} ring-1 ring-inset ${
    dark ? "text-white ring-white/30 hover:ring-white/70" : "bg-sheet/40 text-ink ring-ink/15 hover:ring-ink/40"
  }`

  // "Start writing" is a button where it opens a dialog, as it doesn't go
  // anywhere. In the menu it shuts the menu first, as the menu's links do, and
  // leaves focus on the menu's button for the dialog to put it back on.
  const startWriting = (className: string, inMenu = false) =>
    onStartWriting ? (
      <button
        type="button"
        className={className}
        onClick={() => {
          if (inMenu) {
            setMenuOpen(false)
            buttonRef.current?.focus()
          }
          onStartWriting()
        }}
      >
        Start writing
      </button>
    ) : (
      <StartWritingLink className={className} preloadOnHover>
        Start writing
      </StartWritingLink>
    )

  // Beside the links, below lg, there's only room for the star itself; the menu has room to say it all.
  const star = (className: string, inMenu = false) => (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={inMenu ? undefined : "Star on GitHub"}
      className={`group gap-2 ${className}`}
      onClick={() => {
        if (inMenu) setMenuOpen(false)
      }}
    >
      <Star
        className="h-4 w-4 transition-colors group-hover:fill-[#facc15] group-hover:text-[#facc15] motion-reduce:transition-none"
        aria-hidden="true"
      />
      <span>
        <span className={inMenu ? undefined : "max-lg:sr-only"}>Star</span>
        <span className={inMenu ? undefined : "sr-only"}> on GitHub</span>
      </span>
    </a>
  )

  return (
    <header
      ref={headerRef}
      data-tucked={tucked && !menuOpen ? "" : undefined}
      className={`site-pill relative w-full md:w-auto ${dark ? "site-pill-dark text-white" : "text-ink"}`}
    >
      <div
        className={`glass ${dark ? "glass-smoke" : "glass-frost"} flex h-[52px] items-center justify-between gap-4 rounded-full pl-5 pr-1.5 md:gap-7 lg:gap-10`}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-logo text-[21px] font-medium tracking-[-0.02em] transition-opacity hover:opacity-80"
        >
          <Logo className="h-[18px] w-auto" />
          resumezip
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 md:flex lg:gap-8">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-underline whitespace-nowrap text-[15px] tracking-[-0.01em] ${
                dark ? "text-white/85 hover:text-white" : "text-ink-2 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* Phones don't have room for these next to the logo, so they move into the menu. */}
          {star(`${secondary} hidden h-10 w-10 sm:inline-flex lg:w-auto lg:px-4`)}
          {startWriting(`${primary} hidden h-10 sm:inline-flex`)}
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Drops over the page instead of pushing it down. Once it starts to close,
          inert keeps the keyboard out of it; once closed, visibility (which changes
          at the end of its transition) hides it too. */}
      <nav
        aria-label="Main"
        inert={!menuOpen}
        className={`glass ${dark ? "glass-smoke" : "glass-frost"} absolute inset-x-0 top-full mt-2 flex flex-col rounded-panel px-5 pb-4 pt-2 transition-[opacity,transform,visibility] duration-200 ease-glide motion-reduce:transition-none md:hidden ${
          menuOpen ? "" : "invisible -translate-y-2 opacity-0"
        }`}
      >
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="py-3 text-[17px] tracking-[-0.01em]">
            {link.label}
          </Link>
        ))}
        <div className="mt-2 flex flex-col gap-2 sm:hidden">
          {startWriting(`${primary} flex h-11`, true)}
          {star(`${secondary} flex h-11`, true)}
        </div>
      </nav>
    </header>
  )
}

/**
 * Every page's header but the home page's: the pill, in a strip that stays at
 * the top of the screen. The strip keeps room for the pill, so the page starts
 * under it; around the pill, clicks go through to the page scrolling under it.
 */
export default function SiteHeader({ onStartWriting }: Pick<SitePillProps, "onStartWriting">) {
  return (
    <div className="pointer-events-none sticky top-0 z-40 flex h-[76px] justify-center px-3 pt-3 md:h-[84px] md:px-5 md:pt-4 [&>*]:pointer-events-auto">
      <SitePill onStartWriting={onStartWriting} />
    </div>
  )
}
