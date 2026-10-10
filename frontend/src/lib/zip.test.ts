import { describe, expect, test } from "vitest"
import { wordFile } from "@/lib/import/testFiles"
import { crc32, storedFile, zip, zipDirectory, type ZipEntry } from "./zip"

const encode = (text: string) => new TextEncoder().encode(text)
const decode = (bytes: Uint8Array | null) => (bytes ? new TextDecoder().decode(bytes) : null)

/** The files a zip lists, or a failure if it lists none. */
function listed(data: ArrayBuffer): ZipEntry[] {
  const files = zipDirectory(data)
  if (!Array.isArray(files)) throw new Error(`No directory: ${files}`)
  return files
}

test("the CRC-32 is the one zip files keep", () => {
  expect(crc32(encode("123456789"))).toBe(0xcbf43926)
  expect(crc32(new Uint8Array())).toBe(0)
})

describe("a zip", () => {
  const files = { "[Content_Types].xml": "<Types/>", "word/document.xml": "<w:document/>", "notes.bin": new Uint8Array([0, 1, 255]) }

  test("lists its files in order, each stored as it went in", () => {
    const data = zip(files).buffer
    const entries = listed(data)
    expect(entries.map(({ name, method }) => ({ name, method }))).toEqual(Object.keys(files).map((name) => ({ name, method: 0 })))
    expect(decode(storedFile(data, entries[1]))).toBe("<w:document/>")
    expect([...storedFile(data, entries[2])!]).toEqual([0, 1, 255])
    expect(entries[1]).toMatchObject({ size: 13, packedSize: 13, crc: crc32(encode("<w:document/>")) })
  })

  test("is the same file each time it's made from the same files", () => {
    expect(zip(files)).toEqual(zip(files))
  })

  test("marks a name that isn't plain ASCII as UTF-8, and reads it back", () => {
    const data = zip({ "résumé.json": "{}" })
    const view = new DataView(data.buffer)
    // The flags of the file's local header.
    expect(view.getUint16(6, true) & 0x800).toBe(0x800)
    expect(listed(data.buffer).map((file) => file.name)).toEqual(["résumé.json"])
  })

  test("with something before it is read all the same", () => {
    const data = zip(files)
    const prefixed = new Uint8Array([...encode("something else first"), ...data]).buffer
    const entries = listed(prefixed)
    expect(decode(storedFile(prefixed, entries[1]))).toBe("<w:document/>")
  })

  test("from another app is listed, but its compressed files aren't read", () => {
    const data = new Uint8Array(wordFile(["Mara Lin"])).buffer
    const entries = listed(data)
    expect(entries.map((file) => file.name)).toEqual(["[Content_Types].xml", "_rels/.rels", "word/document.xml"])
    expect(entries.every((file) => file.method === 8)).toBe(true)
    expect(storedFile(data, entries[2])).toBeNull()
  })

  test("a file that doesn't match its CRC-32 isn't read", () => {
    const data = zip(files)
    const entry = listed(data.buffer)[1]
    data[entry.offset + 30 + entry.name.length] ^= 1
    expect(storedFile(data.buffer, entry)).toBeNull()
  })

  test("a file that isn't a zip has no directory", () => {
    expect(zipDirectory(encode("not a zip").buffer)).toBeNull()
  })
})
