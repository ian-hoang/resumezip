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

const CTA = "label-caps items-center whitespace-nowrap bg-accent px-[18px] text-white transition-colors hover:bg-[#2550d4]"

const REPO_URL = "https://github.com/ian-hoang/resumezip"

interface SiteHeaderProps {
  /**
   * "overlay" sits on top of the home page's video; "light" is for every other page.
   * Only the colors differ, so nothing moves when you go from one page to another.
   */
  variant?: "overlay" | "light"
  /** Asks for a star on GitHub where "Start writing" goes, for the home page, which has its own "Start writing" links. */
  starOnGitHub?: boolean
  /**
   * What "Start writing" does on a page with its own way to start a resume,
   * instead of going to the dashboard: the dashboard opens its New resume dialog.
   */
  onStartWriting?: () => void
}

export default function SiteHeader({ variant = "light", starOnGitHub = false, onStartWriting }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const overlay = variant === "overlay"

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

  // The header's one button. "Start writing" is a button where it opens a
  // dialog, as it doesn't go anywhere. In the menu it shuts the menu first, as
  // the menu's links do, and leaves focus on the menu's button for the dialog
  // to put it back on.
  const action = (className: string, inMenu = false) =>
    starOnGitHub ? (
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} gap-2`}
        onClick={() => {
          if (inMenu) setMenuOpen(false)
        }}
      >
        <Star className="h-4 w-4 fill-[#facc15] text-[#facc15]" aria-hidden="true" />
        {/* Beside the links, below lg, there's only room for "Star". */}
        <span>
          Star<span className="md:max-lg:sr-only"> on GitHub</span>
        </span>
      </a>
    ) : onStartWriting ? (
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

  return (
    <header
      ref={headerRef}
      className={`relative font-system ${overlay ? "z-10 text-white" : "z-30 border-b border-rule bg-paper text-ink"}`}
    >
      {/* With links, the outer columns are equal, so the links stay put whatever the button says. */}
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-5 md:grid md:h-[72px] md:grid-cols-[1fr_auto_1fr] md:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 justify-self-start font-logo text-[24px] font-medium tracking-[-0.02em] transition-opacity hover:opacity-80"
        >
          <Logo className="h-5 w-auto" />
          resumezip
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`label-caps transition-colors ${overlay ? "text-white/90 hover:text-white" : "text-ink-2 hover:text-ink"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          {/* Phones don't have room for it next to the logo, so it moves into the menu. */}
          {action(`${CTA} hidden h-10 sm:inline-flex`)}
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Drops over the page instead of pushing it down. Once it starts to
          close, inert keeps the keyboard out of it; once closed, visibility
          (which changes at the end of its transition) hides it too. */}
      <nav
        aria-label="Main"
        inert={!menuOpen}
        className={`absolute inset-x-0 top-full flex flex-col px-5 pb-4 transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none md:hidden ${
          overlay ? "bg-black/60 backdrop-blur" : "border-y border-rule bg-paper shadow-[0_18px_40px_-16px_rgba(17,19,24,0.3)]"
        } ${menuOpen ? "" : "invisible -translate-y-2 opacity-0"}`}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            className={`label-caps py-3 ${overlay ? "text-white" : "text-ink"}`}
          >
            {link.label}
          </Link>
        ))}
        {action(`${CTA} mt-2 inline-flex h-11 justify-center sm:hidden`, true)}
      </nav>
    </header>
  )
}
