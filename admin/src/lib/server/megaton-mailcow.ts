import "server-only";
import nodemailer from "megaton-smtp";
import { ImapFlow } from "imapflow";
import PostalMime from "postal-mime";
import { megatonConfig, requireExternal } from "./megaton-config";
import { emailAddress } from "../megaton";

export interface MailcowMessage {
  externalId: string;
  sender: string;
  subject: string;
  body: string;
  occurredAt: string;
  uid: number;
  direction?: "inbound" | "outbound";
}
export interface MailcowCursor {
  validity?: string;
  uid?: number;
}
export function mailTransport(config = requireExternal(megatonConfig(), true)) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: true,
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    logger: false,
    debug: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
export async function sendMailcow(
  input: {
    recipient: string;
    subject: string;
    body: string;
    messageId: string;
    inReplyTo?: string;
  },
  config = requireExternal(megatonConfig(), true),
) {
  const transport = mailTransport(config);
  try {
    const result = await transport.sendMail({
      from: config.from,
      to: emailAddress(input.recipient),
      subject: input.subject,
      text: input.body,
      messageId: input.messageId,
      inReplyTo: input.inReplyTo,
      references: input.inReplyTo,
    });
    if (!result.accepted?.length || result.rejected?.length)
      throw new Error("smtp_not_accepted");
    return { reference: result.messageId as string };
  } finally {
    transport.close();
  }
}
export async function readMailcow(
  cursor: MailcowCursor,
  consume: (message: MailcowMessage) => Promise<void>,
  config = requireExternal(),
  sent = false,
) {
  const client = new ImapFlow({
    host: config.host,
    port: config.imapPort,
    secure: true,
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock(sent ? config.sent : config.inbox);
    try {
      const mailbox = client.mailbox;
      if (!mailbox) throw new Error("imap_mailbox_unavailable");
      const validity = String(mailbox.uidValidity);
      // Initial/rebuilt cursors import only the explicitly configured recent window.
      const last = cursor.validity === validity ? (cursor.uid ?? 0) : 0;
      const uids = (
        (await client.search(
          {
            uid: `${last + 1}:*`,
            ...(last === 0
              ? { since: new Date(Date.now() - config.lookbackDays * 86400000) }
              : {}),
          },
          { uid: true },
        )) || []
      )
        .filter((uid) => uid > last)
        .slice(0, config.pollLimit);
      let next = last;
      for (const uid of uids) {
        const item = await client.fetchOne(
          uid,
          {
            source: { start: 0, maxLength: config.maxMessageBytes + 1 },
            size: true,
          },
          { uid: true },
        );
        if (
          !item ||
          !item.source ||
          (item.size ?? item.source.length) > config.maxMessageBytes
        )
          throw new Error("imap_message_too_large");
        const parsed = await PostalMime.parse(item.source);
        const sender = sent ? parsed.to?.[0]?.address : parsed.from?.address;
        const date = parsed.date ? new Date(parsed.date) : new Date();
        if (sender)
          await consume({
            externalId:
              parsed.messageId ||
              `mailcow:${sent ? "sent" : "inbox"}:${validity}:${uid}`,
            sender: emailAddress(sender),
            subject: (parsed.subject || "No subject").slice(0, 300),
            body: (
              parsed.text ||
              "[Message has no plain-text body. Review in Mailcow.]"
            ).slice(0, 20000),
            occurredAt: (Number.isFinite(date.valueOf())
              ? date
              : new Date()
            ).toISOString(),
            uid,
            direction: sent ? "outbound" : "inbound",
          });
        next = uid;
      }
      return { validity, uid: next };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }
}
