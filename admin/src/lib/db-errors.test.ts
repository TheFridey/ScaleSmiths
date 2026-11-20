import { describe, expect, it } from "vitest"
import { safeDbMessage, translateDbError } from "./db-errors"
const pg = (code: string, message: string) => Object.assign(new Error("Failed query: select 1\nparams: 5"), { cause: { code, message } })
describe("safe database error translation", () => {
  it("never exposes constraint names, SQL, table names or ids", () => {
    const leaks = [
      pg("23505", 'duplicate key value violates unique constraint "expansion_referrals_application_id_key"'),
      pg("23503", 'insert or update on table "expansion_exclusivities" violates foreign key constraint "expansion_exclusivities_sector_id_fkey" Key (sector_id)=(11111111-1111-4111-8111-111111111111)'),
      pg("23514", 'new row for relation "expansion_markets" violates check constraint "expansion_markets_check"'),
      pg("23502", 'null value in column "label" of relation "expansion_sectors" violates not-null constraint'),
      pg("22P02", 'invalid input syntax for type uuid: "x"'),
    ]
    for (const error of leaks) {
      const t = translateDbError(error)!
      expect(t.message).not.toMatch(/expansion_|constraint|violates|relation|uuid|11111111|params|\bselect\b/i)
      expect([400, 409]).toContain(t.status)
    }
    expect(translateDbError(leaks[1])).toEqual({ status: 409, message: "A selected record does not exist or is still in use." })
  })
  it("passes through curated trigger sentences and replaces engine text without a code", () => {
    expect(translateDbError(pg("P0001", "A partner cannot refer themselves"))?.message).toBe("A partner cannot refer themselves")
    expect(translateDbError(new Error('duplicate key value violates unique constraint "x"'), "Not allowed.")?.message).toBe("Not allowed.")
    expect(safeDbMessage(new Error("A closed meeting request cannot change"), "x")).toBe("A closed meeting request cannot change")
    expect(translateDbError(new TypeError("Cannot read properties of undefined"))).toBeNull()
  })
})
