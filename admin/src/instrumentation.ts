import type { Instrumentation } from "next"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { initializeAdminMonitoring } = await import("@/lib/server/sentry-monitoring-startup")
  initializeAdminMonitoring()
  // Start the durable Forge worker so queued work survives restarts and multiple
  // replicas coordinate safely (no-op in build/test; see forge-worker.ts).
  const { startForgeWorker } = await import("@/lib/server/forge-worker")
  startForgeWorker()
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { captureMonitoringException } = await import("@/lib/server/monitoring")
  captureMonitoringException(error, {
    requestId: request.headers["x-request-id"],
    method: request.method,
    routePath: context.routePath,
    errorCategory: "unhandled_request",
  })
}
