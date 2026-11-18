import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./test/e2e', testMatch:'expansion.spec.ts', workers:1, fullyParallel:false,
  timeout:900000, expect:{timeout:30000}, outputDir:'test-results/expansion', reporter:[['list']],
  use:{baseURL:process.env.EXPANSION_ADMIN_BASE_URL || 'http://localhost:3103',channel:'chrome',actionTimeout:30000,navigationTimeout:60000,trace:'retain-on-failure',screenshot:'only-on-failure',viewport:{width:1440,height:1000}},
})
