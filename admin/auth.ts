import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { checkLoginRateLimit, getAuthRequestIp, loginRateLimitKeys } from "./src/lib/login-limiter"

/*
 * ScaleSmiths admin currently uses a single-user credentials pattern:
 * ADMIN_EMAIL identifies the allowed admin account and ADMIN_PASSWORD stores
 * that account's password. To add more users, add another object here and move
 * password lookup to a per-user secret or database column.
 *
 * ADMIN_PASSWORD may be a plain string for local development, but production
 * should use a bcrypt hash. Generate one with bcryptjs, store the hash in the
 * environment, and keep the value starting with "$2" so authorize() verifies it
 * with bcrypt.compare().
 */
const users = [
  {
    id: "1",
    email: process.env.ADMIN_EMAIL,
    name: "Rhys",
  },
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase()
        const password = String(credentials?.password ?? "")
        const adminPassword = process.env.ADMIN_PASSWORD ?? ""
        const allowed = await checkLoginRateLimit(loginRateLimitKeys("admin-login", getAuthRequestIp(request), email))

        if (!allowed) return null

        const user = users.find((u) => u.email?.toLowerCase() === email)

        if (!user || !adminPassword) return null

        const valid = adminPassword.startsWith("$2")
          ? await import("bcryptjs").then((bcrypt) => bcrypt.default.compare(password, adminPassword))
          : password === adminPassword

        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
})
