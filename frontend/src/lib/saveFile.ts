/** What a file of a resume is called: its name, or "resume" if it has none. */
export const fileNameOf = (resume: { resumeTitle?: string }, extension: string) => `${resume.resumeTitle?.trim() || "resume"}.${extension}`

/** Saves `data` to the person's computer as a file named `name`, as a download does. */
export function saveFile(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  // Give the browser time to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Whether the browser can hand a PDF to another app through the system's share
 * sheet (the Web Share API), as phones' browsers can. Computers vary, and
 * Firefox can't.
 */
export function canSharePdf(): boolean {
  const pdf = new File([], "resume.pdf", { type: "application/pdf" })
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [pdf] })
}
