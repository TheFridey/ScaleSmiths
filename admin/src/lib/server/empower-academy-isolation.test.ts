import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/*
 * Academy learning is voluntary and must never influence commission, achievements, referrals, prospect allocation or withdrawals
 * (SECURITY-MODEL 3.5, AP-GOV-02). Only the Academy service may read or write learning records.
 */
const src = path.resolve(__dirname, "..", "..")
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const files = walk(src).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))

describe("Academy learning records are isolated from commercial code", () => {
  it("are referenced only by the Academy service", () => {
    const readers = files.filter((f) => /empower_academy_(completions|check_attempts|course_state)/.test(readFileSync(f, "utf8"))).map((f) => path.relative(src, f).replaceAll("\\", "/"))
    expect(readers).toEqual(["lib/server/empower-academy.ts"])
  })
  it("the Academy service imports nothing financial or allocation-related", () => {
    const source = readFileSync(path.join(src, "lib", "server", "empower-academy.ts"), "utf8")
    expect(source).not.toMatch(/from "@\/lib\/(server\/)?expansion-(finance|programme|research|recognition|profiles)"/)
    expect(source).not.toMatch(/expansion_(commission|payments|payout|withdrawal|referral|achievement|qualification|allocation|research)/)
  })
})
