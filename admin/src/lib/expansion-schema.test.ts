import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import * as expansionSchema from "./expansion-schema"

describe("Expansion schema agrees with production forward migrations", () => {
  it("preserves every SQL column, financial type, check and foreign key in Drizzle metadata", async () => {
    const postgres = new PGlite()
    try {
      // Only prerequisites are fixtures; all Expansion DDL is executed unchanged.
      await postgres.exec(`
        create type admin_user_role as enum ('owner');
        create table admin_users(id uuid primary key);
        create table partner_applications(id integer primary key);
        create table prospects(id integer primary key);
        create table clients(id integer primary key);
        create table commercial_contracts(id integer primary key);
        create table commercial_payments(id integer primary key, reverses_payment_id integer);
        create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'immutable'; end $$;
      `)
      for (const name of ["0068_expansion_foundation.sql", "0069_expansion_finance.sql", "0070_expansion_cancellations.sql"]) await postgres.exec(readFileSync(`drizzle/${name}`, "utf8"))
      const columns = (await postgres.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>("select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name like 'expansion_%' order by table_name,column_name")).rows
      const constraints = (await postgres.query<{ table_name: string; conname: string; contype: string }>("select t.relname as table_name,c.conname,c.contype from pg_constraint c join pg_class t on t.oid=c.conrelid where t.relname like 'expansion_%' and c.contype in ('c','f')")).rows
      const tables = Object.values(expansionSchema).map(getTableConfig)
      expect(tables.map((table) => table.name).sort()).toEqual([...new Set(columns.map((column) => column.table_name))].sort())
      for (const table of tables) {
        const actual = columns.filter((column) => column.table_name === table.name).map((column) => ({ name: column.column_name, type: column.data_type, nullable: column.is_nullable === "YES" }))
        const declared = table.columns.map((column) => ({ name: column.name, type: column.getSQLType().replace(/^serial$/, "integer"), nullable: !column.notNull })).sort((a, b) => a.name.localeCompare(b.name))
        expect(declared, `${table.name} columns`).toEqual(actual)
        expect(table.checks.map((value) => value.name).sort(), `${table.name} checks`).toEqual(constraints.filter((value) => value.table_name === table.name && value.contype === "c").map((value) => value.conname).sort())
        expect(table.foreignKeys.map((value) => value.getName()).sort(), `${table.name} foreign keys`).toEqual(constraints.filter((value) => value.table_name === table.name && value.contype === "f").map((value) => value.conname).sort())
      }
    } finally { await postgres.close() }
  }, 30000)
})
