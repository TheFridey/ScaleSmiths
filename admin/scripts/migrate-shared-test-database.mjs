import path from "node:path"
import { migrateSharedDatabase } from "../../scripts/shared-migrator.mjs"

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL
if (!url || !/(?:test|e2e)/i.test(new URL(url).pathname)) throw new Error("Refusing to migrate a database whose name is not an explicit test/E2E fixture.")
await migrateSharedDatabase({ connectionString: url, root: path.resolve("..") })
