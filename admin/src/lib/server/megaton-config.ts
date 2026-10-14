import "server-only";
import { MegatonError, emailAddress } from "../megaton";
export function megatonConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max)
      throw new MegatonError(`Invalid ${key}.`, 503);
    return value;
  };
  const mailboxConfigured = [
    "MEGATON_MAILCOW_HOST",
    "MEGATON_MAILCOW_USER",
    "MEGATON_MAILCOW_PASSWORD",
    "MEGATON_MAILCOW_FROM",
  ].every((key) => !!env[key]?.trim());
  return {
    enabled: env.MEGATON_ENABLED === "true",
    externalEnabled: env.MEGATON_EXTERNAL_ENABLED === "true",
    sendEnabled: env.MEGATON_SEND_ENABLED === "true",
    stopped: env.MEGATON_STOP !== "false",
    mailboxConfigured,
    host: env.MEGATON_MAILCOW_HOST?.trim() ?? "",
    user: env.MEGATON_MAILCOW_USER?.trim() ?? "",
    password: env.MEGATON_MAILCOW_PASSWORD ?? "",
    from: mailboxConfigured ? emailAddress(env.MEGATON_MAILCOW_FROM) : "",
    imapPort: integer("MEGATON_MAILCOW_IMAP_PORT", 993, 1, 65535),
    smtpPort: integer("MEGATON_MAILCOW_SMTP_PORT", 587, 1, 65535),
    smtpSecure: env.MEGATON_MAILCOW_SMTP_SECURE === "true",
    inbox: env.MEGATON_MAILCOW_INBOX || "INBOX",
    sent: env.MEGATON_MAILCOW_SENT || "Sent",
    pollLimit: integer("MEGATON_MAILCOW_POLL_LIMIT", 25, 1, 100),
    maxMessageBytes: 256000,
    lookbackDays: integer("MEGATON_MAILCOW_LOOKBACK_DAYS", 7, 1, 90),
    retentionDays: integer("MEGATON_MESSAGE_RETENTION_DAYS", 0, 0, 3650),
    dailySendLimit: integer("MEGATON_DAILY_SEND_LIMIT", 10, 0, 100),
  };
}
export function requireExternal(config = megatonConfig(), sending = false) {
  if (
    !config.enabled ||
    !config.externalEnabled ||
    config.stopped ||
    !config.mailboxConfigured ||
    (sending && !config.sendEnabled)
  )
    throw new MegatonError(
      "Mailcow is not enabled. Complete configuration and explicitly enable the required operation.",
      409,
    );
  if (!/^[a-zA-Z0-9.-]+$/.test(config.host) || !config.host.includes("."))
    throw new MegatonError(
      "Configure a Mailcow hostname without a URL or port.",
      503,
    );
  if (!config.smtpSecure && config.smtpPort !== 587)
    throw new MegatonError(
      "STARTTLS submission must use port 587; use implicit TLS for a custom secure port.",
      503,
    );
  return config;
}
