import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "tests/e2e/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
})
