/**
 * Agent-discovery metadata for the public site.
 *
 * Everything published here must describe capabilities that genuinely exist. Advertising
 * an endpoint, auth scheme or payment rail the site does not implement is worse than
 * publishing nothing: an agent that trusts the metadata will fail in a way it cannot
 * diagnose, and it damages the site's standing as a source agents can rely on.
 */

export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/+$/, "") || "https://scalesmiths.co.uk"

export function absoluteUrl(pathname: string) {
  return `${SITE_ORIGIN}${pathname.startsWith("/") ? pathname : `/${pathname}`}`
}

/**
 * RFC 8288 Link header value for the homepage.
 *
 * Only registered IANA relation types are used, and every target is a resource this repo
 * actually serves.
 */
export const HOMEPAGE_LINK_HEADER = [
  `<${absoluteUrl("/.well-known/api-catalog")}>; rel="api-catalog"`,
  `<${absoluteUrl("/openapi.json")}>; rel="service-desc"; type="application/json"`,
  `<${absoluteUrl("/api/health")}>; rel="status"`,
  `<${absoluteUrl("/sitemap.xml")}>; rel="sitemap"; type="application/xml"`,
  `<${absoluteUrl("/llms.txt")}>; rel="describedby"; type="text/plain"`,
  `<${SITE_ORIGIN}/>; rel="canonical"`,
].join(", ")

/**
 * OpenAPI 3.1 description of the publicly callable surface.
 *
 * The admin and Forge applications are deliberately private and are not described here.
 */
export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "ScaleSmiths public API",
      version: "1.0.0",
      summary: "The publicly callable endpoints of the ScaleSmiths website.",
      description:
        "ScaleSmiths is a web design, web development and automation consultancy. This document covers only the public website endpoints. Administrative and Forge APIs are private, require authentication that is not publicly registrable, and are intentionally not described here.",
      contact: { name: "ScaleSmiths", url: SITE_ORIGIN },
      license: { name: "Proprietary", identifier: "LicenseRef-Proprietary" },
    },
    servers: [{ url: SITE_ORIGIN }],
    paths: {
      "/api/quote": {
        post: {
          operationId: "submitQuoteRequest",
          summary: "Submit an enquiry or quote request",
          description:
            "Submits a project enquiry. Rate limited per client address and email address. No authentication is required and no payment is required.",
          tags: ["Enquiries"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuoteRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "The enquiry was accepted.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { ok: { type: "boolean", const: true } },
                    required: ["ok"],
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "413": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/health": {
        get: {
          operationId: "getHealth",
          summary: "Service health",
          description: "Reports service liveness and the deployed release. Never cached.",
          tags: ["Operations"],
          responses: {
            "200": {
              description: "The service is reachable.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", examples: ["ok"] },
                      service: { type: "string", examples: ["scalesmiths-web"] },
                      environment: { type: "string" },
                      release: { type: "string" },
                    },
                    required: ["status", "service"],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        QuoteRequest: {
          type: "object",
          description: "A project enquiry. Only name, email and a brief are required.",
          properties: {
            name: { type: "string", description: "Contact name." },
            email: { type: "string", format: "email", description: "Contact email address." },
            brief: { type: "string", description: "What the project needs to achieve." },
            biz: { type: "string", description: "Business or organisation name." },
            phone: { type: "string", description: "Optional contact telephone number." },
            websiteUrl: { type: "string", format: "uri", description: "Existing website, if any." },
            businessType: { type: "string" },
            budget: { type: "string", description: "Indicative budget range." },
            timeframe: { type: "string", description: "Desired delivery timeframe." },
            goal: { type: "string", description: "Primary commercial outcome sought." },
            preferredContactMethod: { type: "string", enum: ["email", "phone"] },
          },
          required: ["name", "email", "brief"],
          additionalProperties: true,
        },
        Error: {
          type: "object",
          properties: { error: { type: "string", description: "A safe, non-internal message." } },
          required: ["error"],
        },
      },
      responses: {
        Error: {
          description: "The request was rejected. The message is safe to show to a user.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  } as const
}

/**
 * RFC 9727 API catalog as an RFC 9264 linkset.
 */
export function buildApiCatalog() {
  return {
    linkset: [
      {
        anchor: absoluteUrl("/api"),
        "service-desc": [{ href: absoluteUrl("/openapi.json"), type: "application/json" }],
        "service-doc": [{ href: absoluteUrl("/llms.txt"), type: "text/plain" }],
        status: [{ href: absoluteUrl("/api/health"), type: "application/json" }],
        author: [{ href: SITE_ORIGIN }],
      },
    ],
  }
}
