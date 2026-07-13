import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve:{alias:{"@":path.resolve(__dirname,"./src"),"server-only":path.resolve(__dirname,"./test/stubs/server-only.ts")}},
  test:{include:["test/integration/**/*.integration.test.ts"],fileParallelism:false,maxWorkers:1,testTimeout:30_000,hookTimeout:60_000},
})
