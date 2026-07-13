import {expect,it}from"vitest";import{assertSafeIntegrationDatabaseUrl}from"./test-database-safety"
it("accepts explicit local test databases",()=>expect(assertSafeIntegrationDatabaseUrl("postgresql://u:p@127.0.0.1:55432/scalesmiths_integration_test")).toContain("integration_test"))
it.each(["postgresql://u:p@localhost:5432/scalesmiths","postgresql://u:p@production.example.com/scalesmiths_test","https://localhost/test"])("rejects unsafe database URL %s",url=>expect(()=>assertSafeIntegrationDatabaseUrl(url)).toThrow())
