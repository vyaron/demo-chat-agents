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
  },
});
