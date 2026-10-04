import Link from "next/link"
import Logo from "./Logo"

const LINKS = [
  { href: "/templates", label: "Templates" },
  { href: "/terms", label: "Terms & privacy" },
  { href: "/contact", label: "Contact" },
]

export default function SiteFooter() {
  return (
    <footer className="bg-[#171717] font-system text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-16 px-5 pb-10 pt-16 md:px-10">
        <Link
          href="/"
          className="flex w-fit items-center gap-[0.3em] font-logo text-[56px] font-medium leading-none tracking-[-0.03em] md:text-[80px]"
        >
          <Logo className="h-[0.7em] w-auto" />
          resumezip
        </Link>
        <div className="flex flex-wrap justify-between gap-6 border-t border-white/25 pt-6">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="label-caps text-white/90 hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <span className="label-caps text-white/70">© 2026 resumezip</span>
        </div>
      </div>
    </footer>
  )
}
