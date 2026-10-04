"use client"

import { useEffect, useRef, useState } from "react"

// How long to stay dark at each end of the clip. It doesn't loop seamlessly,
// so it dips to black around the loop point instead of jumping.
const FADE_OUT_BEFORE_END = 0.45
const FADE_IN_AFTER_START = 0.12

/** The home page's background clip: muted, looping, decorative. */
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Respect reduced motion: show the poster frame instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause()
      setVisible(true)
      return
    }

    let frame = 0
    const tick = () => {
      if (video.duration) {
        const t = video.currentTime
        setVisible(t > FADE_IN_AFTER_START && t < video.duration - FADE_OUT_BEFORE_END)
      }
      frame = requestAnimationFrame(tick)
    }

    // React doesn't reliably set the muted attribute, which autoplay requires.
    video.muted = true
    video
      .play()
      .then(() => {
        frame = requestAnimationFrame(tick)
      })
      .catch(() => setVisible(true)) // Autoplay blocked: keep the poster.

    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <video
      ref={videoRef}
      src="/video/printer.mp4"
      poster="/video/printer-poster.jpg"
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    />
  )
}
