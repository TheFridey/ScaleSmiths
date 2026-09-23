import { NextResponse } from "next/server"
import {
  authenticateVentureDirector,
  executeVentureMcpTool,
  VentureMcpError,
  ventureMcpToolDefinitions,
} from "@/lib/server/venture-lab-mcp"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const id = await request.clone().json().then((body) => body?.id ?? null).catch(() => null)
  try {
    const service = await authenticateVentureDirector(request.headers)
    const body = await request.json().catch(() => null)
    if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") return rpcError(id, -32600, "Invalid Request", 400)

    if (body.method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "scalesmiths-venture-lab", version: "0.1.0" },
        },
      })
    }

    if (body.method === "tools/list") {
      return NextResponse.json({ jsonrpc: "2.0", id, result: { tools: ventureMcpToolDefinitions() } })
    }

    if (body.method === "tools/call") {
      const result = await executeVentureMcpTool({
        serviceId: service.id,
        tool: body.params?.name,
        arguments: body.params?.arguments,
        requestId: request.headers.get("x-request-id"),
      })
      return NextResponse.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } })
    }

    return rpcError(id, -32601, "Method not found", 404)
  } catch (error) {
    if (error instanceof VentureMcpError) return rpcError(id, -32000, error.safeMessage, error.status, error.code)
    return rpcError(id, -32603, "Internal error", 500)
  }
}

function rpcError(id: unknown, code: number, message: string, status: number, data?: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } }, { status })
}
