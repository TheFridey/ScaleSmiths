import "server-only";
import { MegatonError, cleanText } from "../megaton";
export interface RegistryCandidate {
  companyNumber: string;
  businessName: string;
  town: string;
  postcode: string;
  sourceUrl: string;
  locationKind: "registered_office";
}
export function registryCandidates(
  payload: unknown,
  town: string,
  sic?: string,
): RegistryCandidate[] {
  const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const items = (
    payload as {
      items?: {
        company_number?: string;
        company_name?: string;
        company_status?: string;
        sic_codes?: string[];
        registered_office_address?: {
          locality?: string;
          postal_code?: string;
          country?: string;
        };
      }[];
    }
  )?.items;
  if (!Array.isArray(items))
    throw new MegatonError("Discovery provider returned invalid data.", 503);
  return items.slice(0, 25).flatMap((item) => {
    if (
      !item ||
      item.company_status !== "active" ||
      (sic && !item.sic_codes?.includes(sic))
    )
      return [];
    const address = item.registered_office_address;
    if (
      !item.company_number ||
      !/^[A-Z0-9]{8}$/.test(item.company_number) ||
      !item.company_name ||
      !address?.locality ||
      normal(address.locality) !== normal(town)
    )
      return [];
    if (
      address.country &&
      ![
        "england",
        "wales",
        "scotland",
        "northern ireland",
        "united kingdom",
        "uk",
        "great britain",
      ].includes(normal(address.country))
    )
      return [];
    if (
      !address.country &&
      !/^(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i.test(
        address.postal_code || "",
      )
    )
      return [];
    return [
      {
        companyNumber: item.company_number,
        businessName: item.company_name.slice(0, 200),
        town: address.locality,
        postcode: address.postal_code || "",
        sourceUrl: `https://find-and-update.company-information.service.gov.uk/company/${item.company_number}`,
        locationKind: "registered_office" as const,
      },
    ];
  });
}
export async function discoverRegistry(townValue: unknown, sicValue: unknown) {
  const town = cleanText(townValue, "UK town", 100),
    sic = cleanText(sicValue, "SIC industry code", 5);
  if (!/^\d{5}$/.test(sic))
    throw new MegatonError(
      "Use a five-digit SIC code for the selected industry.",
    );
  const key = process.env.MEGATON_COMPANIES_HOUSE_API_KEY;
  if (
    !key ||
    process.env.MEGATON_DISCOVERY_ENABLED !== "true" ||
    process.env.MEGATON_EXTERNAL_ENABLED !== "true" ||
    process.env.MEGATON_STOP !== "false"
  )
    throw new MegatonError(
      "Registry discovery is not configured or enabled.",
      409,
    );
  const url = new URL(
    "https://api.company-information.service.gov.uk/advanced-search/companies",
  );
  url.search = new URLSearchParams({
    location: town,
    sic_codes: sic,
    company_status: "active",
    size: "25",
  }).toString();
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok)
    throw new MegatonError(
      "Registry discovery unavailable or rate limited. No results imported.",
      503,
    );
  return {
    candidates: registryCandidates(await response.json(), town, sic),
    limit: 25,
    source: "Companies House",
    note: "Registered office location only; verify trading presence, business website, contactability and source-use rights before importing. Sole traders are not covered.",
  };
}
