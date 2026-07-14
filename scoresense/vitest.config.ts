import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  // Tests are plain TS logic, no CSS involved — skip loading the project's
  // Next.js/Tailwind postcss.config.mjs, which isn't valid outside Next's
  // own build pipeline.
  css: { postcss: {} },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})
