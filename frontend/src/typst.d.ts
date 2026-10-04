// Typst templates are bundled as plain strings (see next.config.js).
declare module "*.typ" {
  const source: string
  export default source
}
