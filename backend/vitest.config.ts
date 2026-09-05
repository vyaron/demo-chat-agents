import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Match the frontend: no globals, so tests import from "vitest" explicitly.
    globals: false,
    include: ["tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      // Without an explicit include, coverage also reports on `dist/` after a
      // `npm run build:server`, which doubles every file and skews the totals.
      include: ["src/**/*.ts"],
      // The process entry point only wires the server together; there is
      // nothing to assert that a route or socket test does not already cover.
      exclude: ["src/index.ts"],
      reporter: ["text", "html"],
    },
  },
})
