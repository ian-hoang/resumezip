// The ▾ menu's choices drawn as their own marks, so each is found at a glance:
// Word's W, Google Drive's triangle, JSON's braces, and the share symbol.
// Drawn here rather than loaded, as resumezip makes no calls it doesn't need.
// Gradients are keyed with useId, as each mark can be on the page more than once.

import { useId } from "react"

interface IconProps {
  className?: string
}

/**
 * Word, as redrawn in 2025: three bands that fold round on the left, light
 * cyan over blue over navy, and the W on its tile in front.
 */
export function WordIcon({ className }: IconProps) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#3ccbf4" />
          <stop offset="0.7" stopColor="#6ec8f2" />
          <stop offset="1" stopColor="#9a8cf5" />
        </linearGradient>
        <linearGradient id={`${id}-middle`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2f6fef" />
          <stop offset="0.75" stopColor="#4a9af7" />
          <stop offset="1" stopColor="#7b74f4" />
        </linearGradient>
      </defs>
      <rect x="7" y="13" width="15.5" height="8.5" rx="3.2" fill="#1238b8" />
      <rect x="7" y="8" width="15.5" height="7.5" rx="3" fill={`url(#${id}-middle)`} />
      <rect x="7" y="2.5" width="15.5" height="7.5" rx="3.2" fill={`url(#${id}-top)`} />
      <rect x="1.5" y="10" width="10.5" height="10.5" rx="2.6" fill="#1f55d6" />
      <path d="M3.8 12.6 5.3 18 6.75 14l1.45 4 1.5-5.4" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Google Drive, as redrawn in 2026: a soft triangle in three turns of green,
 * yellow and blue round a small white triangle.
 */
export function DriveIcon({ className }: IconProps) {
  const id = useId()
  return (
    <svg viewBox="8 7 84 80" className={className} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-shape`}>
          <path d="M38.5 23.9 L15.5 64.1 Q4 84 27.0 84.0 L73.0 84.0 Q96 84 84.5 64.1 L61.5 23.9 Q50 4 38.5 23.9Z" />
        </clipPath>
        <linearGradient id={`${id}-green`} x1="0.1" y1="0.9" x2="0.6" y2="0.3">
          <stop offset="0" stopColor="#7cc4f8" />
          <stop offset="0.45" stopColor="#1fb25a" />
        </linearGradient>
        <linearGradient id={`${id}-blue`} x1="0.2" y1="0.3" x2="0.9" y2="1">
          <stop offset="0.5" stopColor="#3584f6" />
          <stop offset="1" stopColor="#b1a3f5" />
        </linearGradient>
        <linearGradient id={`${id}-yellow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffcc12" />
          <stop offset="1" stopColor="#ffd83a" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-shape)`}>
        <path d="M39 47H-10V-10H94L61 47Z" fill={`url(#${id}-green)`} />
        <path d="M61 47 94-10H110V100H69.7L50 66Z" fill={`url(#${id}-yellow)`} />
        <path d="M39 47 50 66 69.7 100H-10V47Z" fill={`url(#${id}-blue)`} />
      </g>
      <path d="M39 47H61L50 66Z" fill="#fff" />
    </svg>
  )
}

/** JSON: curly braces on an amber tile. */
export function JsonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#f5b100" />
      <path
        d="M9.6 6.5c-1.6 0-1.9.9-1.9 2.2v1.6c0 .9-.5 1.6-1.5 1.7 1 .1 1.5.8 1.5 1.7v1.6c0 1.3.3 2.2 1.9 2.2M14.4 6.5c1.6 0 1.9.9 1.9 2.2v1.6c0 .9.5 1.6 1.5 1.7-1 .1-1.5.8-1.5 1.7v1.6c0 1.3-.3 2.2-1.9 2.2"
        fill="none"
        stroke="#3b2a00"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Share: the box with an arrow out of it, drawn in the text's color, as it's an action rather than a file. */
export function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3.5v11M8.2 7.2 12 3.5l3.8 3.7M8.5 10h-2A1.5 1.5 0 0 0 5 11.5v7A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
