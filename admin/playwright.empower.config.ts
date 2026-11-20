import { defineConfig } from '@playwright/test'
/** Operation Empower B1.1 + B1.2 browser acceptance against a production admin build on the disposable loopback stack. */
export default defineConfig({
  testDir:'./test/e2e', testMatch:'empower-academy.spec.ts', workers:1, fullyParallel:false,
  timeout:420000, expect:{timeout:20000}, outputDir:'test-results/empower', reporter:[['list']],
  use:{baseURL:process.env.EMPOWER_ADMIN_BASE_URL || 'http://localhost:3103',...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}}:{channel:'chrome' as const}),actionTimeout:20000,navigationTimeout:30000},
})
