import path from "node:path"
import { defineConfig } from "vitest/config"

// Opt-in ASCEND workload benchmark; never part of CI. See test/integration/ascend-engine.benchmark.ts.
export default defineConfig({
  resolve:{alias:{"@":path.resolve(__dirname,"./src"),"server-only":path.resolve(__dirname,"./test/stubs/server-only.ts")}},
  test:{include:["test/integration/ascend-engine.benchmark.ts"],fileParallelism:false,maxWorkers:1,testTimeout:1_800_000,hookTimeout:120_000},
})
