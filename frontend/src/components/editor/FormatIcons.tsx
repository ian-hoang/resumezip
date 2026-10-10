// The ▾ menu's choices drawn as their own marks, so each is found at a glance:
// Word's W, Google Drive's triangle, JSON's braces, and the share symbol.
// Drawn here rather than loaded, as resumezip makes no calls it doesn't need.

interface IconProps {
  className?: string
}

/** Word: the W on its tile, in front of a page in Word's blues. */
export function WordIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="7" y="2" width="15" height="20" rx="2" fill="#103f91" />
      <path d="M9 2h11a2 2 0 0 1 2 2v3H7V4a2 2 0 0 1 2-2z" fill="#41a5ee" />
      <rect x="7" y="7" width="15" height="5" fill="#2b7cd3" />
      <rect x="7" y="12" width="15" height="5" fill="#185abd" />
      <rect x="2" y="6" width="12" height="12" rx="1.6" fill="#185abd" />
      <path d="M4.4 8.9 5.95 15.1 8 10.5l2.05 4.6L11.6 8.9" fill="none" stroke="#fff" strokeWidth="1.35" strokeLinejoin="round" />
    </svg>
  )
}

/** Google Drive: its triangle, in its green, yellow and blue. */
export function DriveIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
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

/** Share: the box with an arrow out of it, on a blue tile. */
export function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#2e5be6" />
      <path
        d="M12 5.5v8.5M9 8.3l3-2.8 3 2.8M9 11H7.8a.8.8 0 0 0-.8.8v5.4a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8v-5.4a.8.8 0 0 0-.8-.8H15"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
