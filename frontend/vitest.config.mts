import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Starting the Typst compiler and rendering a resume takes a few seconds.
    testTimeout: 60_000,
  },
})
