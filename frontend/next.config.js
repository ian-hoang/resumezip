// Each template's picture was named by its template's id, some of which are
// other products' names, until the pictures were named after their pages
// (src/lib/templates.ts). Search engines list them under the old names, so
// those send them on to the new ones for good.
// prettier-ignore
const RENAMED_PICTURES = {
  jake: "jakes", modernjack: "modern-jakes", levelsfyi: "blueprint", referme: "compact", ian: "ians", resumeworded: "harvard",
  margin: "margin", swiss: "swiss", mono: "mono", accent: "accent", deedy: "deedy", zero2sudo: "zero2sudo",
}

// What the site's pages and workers may load, and where they may send
// anything. Every resume is in this site's localStorage, so connect-src
// matters most: a script from a compromised package update couldn't upload
// resumes to a site that isn't on it. It narrows that rather than closing it,
// as scripts can still be inline and a navigation can carry data off.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Next.js writes the scripts that start a page into it, and the PDF engine,
  // the grammar checker and part of pdf.js are WebAssembly. No eval: the PDF
  // engine's few functions made from source text are made without it
  // (lib/typst/withoutEval.ts). `next dev` runs its code through eval, for
  // source maps.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "worker-src 'self'",
  // jsDelivr has the PDF engine's and the grammar checker's WebAssembly
  // (lib/typst/compilerSource.ts). DOIs are looked up at Crossref and doi.org,
  // which sends DataCite's DOIs, as arXiv's, on to data.crosscite.org
  // (lib/papers/lookup.ts). Drive is only its upload address
  // (lib/googleDrive.ts): Cloud Storage's API on the same host takes uploads
  // to buckets that need no sign-in. blob: is the preview's PDF, which pdf.js
  // draws and the checker reads (lib/check/preview.ts), and the grammar
  // checker's WebAssembly once downloaded (lib/check/grammar.worker.ts).
  "connect-src 'self' blob: https://cdn.jsdelivr.net https://api.crossref.org https://doi.org https://data.crosscite.org https://www.googleapis.com/upload/drive/v3/files",
  // Pictures of resumes' pages are blob: URLs, and the glass's lens and a
  // background pattern are data: URLs.
  "img-src 'self' data: blob:",
  // Pages come with style attributes and <style> elements.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

// What the site never uses, so no script on it can ask for it.
const PERMISSIONS_POLICY = [
  "accelerometer",
  "browsing-topics",
  "camera",
  "display-capture",
  "geolocation",
  "gyroscope",
  "hid",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "serial",
  "usb",
  "xr-spatial-tracking",
]
  .map((feature) => `${feature}=()`)
  .join(", ")

const SECURITY_HEADERS = [
  // Report-only to start with: it blocks nothing, and logs what it would
  // have, which the browser tests fail on (pageErrors, in e2e/helpers.ts).
  // Safari also logs an error that it names nowhere to send reports to, as
  // the site has no server to take them, and visitors' browsers send it nothing.
  { key: "Content-Security-Policy-Report-Only", value: CONTENT_SECURITY_POLICY },
  // Meanwhile, as frame-ancestors only reports, this keeps other sites from
  // showing the site in a frame, where a click on it could be made a click on theirs.
  { key: "X-Frame-Options", value: "DENY" },
  // A file is only run as the type it's sent as, never as one guessed from what's in it.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites are told a link came from resumezip, never from which page.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
]

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
  // The About page and the contact page are part of the home page now. Old
  // links, and messages already sent with these addresses, still land there:
  // /about#contact keeps its #contact, which the home page's story takes to
  // its end, where the address is. Here rather than in a page, whose
  // redirect() answers 307 (temporary), so search engines list the home page instead.
  async redirects() {
    return [
      { source: "/about", destination: "/", permanent: true },
      { source: "/contact", destination: "/#contact", permanent: true },
      ...Object.entries(RENAMED_PICTURES).map(([id, page]) => ({
        source: `/previews/${id}.webp`,
        destination: `/previews/${page}-resume-template.webp`,
        permanent: true,
      })),
    ]
  },
  async headers() {
    return [
      // On every response, not just pages: a worker takes its policy from its
      // own script's response, not from the page that starts it, and the
      // workers' scripts are in /_next/static.
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Files in public/ are otherwise checked with the server every time
      // they're shown. These keep their names when they change (e.g. a
      // template's new picture), so browsers keep them for a day rather than
      // for good.
      ...["/previews/:file*", "/home/:file*", "/backgrounds/:file*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      })),
    ]
  },
}
