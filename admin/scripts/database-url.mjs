export function adminDatabaseUrl(env = process.env) {
  if (env.ADMIN_DATABASE_URL) return env.ADMIN_DATABASE_URL
  if (env.NODE_ENV === "production") throw new Error("ADMIN_DATABASE_URL is required for admin operational scripts in production.")
  if (env.DATABASE_URL) return env.DATABASE_URL
  throw new Error("ADMIN_DATABASE_URL or local/test DATABASE_URL is required.")
}
