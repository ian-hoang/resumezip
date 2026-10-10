import Link from "next/link"

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms & privacy" },
  { href: "/contact", label: "Contact" },
]

/**
 * The page's end: the logo's key at full width, as on the social card. It sits
 * shut and doesn't move.
 */
export default function SiteFooter() {
  return (
    <footer className="zip-footer bg-[#171717] text-white">
      <div className="mx-auto max-w-[1440px] px-5 pt-16 md:px-10">
        {/* Its left edge is the ring's width and a little more in from the margin, as the wordmark sits on the social card. */}
        <Link
          href="/"
          className="ml-[calc(37*var(--u))] block w-fit font-logo text-[56px] font-medium leading-none tracking-[-0.03em] transition-opacity hover:opacity-80 md:text-[80px]"
        >
          resumezip
        </Link>
      </div>
      <div aria-hidden="true" className="zipper mt-6">
        <div className="zipper-bar" />
        <div className="zipper-teeth" />
        <div className="zipper-pull" />
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-6 px-5 pb-10 pt-12 md:px-10">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-underline text-[15px] tracking-[-0.01em] text-white/85 [--underline:var(--color-accent-soft)] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="label-mono self-center normal-case text-white/70">© 2026 resumezip</span>
      </div>
    </footer>
  )
}
