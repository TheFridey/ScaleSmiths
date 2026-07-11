import path from "node:path"
import { defineConfig } from "vitest/config"

// No vitest config previously existed in this project; every prior colocated
// test used only relative imports, so nothing needed path-alias or
// `server-only` resolution. Task 5 introduces the first unit test that
// imports a `server-only` module (`src/lib/server/forge-provider-health.ts`)
// directly, which needs both:
//   - the `@/*` path alias that `tsconfig.json` already declares for the app,
//   - a no-op stand-in for the `server-only` package, which is not an
//     installed dependency (Next.js resolves it internally via its own
//     webpack config) and whose real implementation throws outside the
//     "react-server" bundler condition.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
})
