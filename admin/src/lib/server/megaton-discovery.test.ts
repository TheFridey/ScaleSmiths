import { describe, it, expect } from "vitest";
import { registryCandidates } from "./megaton-discovery";
describe("UK registry discovery location boundaries", () => {
  it("returns only exact selected-town candidates with explicit registered-office provenance", () => {
    const candidates = registryCandidates(
      {
        items: [
          {
            company_number: "01234567",
            company_status: "active",
            sic_codes: ["43220"],
            company_name: "Example Ltd",
            registered_office_address: {
              locality: "Hucknall",
              country: "England",
              postal_code: "NG15 1AA",
            },
          },
          {
            company_number: "01234568",
            company_status: "active",
            sic_codes: ["43220"],
            company_name: "Elsewhere",
            registered_office_address: {
              locality: "Nottingham",
              country: "England",
            },
          },
          {
            company_number: "01234569",
            company_status: "active",
            sic_codes: ["43220"],
            company_name: "Foreign",
            registered_office_address: { locality: "Hucknall", country: "USA" },
          },
          {
            company_number: "01234570",
            company_status: "active",
            sic_codes: ["43220"],
            company_name: "Unknown",
            registered_office_address: { postal_code: "NG15" },
          },
        ],
      },
      "Hucknall",
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].locationKind).toBe("registered_office");
    expect(candidates[0].sourceUrl).toContain("01234567");
  });
  it("does not invent businesses on a malformed response", () => {
    expect(() => registryCandidates({}, "Hucknall")).toThrow("invalid data");
  });
});
