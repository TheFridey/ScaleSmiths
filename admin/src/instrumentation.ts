import type { Instrumentation } from "next"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { initializeAdminMonitoring } = await import("@/lib/server/sentry-monitoring-startup")
  initializeAdminMonitoring()
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
