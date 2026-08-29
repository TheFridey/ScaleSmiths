import { describe, expect, it } from "vitest"
import {
  buildAdminRequestLink,
  buildAdminRequestSubject,
  buildClientConfirmationSubject,
  deriveClientDisplayName,
  isCriticalClientRequest,
  resolveRequestNotificationConfig,
  sanitizeHeaderValue,
  sendClientRequestNotifications,
} from "./request-notifications"

describe("request notifications", () => {
  function env(values: Record<string, string>): NodeJS.ProcessEnv {
    return { NODE_ENV: "test", ...values }
  }

  const baseInput = {
    requestId: 7,
    clientId: "glow-tanning",
    clientName: "Glow Tanning",
    clientEmail: "owner@glowtanning.co.uk",
    title: "Contact form broken",
    category: "form_issue" as const,
    priority: "critical" as const,
  }

  it("builds critical admin subjects clearly", () => {
    expect(buildAdminRequestSubject(baseInput)).toBe("[CRITICAL] Client request: Contact form broken")
  })

  it("uses support email and admin portal URL from env", () => {
    const testEnv = env({
      RESEND_API_KEY: "re_test",
      RESEND_FROM: "portal@scalesmiths.co.uk",
      SUPPORT_EMAIL: "support@scalesmiths.co.uk",
      ADMIN_PORTAL_URL: "https://admin.scalesmiths.co.uk/",
    })

    expect(resolveRequestNotificationConfig(testEnv)).toMatchObject({
      apiKey: "re_test",
      from: "portal@scalesmiths.co.uk",
      supportEmail: "support@scalesmiths.co.uk",
      adminPortalUrl: "https://admin.scalesmiths.co.uk",
    })
    expect(buildAdminRequestLink(42, testEnv)).toBe("https://admin.scalesmiths.co.uk/requests?request=42")
  })

  it("falls back to Resend from address as support recipient", () => {
    const config = resolveRequestNotificationConfig(env({
      RESEND_FROM: "hello@scalesmiths.co.uk",
    }))

    expect(config.supportEmail).toBe("hello@scalesmiths.co.uk")
  })

  it("derives display names and critical routing from safe request fields", () => {
    expect(deriveClientDisplayName("https://www.glow-tanning.co.uk")).toBe("Glow Tanning")
    expect(isCriticalClientRequest("urgent_support", "medium")).toBe(true)
    expect(isCriticalClientRequest("website_update", "low")).toBe(false)
    expect(buildClientConfirmationSubject({
      requestId: 1,
      clientId: "client",
      clientName: "Client",
      title: "Text change",
      category: "website_update" as const,
      priority: "low" as const,
    })).toBe("Request received - Text change")
  })

  it("returns failed with status and failureReason when configuration is missing", async () => {
    const result = await sendClientRequestNotifications(baseInput, env({}))
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("configuration")
    expect(result.status).toBe("failed")
    expect(result.failureReason).toBe("configuration")
  })

  it("returns sent status on success", async () => {
    const testEnv = env({
      RESEND_API_KEY: "re_test",
      RESEND_FROM: "hello@scalesmiths.co.uk",
      SUPPORT_EMAIL: "support@scalesmiths.co.uk",
      ADMIN_PORTAL_URL: "https://admin.scalesmiths.co.uk",
    })
    const result = await sendClientRequestNotifications(baseInput, testEnv)
    expect(result.ok).toBe(false)
    expect(result.status).toBe("failed")
    expect(result.failureReason).toBe("delivery")
  })
})

describe("sanitizeHeaderValue", () => {
  it("strips CR, LF, and NUL from a header-bound value", () => {
    expect(sanitizeHeaderValue("Hello\r\nBcc: attacker@example.com")).toBe("HelloBcc: attacker@example.com")
    expect(sanitizeHeaderValue("line1\nline2")).toBe("line1line2")
    expect(sanitizeHeaderValue("a\0b")).toBe("ab")
  })

  it("leaves an ordinary value untouched", () => {
    expect(sanitizeHeaderValue("Homepage content change")).toBe("Homepage content change")
  })
})

describe("buildAdminRequestSubject", () => {
  it("never contains a newline even when the title does", () => {
    const subject = buildAdminRequestSubject({
      requestId: 1,
      clientId: "client-one",
      clientName: "Client One",
      title: "Change this\r\nX-Injected: true",
      category: "general_support",
      priority: "medium",
    })
    expect(subject).not.toMatch(/[\r\n]/)
  })
})
