// The person's adjustments to how their template sets the page (the editor's
// Fine-tune panel): sizes and spacing as multiples of the template's own, so
// every template keeps its proportions. Printed with the resume.

/** What Fine-tune can change. Unset means the template's own setting. */
export interface Tune {
  /** Text size, as a multiple of the template's: 0.85 to 1.15. */
  size?: number
  /** Page margins, as a multiple of the template's: 0.6 to 1.4. */
  margin?: number
  /** Space between lines, as a multiple of the template's: 0.8 to 1.3. */
  leading?: number
  paper?: "us-letter" | "a4"
  /** Shrink the text a little at a time until the resume fits on one page. */
  onePage?: boolean
}
