import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const serverRoot = path.resolve(__dirname, "..")
const facadePath = path.join(serverRoot, "forge-run-orchestrator.ts")
const packageRoot = path.join(serverRoot, "forge-runs")

describe("Forge run orchestration architecture policy", () => {
  it("keeps the legacy facade server-only and composition-only", async () => {
    const source = await readFile(facadePath, "utf8")
    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(30)
    expect(source).toContain('import "server-only"')
    expect(source).not.toMatch(/\b(db|transaction|select|insert|update|delete)\b/)
    expect(source).not.toMatch(/\b(async function|class)\b/)
  })

  it("keeps server orchestration independent from routes and React", async () => {
    const files = (await readdir(packageRoot)).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    for (const file of files) {
      const source = await readFile(path.join(packageRoot, file), "utf8")
      expect(source, file).toContain('import "server-only"')
      expect(source, file).not.toMatch(/from ["'][^"']*(?:app\/api|components|react)[^"']*["']/i)
      expect(source, file).not.toContain('"use client"')
    }
  })

  it("prevents client modules importing the server orchestration package", async () => {
    const srcRoot = path.resolve(serverRoot, "../..")
    const offenders: string[] = []
    async function visit(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name)
        if (entry.isDirectory()) await visit(target)
        else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          const source = await readFile(target, "utf8")
          if (source.includes('"use client"') && /forge-run-orchestrator|lib\/server\/forge-runs/.test(source)) offenders.push(path.relative(srcRoot, target))
        }
      }
    }
    await visit(srcRoot)
    expect(offenders).toEqual([])
  })
})
