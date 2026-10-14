// Server-only, idempotent configuration. Never prints credentials or tokens.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  realpathSync,
} from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { Client } from "pg";
import webpush from "web-push";
const args = process.argv.slice(2);
if (!args.includes("--apply"))
  throw new Error(
    "Use --apply to prepare server-only Megaton notification and worker keys.",
  );
const envPath = realpathSync(
  fileURLToPath(new URL("../../.env", import.meta.url)),
);
loadEnvFile(envPath);
if (!process.env.ADMIN_DATABASE_URL)
  throw new Error("ADMIN_DATABASE_URL is required.");
const client = new Client({
  connectionString: process.env.ADMIN_DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
await client.connect();
let owner;
try {
  const index = args.indexOf("--admin-id");
  const id = index >= 0 ? args[index + 1] : null;
  const { rows } = await client.query(
    "select id,session_version from admin_users where active=true and role='owner' and ($1::text is null or id::text=$1) order by id limit 2",
    [id],
  );
  if (rows.length !== 1)
    throw new Error(
      "Specify --admin-id for exactly one active owner. No environment values were changed.",
    );
  owner = rows[0];
} finally {
  await client.end();
}
let text = readFileSync(envPath, "utf8");
const settings = {};
if (
  !process.env.MEGATON_VAPID_PUBLIC_KEY &&
  !process.env.MEGATON_VAPID_PRIVATE_KEY
) {
  const keys = webpush.generateVAPIDKeys();
  settings.MEGATON_VAPID_PUBLIC_KEY = keys.publicKey;
  settings.MEGATON_VAPID_PRIVATE_KEY = keys.privateKey;
} else if (
  !process.env.MEGATON_VAPID_PUBLIC_KEY ||
  !process.env.MEGATON_VAPID_PRIVATE_KEY
)
  throw new Error("Incomplete VAPID key pair. No environment values changed.");
if (
  process.env.MEGATON_PUSH_ENCRYPTION_KEY &&
  !/^[a-f0-9]{64}$/.test(process.env.MEGATON_PUSH_ENCRYPTION_KEY)
)
  throw new Error(
    "Invalid push encryption key. No environment values changed.",
  );
settings.MEGATON_PUSH_ENCRYPTION_KEY =
  process.env.MEGATON_PUSH_ENCRYPTION_KEY || randomBytes(32).toString("hex");
const token =
  (!args.includes("--rotate-worker-token") &&
    process.env.MEGATON_WORKER_TOKEN) ||
  randomBytes(48).toString("base64url");
if (!/^[A-Za-z0-9_-]{43,256}$/.test(token))
  throw new Error(
    "Existing worker token is invalid. No environment values changed.",
  );
Object.assign(settings, {
  MEGATON_WORKER_TOKEN: token,
  MEGATON_WORKER_TOKEN_SHA256: createHash("sha256").update(token).digest("hex"),
  MEGATON_WORKER_ADMIN_ID: owner.id,
  MEGATON_WORKER_SESSION_VERSION: String(owner.session_version),
  MEGATON_WORKER_URL: "http://127.0.0.1:3201/api/megaton/worker",
  MEGATON_WORKER_INTERVAL_SECONDS: "60",
  MEGATON_VAPID_SUBJECT: "mailto:admin@scalesmiths.co.uk",
  MEGATON_NOTIFICATION_EMAIL_FALLBACK: "true",
});
for (const [name, value] of Object.entries({
  MEGATON_AI_SEARCH_ENABLED: "false",
  MEGATON_NOTIFICATIONS_ENABLED: "false",
  MEGATON_SOCIAL_SEND_ENABLED: "false",
}))
  if (process.env[name] === undefined) settings[name] = value;
if (args.includes("--enable-notifications"))
  Object.assign(settings, {
    MEGATON_NOTIFICATIONS_ENABLED: "true",
    MEGATON_ENABLED: "true",
    MEGATON_EXTERNAL_ENABLED: "true",
    MEGATON_STOP: "false",
  });
for (const [name, value] of Object.entries(settings)) {
  const pattern = new RegExp("^" + name + "\\s*=.*$", "gm");
  text = text.replace(pattern, "").replace(/\n{3,}/g, "\n\n");
  text += "\n" + name + "=" + value;
}
const temporary = envPath + ".megaton.tmp";
writeFileSync(temporary, text + "\n", { mode: 0o600 });
chmodSync(temporary, 0o600);
renameSync(temporary, envPath);
console.log(
  "Megaton push keys and owner-bound worker credentials saved to the server environment. No credential values were printed.",
);
console.log(
  args.includes("--enable-notifications")
    ? "Internal approval notifications enabled. Prospect sending flags were not changed."
    : "Delivery flags preserved. Use --enable-notifications to enable internal alerts.",
);
