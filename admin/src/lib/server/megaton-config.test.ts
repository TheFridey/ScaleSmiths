import { describe, expect, it } from "vitest";
import { megatonConfig, requireExternal } from "./megaton-config";
describe("Mailcow fail-closed configuration", () => {
  it("does not connect or send by default", () => {
    const c = megatonConfig({});
    expect(c.mailboxConfigured).toBe(false);
    expect(c.stopped).toBe(true);
    expect(() => requireExternal(c)).toThrow();
  });
  it("credentials alone never enable sending", () => {
    const c = megatonConfig({
      MEGATON_MAILCOW_HOST: "mail.example.com",
      MEGATON_MAILCOW_USER: "sales@example.com",
      MEGATON_MAILCOW_PASSWORD: "fixture",
      MEGATON_MAILCOW_FROM: "sales@example.com",
    });
    expect(c.mailboxConfigured).toBe(true);
    expect(() => requireExternal(c, true)).toThrow();
  });
  it("requires STARTTLS on submission and bounds polling", () => {
    expect(() =>
      megatonConfig({ MEGATON_MAILCOW_POLL_LIMIT: "1000" }),
    ).toThrow();
    const c = megatonConfig({
      MEGATON_ENABLED: "true",
      MEGATON_EXTERNAL_ENABLED: "true",
      MEGATON_STOP: "false",
      MEGATON_MAILCOW_HOST: "mail.example.com",
      MEGATON_MAILCOW_USER: "sales@example.com",
      MEGATON_MAILCOW_PASSWORD: "fixture",
      MEGATON_MAILCOW_FROM: "sales@example.com",
      MEGATON_MAILCOW_SMTP_PORT: "25",
    });
    expect(() => requireExternal(c)).toThrow();
  });
});
