import { NextResponse } from "next/server";
import { guardApiCapability } from "@/lib/server/rbac";
import { megatonSnapshot, megatonMutation } from "@/lib/server/megaton";
import { MegatonError } from "@/lib/megaton";
import { AdminIdentityError } from "@/lib/admin-users";
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function failure(error: unknown) {
  if (error instanceof MegatonError || error instanceof AdminIdentityError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers },
    );
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505")
    return NextResponse.json(
      {
        error:
          "This record or pending operation already exists. Reload to review it.",
      },
      { status: 409, headers },
    );
  console.error("Megaton operation failed", { code: code ?? "unavailable" });
  return NextResponse.json(
    {
      error:
        "Megaton data is unavailable. Check connectivity and the shared migration plan.",
    },
    { status: 503, headers },
  );
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await megatonSnapshot(
        await guardApiCapability("megaton.read"),
        params.get("query") || "",
        Number(params.get("page") || 1),
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("megaton.read");
    if (
      request.headers.get("origin") !==
      new URL(process.env.AUTH_URL || request.url).origin
    )
      throw new MegatonError("Invalid request origin.", 403);
    if (!(await checkDurableRateLimit(`megaton:${actor.id}`, 60, 60000)).ok)
      throw new MegatonError("Too many operations. Try again shortly.", 429);
    const raw = await request.text();
    if (raw.length > 30000) throw new MegatonError("Payload too large.", 413);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw new MegatonError("Invalid JSON.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new MegatonError("Invalid payload.");
    return NextResponse.json(
      await megatonMutation(actor, input as Record<string, unknown>),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
