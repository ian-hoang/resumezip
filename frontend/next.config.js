module.exports = {
  webpack(config) {
    // Typst resume templates are imported as source strings (src/lib/typst).
    config.module.rules.push({ test: /\.typ$/, type: "asset/source" })
    return config
  },
  // Every resume's address gets the same editor page, built once. Resumes
  // only exist in the visitor's browser, so there's nothing for a server to
  // render per id, and a dynamic /create/new/[id] page ran a server function
  // on every visit. The page reads the id from the address. `+` takes the
  // rest of the path: an id kept from an opened PDF can have a "/" in it.
  async rewrites() {
    return [{ source: "/create/new/:id+", destination: "/create/editor" }]
  },
  // Files in public/ are otherwise checked with the server every time they're
  // shown. These keep their names when they change (e.g. a template's new
  // picture), so browsers keep them for a day rather than for good.
  async headers() {
    return ["/previews/:file*", "/video/:file*", "/how-it-works/:file*", "/backgrounds/:file*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
    }))
  },
}
