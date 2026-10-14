import { NextResponse } from "next/server";
import { authenticateMegatonWorker } from "@/lib/server/megaton-worker-auth";
import { runMegatonWorker } from "@/lib/server/megaton";
import { MegatonError } from "@/lib/megaton";
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const actor = await authenticateMegatonWorker(request.headers);
    if (
      !(await checkDurableRateLimit(`megaton-worker:${actor.id}`, 12, 60000)).ok
    )
      throw new MegatonError("Worker rate limit.", 429);
    return NextResponse.json(await runMegatonWorker(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof MegatonError ? error.message : "Worker unavailable.",
      },
      {
        status: error instanceof MegatonError ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
