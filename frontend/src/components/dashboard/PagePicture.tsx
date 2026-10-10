"use client"

import Image from "next/image"
import { useRef } from "react"
import type { Resume } from "@/lib/resume"
import { templateById } from "@/lib/templates"
import { useArrived, usePagePicture } from "./pagePictures"

interface PagePictureProps {
  id: string
  resume: Resume
  /** The width it's shown at, for the template's picture (as next/image's `sizes`). */
  sizes: string
  className?: string
}

/**
 * A resume's first page, as its template prints it (pagePictures.ts). The
 * template's own picture shows until it's drawn, and the drawing fades in
 * over it. Both are decoration: what's around it names the resume.
 */
export default function PagePicture({ id, resume, sizes, className = "" }: PagePictureProps) {
  const element = useRef<HTMLDivElement>(null)
  const url = usePagePicture(id, resume, element)
  const arrived = useArrived(url)
  return (
    <div ref={element} className={`relative overflow-hidden bg-sheet ${className}`}>
      {/* Kept under a drawing that's fading in. */}
      {(!url || arrived) && (
        <Image src={templateById(resume.selectedTemplate).image} alt="" fill sizes={sizes} className="object-cover object-top" />
      )}
      {url && (
        // An object URL, which next/image can't optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`absolute inset-0 h-full w-full object-cover object-top ${arrived ? "page-arrived" : ""}`} />
      )}
    </div>
  )
}
