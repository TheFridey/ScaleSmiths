import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { checkLoginRateLimit, getAuthRequestIp, loginRateLimitKeys } from "./src/lib/login-limiter"
import { captureMonitoringException, captureMonitoringMessage } from "./src/lib/server/monitoring"
import { authenticateAdminUser, findAdminUserById, recordSuccessfulAdminLogin, verifyAdminMfaChallenge } from "./src/lib/server/admin-users"
import { isAdminSessionCurrent } from "./src/lib/admin-users"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator code", type: "text" },
        recoveryCode: { label: "Recovery code", type: "text" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase()
        const password = String(credentials?.password ?? "")
        const totp = String(credentials?.totp ?? "").trim()
        const recoveryCode = String(credentials?.recoveryCode ?? "").trim()
        const allowed = await checkLoginRateLimit(loginRateLimitKeys("admin-login", getAuthRequestIp(request), email))

        if (!allowed) {
          captureMonitoringMessage("Admin authentication rate limit exceeded", "warning", { actorId: email || "unknown", errorCategory: "authentication_rate_limit" })
          return null
        }

        try {
          const user = await authenticateAdminUser(email, password)
          if (!user) {
            captureMonitoringMessage("Admin authentication rejected", "warning", { actorId: email || "unknown", errorCategory: "authentication_credentials" })
            return null
          }
          const mfaValid = await verifyAdminMfaChallenge(user, { totp, recoveryCode })
          if (!mfaValid) {
            captureMonitoringMessage("Admin MFA challenge rejected", "warning", { actorId: user.id, errorCategory: "mfa_challenge" })
            return null
          }
          await recordSuccessfulAdminLogin(user.id)
          return { id: user.id, email: user.email, name: user.displayName, role: user.role, sessionVersion: user.sessionVersion, active: user.active }
        } catch (error) {
          captureMonitoringException(error, { actorId: email, errorCategory: "authentication_internal" })
          return null
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const token = await authConfig.callbacks!.jwt!(params)
      if (!params.user && token.sub) {
        const persisted = await findAdminUserById(token.sub).catch(() => null)
        token.accessRevoked = !persisted || !isAdminSessionCurrent(persisted, token.sessionVersion)
        if (persisted) { token.role = persisted.role; token.active = persisted.active }
      }
      return token
    },
  },
})
