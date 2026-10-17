import Link from "next/link"

const LINKS = [
  { href: "/terms", label: "Terms & privacy" },
  { href: "/#contact", label: "Contact" },
]

/**
 * The page's end: a strip of the sky, then the page lifts off the footer, its
 * bottom corners rounded over a shadow (`zip-footer` in globals.css). Under
 * it, the links, the wordmark, and the logo's key at full width, as on the
 * social card. It sits shut and doesn't move. The strip is the sky itself
 * (desk), so it's the same on every page, whatever's above; the home page,
 * whose story ends on the ground in its meadow, ends on its grass instead
 * (`ground`, .footer-ground in home.css), rather than sky under grass.
 */
export default function SiteFooter({ ground = false }: { ground?: boolean }) {
  return (
    <>
      {ground ? (
        <div aria-hidden="true" className="footer-ground relative" />
      ) : (
        <div aria-hidden="true" className="desk relative h-16 md:h-20" />
      )}
      <footer className="zip-footer text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 pt-6 md:px-10 md:pt-7">
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
          <span className="text-[15px] tracking-[-0.01em] text-white/60">Free, private and open source.</span>
        </div>
        <div className="mx-auto max-w-[1440px] px-5 md:px-10">
          {/* Up to 150px at 1440px, and no smaller than 56px on a phone. Pulled left by the r's side bearing, so its stem
              lines up with the links; the room under it is in em, as the p's tail hangs below its tight line height. */}
          <Link
            href="/"
            className="-ml-[0.06em] mt-5 block w-fit whitespace-nowrap pb-[0.32em] font-logo text-[clamp(56px,10.4vw,150px)] font-medium leading-[0.74] tracking-[-0.055em] transition-opacity hover:opacity-80 md:mt-6"
          >
            resumezip
          </Link>
        </div>
        <div aria-hidden="true" className="zipper">
          <div className="zipper-bar" />
          <div className="zipper-teeth" />
          <div className="zipper-pull" />
        </div>
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-6 px-5 pb-6 pt-6 md:px-10">
          <span className="label-mono normal-case text-white/70">tryresumezip.com</span>
          <span className="label-mono normal-case text-white/70">© 2026 resumezip</span>
        </div>
      </footer>
    </>
  )
}
