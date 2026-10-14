import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
const query = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ db: { execute: query } }));
import { authenticateMegatonWorker } from "./megaton-worker-auth";
describe("Dedicated Megaton worker identity", () => {
  const token = "a".repeat(48),
    id = "00000000-0000-4000-8000-000000000001";
  beforeEach(() => {
    query.mockReset();
    vi.stubEnv(
      "MEGATON_WORKER_TOKEN_SHA256",
      createHash("sha256").update(token).digest("hex"),
    );
    vi.stubEnv("MEGATON_WORKER_ADMIN_ID", id);
    vi.stubEnv("MEGATON_WORKER_SESSION_VERSION", "1");
    query.mockResolvedValue({
      rows: [{ id, role: "owner", active: true, session_version: 1 }],
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects missing/forged credentials before database access", async () => {
    await expect(authenticateMegatonWorker(new Headers())).rejects.toThrow(
      "Unauthorized",
    );
    await expect(
      authenticateMegatonWorker(
        new Headers({ authorization: `Bearer ${"b".repeat(48)}` }),
      ),
    ).rejects.toThrow("Unauthorized");
    expect(query).not.toHaveBeenCalled();
  });
  it("requires a configured, active persisted identity and matching session version", async () => {
    expect(
      (
        await authenticateMegatonWorker(
          new Headers({ authorization: `Bearer ${token}` }),
        )
      ).id,
    ).toBe(id);
    query.mockResolvedValue({
      rows: [{ id, role: "owner", active: true, session_version: 2 }],
    });
    await expect(
      authenticateMegatonWorker(
        new Headers({ authorization: `Bearer ${token}` }),
      ),
    ).rejects.toThrow("revoked");
  });
  it("does not grant worker authority to viewers", async () => {
    query.mockResolvedValue({
      rows: [{ id, role: "viewer", active: true, session_version: 1 }],
    });
    await expect(
      authenticateMegatonWorker(
        new Headers({ authorization: `Bearer ${token}` }),
      ),
    ).rejects.toThrow("revoked");
  });
});
