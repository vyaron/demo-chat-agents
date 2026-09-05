import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    // Scope vitest to the unit suite. Without this it also globs
    // tests/e2e/*.spec.ts, and loading a Playwright spec under vitest throws
    // "Playwright Test did not expect test.describe() to be called here",
    // which fails `npm test` even when every unit test passes.
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Only app source. Without this, coverage reports on the config files and
      // the test helpers themselves, which says nothing about the app.
      include: ["src/**/*.{ts,tsx}"],
      // `main.tsx` is the mount point; `types/` and `vite-env.d.ts` are
      // type-only and compile to nothing, so they report a permanent 0% that
      // reads as a coverage gap when there is no code there to cover.
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/types/**"],
      reporter: ["text", "html"],
    },
  },
});
