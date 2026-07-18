import type { Config } from "drizzle-kit"
import { resolveMigrationDatabaseUrl } from "./src/lib/database-url"

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveMigrationDatabaseUrl() ?? "",
  },
} satisfies Config
