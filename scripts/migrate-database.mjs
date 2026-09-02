#!/usr/bin/env node
import { migrateSharedDatabase, resolveMigrationDatabaseUrl } from "./shared-migrator.mjs"

migrateSharedDatabase({ connectionString: resolveMigrationDatabaseUrl() }).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
