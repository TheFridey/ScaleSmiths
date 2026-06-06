import type { Config } from "drizzle-kit"

export default {
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  migrations: {
    table: "__drizzle_web_migrations",
    schema: "drizzle",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config
