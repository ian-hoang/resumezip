"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import Logo from "./Logo"
import { StartWritingLink } from "./StartWriting"

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/create/dashboard", label: "Your resumes" },
  { href: "/about", label: "About" },
]

const CTA = "label-caps items-center whitespace-nowrap bg-accent px-[18px] text-white transition-colors hover:bg-[#2550d4]"

interface SiteHeaderProps {
  /**
   * "overlay" sits on top of the home page's video; "light" is for every other page.
   * Only the colors differ, so nothing moves when you go from one page to another.
   */
  variant?: "overlay" | "light"
}

export default function SiteHeader({ variant = "light" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const overlay = variant === "overlay"

  return (
    <header className={`font-system ${overlay ? "relative z-10 text-white" : "border-b border-rule bg-paper text-ink"}`}>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-5 md:h-[72px] md:px-10">
        <Link href="/" className="flex items-center gap-2.5 font-logo text-[24px] font-medium tracking-[-0.02em]">
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

        <div className="flex items-center gap-2">
          {/* Phones don't have room for it next to the logo, so it moves into the menu. */}
          <StartWritingLink className={`${CTA} hidden h-10 sm:inline-flex`}>
            Start writing
          </StartWritingLink>
          <button
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

      {menuOpen && (
        <nav
          aria-label="Main"
          className={`flex flex-col px-5 pb-4 md:hidden ${overlay ? "bg-black/60 backdrop-blur" : "border-t border-rule"}`}
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
          <StartWritingLink className={`${CTA} mt-2 inline-flex h-11 justify-center sm:hidden`}>
            Start writing
          </StartWritingLink>
        </nav>
      )}
    </header>
  )
}
