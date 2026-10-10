// Writes zip files, and reads what resumezip needs from them: a Word file is
// a zip of XML files (lib/word.ts). Files are stored as they are, not
// compressed. A resume is small, and compressing would take a package or the
// browser's CompressionStream, which is async; every app that opens zips
// reads stored files.

/** How a file is kept in a zip: as it is. Deflated (compressed) is 8. */
const STORED = 0

// Each file is dated 1 January 1980, the earliest date a zip can hold, as Word
// dates the files in its own: the same resume always makes the same file.
const DATE = (1 << 5) | 1

const LOCAL_HEADER = 0x04034b50
const DIRECTORY_HEADER = 0x02014b50
const DIRECTORY_END = 0x06054b50
const ZIP64_LOCATOR = 0x07064b50

let table: Uint32Array | undefined

/** The CRC-32 a zip keeps of each file, to check it comes out as it went in. */
export function crc32(data: Uint8Array): number {
  table ??= Uint32Array.from({ length: 256 }, (_, n) => {
    for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
    return n
  })
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** A zip of `files`, by their paths in it, in the order given. Text is written as UTF-8. */
export function zip(files: Record<string, string | Uint8Array>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const entries = Object.entries(files).map(([path, content]) => {
    const data = typeof content === "string" ? encoder.encode(content) : content
    return { name: encoder.encode(path), ascii: /^[\x20-\x7e]*$/.test(path), data, crc: crc32(data), offset: 0 }
  })
  const size = entries.reduce((sum, { name, data }) => sum + 30 + name.length + data.length + 46 + name.length, 22)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)

  // A file's local header and its record in the directory share these
  // fields, in this order: from the version needed to the length of its name.
  const shared = (at: number, { name, ascii, data, crc }: (typeof entries)[number]) => {
    view.setUint16(at, 20, true)
    // A name that isn't plain ASCII is marked as UTF-8.
    view.setUint16(at + 2, ascii ? 0 : 0x800, true)
    view.setUint16(at + 4, STORED, true)
    view.setUint16(at + 8, DATE, true)
    view.setUint32(at + 10, crc, true)
    view.setUint32(at + 14, data.length, true)
    view.setUint32(at + 18, data.length, true)
    view.setUint16(at + 22, name.length, true)
  }

  let at = 0
  for (const entry of entries) {
    entry.offset = at
    view.setUint32(at, LOCAL_HEADER, true)
    shared(at + 4, entry)
    out.set(entry.name, at + 30)
    out.set(entry.data, at + 30 + entry.name.length)
    at += 30 + entry.name.length + entry.data.length
  }
  const directory = at
  for (const entry of entries) {
    view.setUint32(at, DIRECTORY_HEADER, true)
    view.setUint16(at + 4, 20, true)
    shared(at + 6, entry)
    view.setUint32(at + 42, entry.offset, true)
    out.set(entry.name, at + 46)
    at += 46 + entry.name.length
  }
  view.setUint32(at, DIRECTORY_END, true)
  view.setUint16(at + 8, entries.length, true)
  view.setUint16(at + 10, entries.length, true)
  view.setUint32(at + 12, at - directory, true)
  view.setUint32(at + 16, directory, true)
  return out
}

/** A file as a zip's directory lists it. */
export interface ZipEntry {
  name: string
  /** 0 when it's stored as it is, 8 when it's deflated. */
  method: number
  crc: number
  /** Its size unzipped. 0xFFFFFFFF when the zip keeps the real one elsewhere (ZIP64). */
  size: number
  /** Its size in the zip. */
  packedSize: number
  /** Where its local header starts. */
  offset: number
}

/**
 * The files a zip's directory lists. Null when there's no directory to read,
 * and "zip64" when the zip keeps its directory's details elsewhere (ZIP64,
 * for files over 4 GB), which nothing here reads.
 */
export function zipDirectory(data: ArrayBuffer): ZipEntry[] | "zip64" | null {
  const view = new DataView(data)
  // The directory's end record closes the file, followed by a comment of up to 64 KB.
  const last = view.byteLength - 22
  for (let end = last; end >= Math.max(0, last - 0xffff); end--) {
    if (view.getUint32(end, true) !== DIRECTORY_END) continue
    // A ZIP64 file's directory is found from another record, just before this one.
    if (end >= 20 && view.getUint32(end - 20, true) === ZIP64_LOCATOR) return "zip64"
    // The directory sits just before this record. It's found from its size,
    // not the place it's given at, which counts from where the zip starts: a
    // file can have something else before that, and mammoth's unzipper allows
    // for it. The places given for files count from there too.
    let at = end - view.getUint32(end + 12, true)
    if (at < 0) return null
    const shift = at - view.getUint32(end + 16, true)
    const entries: ZipEntry[] = []
    for (let count = view.getUint16(end + 10, true); count > 0; count--) {
      if (at + 46 > view.byteLength || view.getUint32(at, true) !== DIRECTORY_HEADER) return null
      const nameLength = view.getUint16(at + 28, true)
      if (at + 46 + nameLength > view.byteLength) return null
      entries.push({
        name: new TextDecoder().decode(new Uint8Array(data, at + 46, nameLength)),
        method: view.getUint16(at + 10, true),
        crc: view.getUint32(at + 16, true),
        packedSize: view.getUint32(at + 20, true),
        size: view.getUint32(at + 24, true),
        offset: view.getUint32(at + 42, true) + shift,
      })
      at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
    }
    return entries
  }
  return null
}

/**
 * A file's contents, if the zip stores it as it is, as resumezip's own zips
 * do. Null for a deflated file, or one that doesn't match its CRC-32.
 */
export function storedFile(data: ArrayBuffer, entry: ZipEntry): Uint8Array | null {
  if (entry.method !== STORED || entry.size !== entry.packedSize) return null
  const view = new DataView(data)
  const at = entry.offset
  if (at < 0 || at + 30 > view.byteLength || view.getUint32(at, true) !== LOCAL_HEADER) return null
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  if (start + entry.size > view.byteLength) return null
  const contents = new Uint8Array(data, start, entry.size)
  return crc32(contents) === entry.crc ? contents : null
}
