import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException }))

import { captureGlobalRenderError, renderGlobalErrorFallback } from "./global-error-content"

describe("web global error fallback", () => {
  beforeEach(() => captureException.mockClear())

  it("captures the render error through Sentry", () => {
    const error = new Error("private stack detail")
    captureGlobalRenderError(error)
    captureGlobalRenderError(error)
    expect(captureException).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(error)
  })

  it("renders a safe retry fallback without error details", () => {
    const markup = renderToStaticMarkup(renderGlobalErrorFallback(() => undefined))
    expect(markup).toContain("Something went wrong")
    expect(markup).toContain("Try again")
    expect(markup).not.toContain("secret request path")
  })
})
