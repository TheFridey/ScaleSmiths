import { NextRequest, NextResponse } from "next/server"
import {
  authenticateVentureServiceToken,
  executeVentureMcpTool,
  VENTURE_MCP_TOOLS,
  VentureMcpError,
} from "@/lib/server/venture-lab-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RpcRequest = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID()

  try {
    const actor = await authenticateVentureServiceToken(request.headers.get("authorization"))
    const body = await request.json() as RpcRequest
    const id = body.id ?? null

    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return rpcError(id, -32600, "Invalid Request", 400, requestId)
    }

    if (body.method === "initialize") {
      return rpcResult(id, {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "scalesmiths-venture-lab", version: "0.1.0" },
        capabilities: { tools: {} },
      }, requestId)
    }

    if (body.method === "tools/list") {
      const tools = VENTURE_MCP_TOOLS
        .filter((tool) => actor.scopes.includes(tool.scope))
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: { type: "object", additionalProperties: true },
        }))
      return rpcResult(id, { tools }, requestId)
    }

    if (body.method === "tools/call") {
      const name = typeof body.params?.name === "string" ? body.params.name : ""
      const args = body.params?.arguments && typeof body.params.arguments === "object" && !Array.isArray(body.params.arguments)
        ? body.params.arguments as Record<string, unknown>
        : {}
      const result = await executeVentureMcpTool(actor, name, args)
      return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] }, requestId)
    }

    return rpcError(id, -32601, "Method not found", 404, requestId)
  } catch (error) {
    if (error instanceof VentureMcpError) {
      const code = error.status === 401 ? -32001 : error.status === 403 ? -32003 : -32000
      return rpcError(null, code, error.code, error.status, requestId)
    }
    return rpcError(null, -32603, "Internal error", 500, requestId)
  }
}

function rpcResult(id: RpcRequest["id"], result: unknown, requestId: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, result },
    { headers: { "Cache-Control": "private, no-store", "x-request-id": requestId } },
  )
}

function rpcError(id: RpcRequest["id"], code: number, message: string, status: number, requestId: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status, headers: { "Cache-Control": "private, no-store", "x-request-id": requestId } },
  )
}
