import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { businessNameKey } from "./expansion"

/** Operation Ascend B2.2: the SQL function in migration 0099 and businessNameKey must agree on every name. */
const NAMES = [
  "Smith & Sons Ltd", "Smith and Sons Limited", "smith-and-sons", "The Bakery", "Bakery Ltd.", "THE BAKERY LIMITED", "The", "Ltd", "Limited Ltd", "The Limited",
  "Acme Holdings LLP", "Acme Holdings", "Acme Inc", "Acme Incorporated", "Acme CIC", "Café Été", "", "  ", "A&B", "AB", "Theatre Company", "The Theatre Company Ltd",
  "Bread & Co", "Ltd Bakery", "Old Plc Road Garage", "Garage plc", "Ltd Ltd", "123 Ltd", "Nordic Øl LLC", "It's The Place Ltd", "x".repeat(300),
]
let db: PGlite
describe("business name key: SQL and TypeScript parity", () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec("create table prospects(id serial primary key,business_name text); create table clients(id serial primary key,name text);")
    await db.exec(readFileSync(new URL("../../drizzle/0099_ascend_business_name_key.sql", import.meta.url), "utf8"))
  }, 30000)
  afterAll(async () => { await db?.close() })

  it("gives identical keys in PostgreSQL and TypeScript", async () => {
    for (const name of NAMES) {
      const { rows } = await db.query<{ k: string }>("select expansion_business_name_key($1) k", [name])
      expect(rows[0].k, JSON.stringify(name)).toBe(businessNameKey(name))
    }
    expect((await db.query<{ k: string | null }>("select expansion_business_name_key(null) k")).rows[0].k).toBe("")
  })
  it("treats spelling variants of one company as the same and keeps distinct businesses apart", () => {
    expect(businessNameKey("Smith & Sons Ltd")).toBe(businessNameKey("Smith and Sons Limited"))
    expect(businessNameKey("The Bakery")).toBe(businessNameKey("BAKERY LTD."))
    expect(businessNameKey("Acme Holdings LLP")).toBe(businessNameKey("Acme Holdings"))
    expect(businessNameKey("Theatre Company")).not.toBe(businessNameKey("Atre Company"))
    expect(businessNameKey("Old Plc Road Garage")).toBe("oldplcroadgarage")
    // A name that is only a legal form keeps its own key, so it cannot match every other such name.
    expect(businessNameKey("Ltd")).toBe("ltd"); expect(businessNameKey("Limited")).toBe("limited")
    expect(businessNameKey("The")).toBe("the")
  })
  it("is usable by the expression index", async () => {
    await db.query("insert into prospects(business_name) values('Smith & Sons Ltd')")
    expect((await db.query("select id from prospects where expansion_business_name_key(business_name)=expansion_business_name_key($1)", ["smith and sons limited"])).rows).toHaveLength(1)
  })
})
