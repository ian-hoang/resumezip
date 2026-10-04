/** The zipper-key mark. The ring is always blue; the key takes the text color. */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="3.5 18.5 56 27" fill="none" aria-hidden="true" className={className}>
      <circle cx="17" cy="32" r="10" className="stroke-accent" strokeWidth="6" />
      <path d="M27 32H59" stroke="currentColor" strokeWidth="6" />
      <path d="M38 39H59" stroke="currentColor" strokeWidth="8" strokeDasharray="3 3" />
    </svg>
  )
}
