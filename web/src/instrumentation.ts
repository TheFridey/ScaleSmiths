import type { Instrumentation } from "next"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { initializeWebMonitoring } = await import("@/lib/sentry-monitoring-startup")
  initializeWebMonitoring()
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { captureWebException } = await import("@/lib/server-monitoring")
  captureWebException(error, {
    requestId: request.headers["x-request-id"],
    method: request.method,
    routePath: context.routePath,
    errorCategory: "unhandled_request",
  })
}
