/**
 * Client helper for the Forge job queue. Submits a long-running action and resolves with the
 * action's result regardless of execution mode:
 *  - inline (dev fallback): the route already returns the result, so it resolves immediately.
 *  - background (queued): the route returns a job id; this polls /api/forge/jobs/:id until done.
 *
 * The resolved value is the same shape the action returned synchronously before, so callers can
 * keep reading `result.report`, `result.preview`, etc.
 */
export async function submitForgeJob<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal: options.signal,
  })
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    throw new Error(typeof json.error === "string" ? json.error : "Request failed.")
  }

  if (json.queued === true && typeof json.jobId === "number") {
    return pollForgeJob<T>(json.jobId, options.signal)
  }

  return json as T
}

async function pollForgeJob<T>(jobId: number, signal?: AbortSignal): Promise<T> {
  const deadline = Date.now() + 15 * 60_000
  let delayMs = 800

  while (Date.now() < deadline) {
    await delay(delayMs, signal)
    delayMs = Math.min(delayMs + 400, 2500)

    const response = await fetch(`/api/forge/jobs/${jobId}`, { cache: "no-store", signal })
    const job = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      throw new Error(typeof job.error === "string" ? job.error : "Unable to read job status.")
    }

    if (job.status === "completed") {
      return (job.result ?? { ok: true }) as T
    }
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(typeof job.error === "string" && job.error ? job.error : "The job failed.")
    }
  }

  throw new Error("Timed out waiting for the job to finish.")
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new Error("Aborted."))
      },
      { once: true },
    )
  })
}
