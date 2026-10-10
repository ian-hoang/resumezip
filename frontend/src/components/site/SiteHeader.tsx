"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Menu, Star, X } from "lucide-react"
import Logo from "./Logo"

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/create/dashboard", label: "Your resumes" },
  { href: "/about", label: "About" },
]

// Tailwind's `md`, where the header's links replace the menu; in rem like Tailwind's, so the two agree.
const WIDE_HEADER = "(min-width: 48rem)"

const REPO_URL = "https://github.com/ian-hoang/resumezip"

// The phone menu's fill: nearly solid, so the hero's words don't show through its links.
const MENU_FILL_DARK = "[--glass-fill:linear-gradient(180deg,rgb(28_30_36/0.96),rgb(17_19_24/0.94))]"
const MENU_FILL_LIGHT = "[--glass-fill:linear-gradient(180deg,rgb(255_255_255/0.96),rgb(255_255_255/0.92))]"

// No display of its own: beside the logo these show from sm up, and in the menu below that.
const PILL = "items-center justify-center whitespace-nowrap rounded-full text-[15px] font-medium tracking-[-0.01em]"

interface SitePillProps {
  /** Dark glass over the home page's video and footer; light glass everywhere else. */
  tone?: "dark" | "light"
  /** Slides the pill up out of the way, as the page scrolls down. Keyboard focus brings it back. */
  tucked?: boolean
}

/**
 * A link to the page that's already open scrolls back to its top smoothly,
 * instead of Next's jump to the top as it loads the page again.
 */
function toTopIfHere(pathname: string, href: string) {
  return (event: React.MouseEvent) => {
    if (pathname !== href || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
  }
}

/**
 * The site's header: a glass pill with the logo, the links and one button,
 * Star on GitHub, whose star turns yellow under the pointer. The home page places it itself
 * (components/home/HomeChrome.tsx); every other page has it in SiteHeader's strip.
 */
export function SitePill({ tone = "light", tucked = false }: SitePillProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dark = tone === "dark"
  const pathname = usePathname()

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
  const primary = `${PILL} gap-2 px-[18px] ${
    dark ? "bg-white text-ink transition-colors hover:bg-white/85 active:bg-white/75" : "ink-button lift-button"
  }`

  const star = (className: string, inMenu = false) => (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`group ${className}`}
      onClick={() => {
        if (inMenu) setMenuOpen(false)
      }}
    >
      <Star
        className="h-4 w-4 transition-colors duration-200 group-hover:fill-[#facc15] group-hover:text-[#facc15] motion-reduce:transition-none"
        aria-hidden="true"
      />
      Star on GitHub
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
          onClick={toTopIfHere(pathname, "/")}
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
              onClick={toTopIfHere(pathname, link.href)}
              className={`nav-underline whitespace-nowrap text-[15px] tracking-[-0.01em] ${
                dark ? "text-white/85 hover:text-white" : "text-ink-2 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* Phones don't have room for it next to the logo, so it moves into the menu. */}
          {star(`${primary} hidden h-10 sm:inline-flex`)}
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

      {/* A card that drops in below the pill, over the page, with a small spring
          (.menu-card in home.css); the pill itself never changes. It moves in
          rather than fading or being uncovered: glass can't blur what's behind it
          while it's see-through or clipped, so either would show the page plainly
          through it, then frost over at once. Its links fade in just after, one by one. Once it starts
          to close, inert keeps the keyboard out of it; once closed, visibility
          (which changes at the end of its transition) hides it too. */}
      <nav
        aria-label="Main"
        inert={!menuOpen}
        data-open={menuOpen || undefined}
        className={`menu-card glass ${
          dark ? `glass-smoke ${MENU_FILL_DARK}` : `glass-frost ${MENU_FILL_LIGHT}`
        } absolute inset-x-0 top-full mt-2 flex flex-col rounded-panel px-5 pb-4 pt-2 md:hidden`}
      >
        {LINKS.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={(event) => {
              setMenuOpen(false)
              toTopIfHere(pathname, link.href)(event)
            }}
            style={{ "--i": index } as React.CSSProperties}
            className="menu-item py-3 text-[17px] tracking-[-0.01em]"
          >
            {link.label}
          </Link>
        ))}
        <div style={{ "--i": LINKS.length } as React.CSSProperties} className="menu-item mt-2 flex flex-col sm:hidden">
          {star(`${primary} flex h-11`, true)}
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
export default function SiteHeader() {
  return (
    <div className="pointer-events-none sticky top-0 z-40 flex h-[76px] items-start justify-center px-3 pt-3 md:h-[84px] md:px-5 md:pt-4 [&>*]:pointer-events-auto">
      <SitePill />
    </div>
  )
}
