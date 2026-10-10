/**
 * "Loading" beside a 3×3 grid of squares with a wave of light running
 * across it, corner to corner (`.loader-grid` in globals.css), and dots that
 * type out after the word. With less motion the grid and dots are still.
 */
export default function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2.5 text-sm text-ink-2">
      <span aria-hidden="true" className="loader-grid">
        {/* Each square's delay is its distance from the top left corner, so the light runs diagonally. */}
        {Array.from({ length: 9 }, (_, index) => (
          <i key={index} style={{ "--step": (index % 3) + Math.floor(index / 3) } as React.CSSProperties} />
        ))}
      </span>
      <span>
        {label}
        <span aria-hidden="true" className="loader-dots">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </span>
    </span>
  )
}
