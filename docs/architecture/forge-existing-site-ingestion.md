# Forge existing-site ingestion

Forge can create a versioned content inventory for an approved prospective-client migration source through `POST /api/forge/projects/{projectId}/site-inventory`. The request accepts `startUrl`, bounded `maxPages` and `maxDepth`, an optional `allowedDomains` list, and `robotsPolicy` (`respect` by default). The authenticated caller must have `forge.execute`.

The `site_inventory` job runs the deterministic secure crawler and stores `Existing Site Content Inventory` through the normal append-only artifact boundary. Each artifact records the crawl policy, requested/final URLs, response status, redirects, extraction evidence, timestamps, failures, prompt/schema registry versions, hashes, actor, and task provenance. Inventories are unapproved and require human review because source material is prospective-client data, not an approved project fact.

## Security boundary

- Crawled HTML is untrusted evidence. Scripts and comments are stripped from visible content and no page script is executed. Embedded instructions never become agent instructions.
- Only credential-free HTTP and HTTPS URLs are accepted. The starting host and every redirect/link target must be in the explicit domain allowlist.
- DNS is resolved before each request. Any result containing private, loopback, link-local, carrier-grade NAT, benchmark, multicast, documentation IPv6, or otherwise non-public addresses is rejected. Redirects are revalidated at every hop. This reduces DNS-rebinding exposure; production egress filtering remains the strongest backstop because the standard Fetch API cannot pin a request to the validated address.
- Requests have redirect, timeout, page, depth, and response-size limits. Non-HTML pages are recorded as failures rather than parsed.
- Robots rules are fetched without executing code and applied to the Forge crawler or wildcard user-agent group. Operators may explicitly choose `ignore` only where they have authority to do so; the choice is recorded in provenance.
- The crawler does not send cookies, authorization headers, provider credentials, prompts, project facts, or client secrets.

## Inventory contents

For each accepted page Forge records title, meta description, headings, bounded main text, images and alt text, same-domain links, form action/method/field names, `mailto:`/`tel:`/address contact details, JSON-LD, canonical URL, redirects, status, content type, byte count, depth, and fetch time. Malformed JSON-LD is ignored rather than executed. Crawl failures remain visible in the artifact.

## Operational notes

The defaults are 25 pages, depth 2, 500 KB per response, four redirects, and ten seconds per request. Application controls should be paired with container/host egress rules that deny internal and cloud-metadata networks. Apply migration `0031_site_inventory.sql` before enabling the route.
