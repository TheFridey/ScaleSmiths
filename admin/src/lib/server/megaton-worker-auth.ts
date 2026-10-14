import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { hasCapability } from "../rbac";
import type { AdminRole } from "../admin-users";
import { MegatonError } from "../megaton";
export async function authenticateMegatonWorker(headers: Headers) {
  const digest = process.env.MEGATON_WORKER_TOKEN_SHA256 || "",
    adminId = process.env.MEGATON_WORKER_ADMIN_ID || "",
    version = process.env.MEGATON_WORKER_SESSION_VERSION || "";
  if (!/^[a-f0-9]{64}$/.test(digest) || !adminId || !/^\d+$/.test(version))
    throw new MegatonError("Worker is not configured.", 503);
  const match = /^Bearer ([A-Za-z0-9_-]{43,256})$/.exec(
    headers.get("authorization") || "",
  );
  if (
    !match ||
    !timingSafeEqual(
      createHash("sha256").update(match[1]).digest(),
      Buffer.from(digest, "hex"),
    )
  )
    throw new MegatonError("Unauthorized worker.", 401);
  const result = await db.execute(
    sql`select id,role,active,session_version from admin_users where id=${adminId}`,
  );
  const user = result.rows[0] as
    | { id: string; role: AdminRole; active: boolean; session_version: number }
    | undefined;
  if (
    !user?.active ||
    user.session_version !== Number(version) ||
    !hasCapability(user.role, "megaton.write")
  )
    throw new MegatonError("Worker identity revoked.", 403);
  return { id: user.id, role: user.role, sessionVersion: user.session_version };
}
