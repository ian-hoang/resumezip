"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import Logo from "./Logo"
import { StartWritingLink } from "./StartWriting"

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/about", label: "About" },
  { href: "/create/dashboard", label: "Your resumes" },
]

interface SiteHeaderProps {
  /** "overlay" sits on top of the home page's video; "light" is for every other page. */
  variant?: "overlay" | "light"
}

export default function SiteHeader({ variant = "light" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const overlay = variant === "overlay"

  return (
    <header className={overlay ? "relative z-10 text-white" : "border-b border-rule bg-paper text-ink"}>
      <div
        className={`mx-auto flex h-16 items-center justify-between gap-6 px-5 md:h-[72px] ${
          overlay ? "max-w-[1440px] md:px-10" : "max-w-[1280px] md:px-8"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 font-logo text-[24px] font-medium tracking-[-0.02em]">
          <Logo className="h-5 w-auto" />
          resumezip
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                overlay
                  ? "label-caps text-white/90 hover:text-white"
                  : "text-sm text-ink-2 transition-colors hover:text-ink"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <StartWritingLink
            className={
              overlay
                ? "label-caps inline-flex h-10 items-center bg-accent px-[18px] text-white transition-colors hover:bg-[#2550d4]"
                : "inline-flex h-9 items-center rounded-[4px] bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-black"
            }
          >
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
              className={`py-3 ${overlay ? "label-caps text-white" : "text-[15px] text-ink"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
