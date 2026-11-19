import { defineConfig } from '@playwright/test'
// Authenticated founder/partner acceptance against an explicit disposable local stack (see programme.spec.ts).
export default defineConfig({
  testDir:'./test/e2e', testMatch:'programme.spec.ts', workers:1, fullyParallel:false,
  timeout:600000, expect:{timeout:30000}, outputDir:'test-results/programme', reporter:[['list']],
  use:{baseURL:process.env.EXPANSION_ADMIN_BASE_URL || 'http://localhost:3103',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}}:{}),
    actionTimeout:30000,navigationTimeout:90000,trace:'off',screenshot:'only-on-failure',viewport:{width:1440,height:1000}},
})
