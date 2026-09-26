import type { Insight, InsightBlock, InsightCategory } from "./insights"

function buildEnterpriseArticle(input: {
  slug: string
  title: string
  seoTitle?: string
  description: string
  answer: string
  priority: number
  author?: "rhys" | "trevor-newton-bradley"
  featured?: boolean
  services: string[]
  work?: string[]
  related: string[]
  blocks: InsightBlock[]
}): Insight {
  const body: InsightBlock[] = [{ type: "paragraph", text: input.answer }, ...input.blocks]
  const outline = body.filter((b): b is Extract<InsightBlock, { type: "heading" }> => b.type === "heading").map((b) => b.text)
  return {
    slug: input.slug,
    title: input.title,
    seoTitle: input.seoTitle,
    description: input.description,
    status: "published",
    authorSlug: input.author ?? "rhys",
    category: "enterprise" satisfies InsightCategory,
    datePublished: "2026-09-26",
    dateModified: "2026-09-26",
    body,
    brief: {
      targetQuery: input.title,
      searchIntent: input.description,
      angle: input.answer,
      outline,
      firstHandEvidence: ["ScaleSmiths enterprise delivery practice and founder-led engineering engagements"],
      priority: input.priority,
    },
    relatedServices: input.services,
    relatedCaseStudies: input.work ?? [],
    relatedInsights: input.related,
    featured: input.featured,
  }
}

export const enterpriseInsights: Insight[] = [
  buildEnterpriseArticle({
    slug: "when-two-saas-platforms-should-become-one-bespoke-system",
    title: "When Two SaaS Platforms Should Become One Bespoke System",
    seoTitle: "When Two SaaS Tools Should Become One Bespoke System",
    description: "How to decide when consolidating two SaaS platforms into one bespoke system reduces risk, cost and operational friction — and when it does not.",
    answer:
      "Two SaaS platforms should become one bespoke system when the shared workflow is the product of the business, not a side process you can afford to keep fragmented. The signal is structural: the same entities are duplicated, hand-offs create delay or error, permissions cannot be expressed across both products, and integrations become a permanent tax rather than a bridge. Consolidation is not a reflex against licence fees. It is justified when a single domain model, one permission boundary and one operational surface remove more risk than they introduce. ScaleSmiths treats that decision as architecture work inside [enterprise](/enterprise) delivery — not as a shopping exercise for another vendor feature list.",
    priority: 26,
    author: "rhys",
    services: ["/enterprise", "/custom-systems", "/pricing"],
    work: ["the-business-circle", "veteranfinder"],
    related: [
      "when-custom-software-costs-less-than-saas-sprawl",
      "when-does-a-business-need-custom-software",
      "replace-fragmented-internal-software-without-breaking-operations",
      "enterprise-software-modular-monolith",
    ],
    blocks: [
      {
        type: "heading",
        text: "The real problem is usually the seam, not the brand names",
      },
      {
        type: "paragraph",
        text: "Teams rarely complain about two products in the abstract. They complain that a booking lives in one system, fulfilment in another, and finance in a third — while the customer experience still depends on all three agreeing. Staff become the integration layer: they copy reference numbers, reconcile statuses and invent spreadsheet ledgers that nobody owns. That seam has a cost that does not appear on either vendor invoice. It appears as delayed decisions, inconsistent reporting and permission models that cannot answer who can change what across the full lifecycle. Before arguing for a build, map the seam: which entities cross the boundary, which events must be reliable, and which exceptions currently only humans can resolve.",
      },
      {
        type: "paragraph",
        text: "A useful consolidation brief starts with the operational object that must remain coherent — an order, a case, a shipment, a member journey — and asks whether two products can ever share a single source of truth for that object. If each vendor insists on owning identity, status and history, you will keep paying the seam forever. If one product is already the de facto source of truth and the other is a viewport, integration may be enough. The bespoke path becomes interesting when neither product can host the real process without continuous compromise.",
      },
      {
        type: "heading",
        text: "Signals that favour consolidation into one system",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "The same business entity is authored in both systems and neither can be demoted to a read-only consumer.",
          "Cross-system workflows require dual updates that fail partially and leave irreversible inconsistency.",
          "Role and site permissions cannot be expressed without parallel admin models and conflicting joiners/leavers.",
          "Reporting requires nightly reconciliation to invent a single operational picture.",
          "Vendor roadmaps diverge from the workflow that differentiates the business.",
          "Offline, multi-site or audit requirements cannot be met by either product without insecure workarounds.",
        ],
      },
      {
        type: "paragraph",
        text: "These signals are cumulative. One awkward integration is normal. A permanent dual-write with no compensating transaction model is a product smell. When the organisation’s competitive behaviour lives in that dual-write — for example custom allocation rules, regulated evidence, or multi-tenant partner workflows — buying another connector rarely removes the risk. It packages the risk differently.",
      },
      {
        type: "heading",
        text: "When you should keep two products and integrate deliberately",
      },
      {
        type: "paragraph",
        text: "Consolidation is the wrong answer when each product owns a bounded domain that is genuinely best-of-breed and the shared surface is narrow. A CRM that manages pipeline and a specialised warehouse system that manages bin locations may share only a customer identifier and a handful of status events. In that case the architecture should make the event contract explicit, idempotent and observable rather than merge the products into a mediocre hybrid. Integration still needs ownership: schema contracts, retry policy, dead-letter handling, and a clear statement of which system is authoritative for each field.",
      },
      {
        type: "paragraph",
        text: "Keep two systems when licence economics remain favourable, when vendor security posture is a material advantage you cannot replicate quickly, and when the organisation lacks appetite to own a platform. Owning software is not free. It requires environments, migration discipline, monitoring and a change process. ScaleSmiths will often recommend a tighter integration and a thinner custom layer when the seam is small and the operational risk of a rebuild outweighs the friction of staying separate.",
      },
      {
        type: "heading",
        text: "A consolidation architecture that does not recreate sprawl",
      },
      {
        type: "paragraph",
        text: "If you do consolidate, avoid rebuilding both products feature-for-feature. Extract the shared domain model first: entities, invariants, state machines and permission boundaries. Surround that core with adapters for anything that must remain external — payments, identity providers, document stores, legacy reporting. Prefer a [modular monolith](/insights/enterprise-software-modular-monolith) with clear module boundaries over a premature microservice estate. Premature distribution recreates the same seam problem inside your own network.",
      },
      {
        type: "code",
        language: "text",
        code: `  [Staff / Partners]
          |
     Identity (SSO)
          |
  +-------v--------+
  |  Operational   |  <-- single domain model
  |  Core System   |      (orders, cases, stock…)
  +--+----------+--+
     |          |
  Adapter A  Adapter B
  (finance)  (messaging)
     |          |
  External   External`,
      },
      {
        type: "paragraph",
        text: "That shape keeps authority in one place while allowing selective coexistence during migration. Adapters can temporarily bridge residual SaaS usage until cutover is complete. The anti-pattern is a “hub” that only forwards messages while both SaaS products remain dual writers. That is sprawl with an expensive middle box.",
      },
      {
        type: "heading",
        text: "Commercial and operational trade-offs to price honestly",
      },
      {
        type: "paragraph",
        text: "Compare total cost of ownership across a three-to-five-year horizon: licences, integration maintenance, reconciliation labour, incident cost, and the opportunity cost of blocked workflows. A bespoke system can cost less than sprawl when the organisation already funds several full-time workarounds. It can also cost more if the brief is a soft wishlist. Discovery should produce a cut line: what must exist in release one, what can remain integrated, and what is retired. See [when custom software costs less than SaaS sprawl](/insights/when-custom-software-costs-less-than-saas-sprawl) for the economic framing.",
      },
      {
        type: "paragraph",
        text: "Also price migration risk. Dual-running periods, data cleansing and staff retraining are part of the project, not optional extras. [Enterprise delivery](/enterprise/delivery) should make those phases visible. If stakeholders will not fund a controlled cutover, they are not ready to consolidate — they are ready to buy another tool and hope.",
      },
      {
        type: "heading",
        text: "Permissions, audit and multi-site constraints",
      },
      {
        type: "paragraph",
        text: "Two SaaS products often fail quietly on identity. Staff hold conflicting roles; partners need limited visibility; site managers must see only their estate. A consolidated system can model those rules once, but only if permission design is treated as a first-class deliverable. Pair that with immutable audit events for privileged actions. If the business needs evidence of who changed a status, overridden a credit limit or exported a dataset, those events belong in the core, not in a vendor’s opaque activity log you cannot query. Read [RBAC vs ABAC](/insights/rbac-vs-abac-permission-models) and [audit trails for operational software](/insights/designing-audit-trails-operational-software) before locking the domain model.",
      },
      {
        type: "callout",
        title: "Consolidation test",
        text: "If removing either SaaS product would still leave the critical workflow intact inside the remaining product, integrate. If neither product can own the workflow without permanent dual-writes and human reconciliation, design one system around that workflow and demote the rest to adapters.",
      },
      {
        type: "heading",
        text: "How ScaleSmiths frames the decision in discovery",
      },
      {
        type: "paragraph",
        text: "In [enterprise discovery](/enterprise/contact) we inventory systems, entities, integrations and failure modes before recommending a build. We look at who owns data quality today, which reports leadership trusts, and where staff invent private tooling. The output is not a slogan about “digital transformation”. It is a proposed domain boundary, a migration stance, a security posture and a release that proves the consolidation thesis on one complete operational path. Public [work](/work) and [insights](/insights) show how we think about custom systems; the enterprise path is for organisations that need founder-led engineering rather than another middleware subscription.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Is consolidation always cheaper than paying two licences?",
      },
      {
        type: "paragraph",
        text: "No. Licence cost is often the smallest line. Consolidation is cheaper when reconciliation labour, incident risk and blocked process change dominate — and when the organisation will own the resulting platform. If those costs are low, keep the products and invest in a clean integration contract.",
      },
      {
        type: "subheading",
        text: "Can we keep one SaaS product as a front-end and build a custom back office?",
      },
      {
        type: "paragraph",
        text: "Sometimes. That hybrid works when the SaaS surface is a genuine customer channel and the custom system becomes the authoritative operational core. It fails when both sides continue to write the same fields. Decide authority per field before building the bridge.",
      },
      {
        type: "subheading",
        text: "How long should dual-running last?",
      },
      {
        type: "paragraph",
        text: "As short as operational safety allows, with explicit exit criteria: data parity checks, staff competence thresholds and a freeze on new features in the departing system. Open-ended dual-running is how organisations pay for three systems forever.",
      },
      {
        type: "subheading",
        text: "What if vendors promise a roadmap that will fix the seam?",
      },
      {
        type: "paragraph",
        text: "Treat roadmap promises as untrusted. Ask for contractual timelines, inspect whether the proposed feature model matches your invariants, and price the wait against the cost of continuing dual-writes. A roadmap is not an architecture.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "replace-fragmented-internal-software-without-breaking-operations",
    title: "How to Replace Fragmented Internal Software Without Breaking Operations",
    seoTitle: "Replace Fragmented Internal Software Safely",
    description: "A practical approach to replacing fragmented internal tools with a coherent platform while keeping day-to-day operations running.",
    answer:
      "Replacing fragmented internal software without breaking operations means treating cutover as an engineered sequence, not a big-bang weekend. Inventory the real workflows — including the spreadsheets and side channels people actually use — then replace one coherent operational slice at a time behind stable interfaces. Keep the old path available until parity and staff competence are proven. The goal is continuity of business outcomes, not a dramatic switch-off ceremony. ScaleSmiths plans this as part of [enterprise delivery](/enterprise/delivery): discovery, strangler migration, dual-run controls and a rollback stance that operations can trust.",
    priority: 27,
    author: "trevor-newton-bradley",
    services: ["/enterprise", "/enterprise/delivery", "/custom-systems"],
    work: ["prymal", "pinkys-prints"],
    related: [
      "how-to-plan-legacy-system-migration",
      "when-two-saas-platforms-should-become-one-bespoke-system",
      "what-enterprise-software-discovery-should-produce",
      "when-does-a-business-need-custom-software",
    ],
    blocks: [
      {
        type: "heading",
        text: "Fragmentation is a dependency graph, not a list of apps",
      },
      {
        type: "paragraph",
        text: "Internal estates grow organically: an Access database for one team, a SaaS board for another, a shared drive for documents, a mail-merge for customer updates. On paper it looks like a short list of tools. In practice it is a dependency graph of data flows, tribal knowledge and exception paths. Replacing “the CRM” without understanding which reports finance regenerates every Friday will break trust even if the new UI looks polished. Start by observing work, not by interviewing for wishlist features. Shadow a complete cycle — intake, fulfilment, exception, close — and record every system touch, including the unofficial ones.",
      },
      {
        type: "paragraph",
        text: "Name the authoritative store for each critical field today, even if that store is a spreadsheet. Ambiguity here is the primary cause of migration incidents. If two teams disagree about where “true stock” lives, the replacement project inherits a political problem dressed as a technical one. Resolve ownership in discovery, or the new platform will simply centralise the argument.",
      },
      {
        type: "heading",
        text: "Choose a strangler sequence over a rewrite fantasy",
      },
      {
        type: "paragraph",
        text: "A full rewrite that waits until every edge case is modelled will either never ship or will ship late with untested assumptions. Prefer a strangler pattern: identify a bounded workflow with clear entry and exit events, build that path in the new system, route traffic to it, and leave adjacent processes on legacy until the next slice. Each slice must be independently valuable and independently reversible. That discipline is how you replace fragmentation without freezing the business for a year.",
      },
      {
        type: "code",
        language: "text",
        code: ` Legacy estate                 New platform
 +-----------+                +-----------+
 | Intake A  |--strangle----->| Intake A' |
 | Fulfil B  |                | (later)   |
 | Report C  |<--read bridge--| Read model|
 +-----------+                +-----------+
        ^                            |
        +------ dual-run checks -----+`,
      },
      {
        type: "paragraph",
        text: "The read bridge matters. Leadership often needs continuity of reporting before writers fully move. Expose a controlled read model from the new system or keep generating legacy reports from a synchronised store until parity is accepted. Do not ask operations to run two incompatible management pictures for months without a reconciliation method.",
      },
      {
        type: "heading",
        text: "Protect the operating day with dual-run rules",
      },
      {
        type: "list",
        items: [
          "Define which actions must succeed in both systems during dual-run, and which are new-system only.",
          "Automate parity checks on key entities (counts, status histograms, financial totals) with thresholds and owners.",
          "Freeze non-critical changes in the legacy path once a slice is in dual-run.",
          "Give staff a single “source of action” per task so they are not guessing which UI to use.",
          "Rehearse rollback: disabling the new route must restore a known-good path within an agreed window.",
          "Capture every manual workaround used during dual-run; those are either defects or missing requirements.",
        ],
      },
      {
        type: "paragraph",
        text: "Dual-run is expensive. That is intentional. It buys evidence. Organisations that skip it usually pay later in emergency war rooms. Time-box dual-run with exit criteria tied to measured parity and user competence, not calendar optimism. For deeper migration planning see [how to plan a legacy system migration](/insights/how-to-plan-legacy-system-migration).",
      },
      {
        type: "heading",
        text: "Replace interfaces before you replace people habits",
      },
      {
        type: "paragraph",
        text: "Staff will keep unofficial tools if the new interface is slower for their real tasks. Design for the exception path, not only the happy path. Warehouse overrides, credit exceptions and partial shipments are where fragmented estates hide their true complexity. If the new system forces a manager to email IT for every override, the spreadsheet will return by lunchtime. Involve the people who currently hold tribal process knowledge as design partners, not as late-stage trainers.",
      },
      {
        type: "paragraph",
        text: "Training is not a slide deck. It is supervised real work with a support channel and a visible backlog for friction. Measure task completion time and error rates on the new path. A migration that “launched” but quietly pushed volume back to legacy has not replaced anything — it has added a museum exhibit.",
      },
      {
        type: "heading",
        text: "Data migration is a product, not a weekend script",
      },
      {
        type: "paragraph",
        text: "Treat historical data as graded: must-move for live operations, should-move for recent history, archive-in-place for deep history. Cleanse at the source where possible; transforming garbage into a new schema only creates confident garbage. Build idempotent import jobs, retain lineage (where each record came from), and keep an immutable import report. For regulated or financially sensitive estates, pair imports with [audit trail](/insights/designing-audit-trails-operational-software) design so post-cutover investigations remain possible.",
      },
      {
        type: "callout",
        title: "Continuity over ceremony",
        text: "Judge migration success by whether the business can fulfil, invoice and support customers throughout the change. A dramatic cutover date is vanity if operations spent the week repairing trust.",
      },
      {
        type: "heading",
        text: "Security and access during transition",
      },
      {
        type: "paragraph",
        text: "Fragmented estates often have oversharing: shared passwords, broad folder access, dormant accounts. Replacement is a chance to introduce SSO, least privilege and joiner/leaver automation — but do not wait for perfection before the first slice ships. Apply a minimum security bar immediately: unique identities, MFA for privileged roles, environment separation, and secrets out of source control. Align with the posture described in [Security & Trust](/security) and the engineering approach in [security in bespoke software projects](/insights/security-in-bespoke-software-projects).",
      },
      {
        type: "heading",
        text: "What discovery must produce before build starts",
      },
      {
        type: "paragraph",
        text: "Before writing migration code, [enterprise discovery](/enterprise/contact) should produce a system inventory, a workflow map, a strangler sequence, data grades, dual-run rules and a rollback plan. It should also name the operational owner for each slice. Without that owner, engineering will be asked to invent policy under pressure. More on artefacts in [what enterprise software discovery should produce](/insights/what-enterprise-software-discovery-should-produce). Explore related [insights](/insights) and [work](/work) for how we structure these programmes.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Can we switch everything off on one weekend?",
      },
      {
        type: "paragraph",
        text: "Only for very small estates with low exception volume and complete rehearsal evidence. Most fragmented internal landscapes fail under big-bang cutover because unknown dependencies surface only under live load. Prefer sequenced stranglers.",
      },
      {
        type: "subheading",
        text: "What if teams refuse to stop using spreadsheets?",
      },
      {
        type: "paragraph",
        text: "Treat that as requirements feedback. Either the new path is missing a necessary override, reporting or speed characteristic, or incentives still reward the private ledger. Fix the product and the operating rules together.",
      },
      {
        type: "subheading",
        text: "How do we keep integrations alive while systems change?",
      },
      {
        type: "paragraph",
        text: "Introduce anti-corruption adapters and stable event contracts early. External partners should not need to know which internal store is being strangled this month. Version those contracts and monitor lag and failure rates.",
      },
      {
        type: "subheading",
        text: "When is freeze the right call?",
      },
      {
        type: "paragraph",
        text: "Freeze non-essential changes on a legacy slice once dual-run begins. Without a freeze, you chase a moving target and parity checks become theatre. Emergency fixes still need a controlled path — just not an open feature pipeline.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "what-enterprise-software-discovery-should-produce",
    title: "What Enterprise Software Discovery Should Actually Produce",
    seoTitle: "What Enterprise Software Discovery Should Produce",
    description: "The artefacts enterprise discovery should leave behind: domain boundaries, risk register, migration stance, security posture and a proving release.",
    answer:
      "Enterprise software discovery should produce decision-grade artefacts, not a slide deck of aspirations. At minimum it should define the problem boundary, the domain model sketch, integration and data risks, a security and permission posture, a migration stance, and a first release that can prove or falsify the investment thesis. Soft workshops that end in “we will be agile” are not discovery — they are deferred design. ScaleSmiths runs [enterprise discovery](/enterprise/contact) to make those artefacts explicit before build budget is committed.",
    priority: 28,
    author: "rhys",
    featured: true,
    services: ["/enterprise", "/enterprise/delivery", "/pricing"],
    work: [],
    related: [
      "how-to-plan-legacy-system-migration",
      "security-in-bespoke-software-projects",
      "when-does-a-business-need-custom-software",
      "replace-fragmented-internal-software-without-breaking-operations",
    ],
    blocks: [
      {
        type: "heading",
        text: "Discovery is risk reduction with a paper trail",
      },
      {
        type: "paragraph",
        text: "In enterprise work, the expensive mistakes are rarely the choice of framework. They are misunderstood ownership, underestimated integrations, optimistic data quality and permission models invented two weeks before launch. Discovery exists to surface those risks while changing course is still cheap. That means interviewing operators, inspecting real data samples, tracing failure modes and writing down assumptions that the commercial proposal will inherit. If an assumption cannot be tested cheaply now, it must be named as a residual risk with an owner.",
      },
      {
        type: "paragraph",
        text: "The output should be usable by engineering, security, operations and the budget holder without reinterpretation. Vague journey maps that omit exception paths will not survive contact with a warehouse override or a multi-site permission conflict. Prefer precise artefacts over beautiful workshops.",
      },
      {
        type: "heading",
        text: "Artefacts that should exist before build funding",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Problem statement and non-goals: what success means and what is explicitly out of scope for release one.",
          "Domain sketch: core entities, state machines, invariants and the authoritative source for each critical field.",
          "System inventory: current tools, owners, licences, integration methods and known failure modes.",
          "Data quality sample: volumes, null rates, duplicate keys and cleansing effort grades.",
          "Security posture: identity approach, environments, secrets, audit expectations and data classification.",
          "Migration stance: strangler sequence, dual-run rules, rollback and freeze policy.",
          "Release one definition: one complete operational path with acceptance checks and operational ownership.",
          "Commercial envelope: rough build and run costs, decision gates and what would stop the project.",
        ],
      },
      {
        type: "paragraph",
        text: "Not every engagement needs forty documents. It does need these decisions captured somewhere durable. A thin discovery that skips data sampling will underestimate migration. A discovery that skips permission design will underestimate build. See [Security & Trust](/security) for the baseline posture we discuss early, and [enterprise delivery](/enterprise/delivery) for how artefacts feed the programme plan.",
      },
      {
        type: "heading",
        text: "Domain boundaries beat feature lists",
      },
      {
        type: "paragraph",
        text: "Stakeholders often arrive with feature inventories copied from incumbent tools. Discovery should translate those into domain behaviour: what must be true for an order to ship, a case to close, a stock movement to be trusted. Feature lists without invariants create endless scope. Invariants create a testable core. This is also where build-versus-buy becomes honest — if the invariants are generic, a product may fit; if they are distinctive and cross-cutting, a [custom system](/custom-systems) may be justified. Cross-check with [when a business needs custom software](/insights/when-does-a-business-need-custom-software).",
      },
      {
        type: "paragraph",
        text: "Write the state machines for the two or three objects that generate the most operational pain. Include failure and compensation states, not only happy paths. If nobody can agree whether a partially fulfilled order is still “open”, software will encode a coin flip. Discovery is the moment to force that agreement onto paper with examples from last month’s exceptions. Those examples become acceptance fixtures later; without them, UAT becomes opinion theatre.",
      },
      {
        type: "paragraph",
        text: "Non-goals deserve equal ink. Explicitly exclude reporting packs, mobile offline, partner portals or AI features that stakeholders casually mention if they are not funded for release one. A discovery pack that refuses to say “not now” will be read as an unbounded commitment. Budget holders should initial the non-goals list for the same reason engineers initial the domain sketch.",
      },
      {
        type: "code",
        language: "text",
        code: ` Discovery outputs
 -----------------
 [Problem / Non-goals]
          |
 [Domain sketch]----[Permission model]
          |
 [Integrations]-----[Data grades]
          |
 [Migration stance]
          |
 [Release one path]--> go / no-go gate`,
      },
      {
        type: "heading",
        text: "Integrations and data must be inspected, not assumed",
      },
      {
        type: "paragraph",
        text: "Ask for sample payloads, authentication methods, rate limits, and who owns the counterparty relationship. File drops that “usually work” need retry and reconciliation design. APIs that omit idempotency keys need compensating controls. Historical data needs grading: live-operational, recent-history, archive. Without samples, estimates are fiction. Discovery should include at least one uncomfortable export review where duplicates and silent nulls become visible to the budget holder.",
      },
      {
        type: "paragraph",
        text: "Record the operational cost of each integration today: who notices when it fails, how long until someone notices, and what customers experience in the meantime. Those facts calibrate monitoring requirements for the new estate. An integration that fails silently every fortnight is not “fine” — it is an unfunded incident process. Discovery should price the monitoring and on-call expectation alongside the connector itself.",
      },
      {
        type: "paragraph",
        text: "When multiple systems claim the same customer or stock record, pick an authority matrix field by field. “Both systems are sources of truth” is not a matrix; it is a future war room. Publish the matrix in the discovery pack and treat later requests to dual-write a field as scope changes with explicit risk acceptance.",
      },
      {
        type: "heading",
        text: "Security and permissions belong in the brief",
      },
      {
        type: "paragraph",
        text: "Identity is not an afterthought theme. Decide whether SSO is required, which roles exist, whether attributes like site or partner scope constrain access, and which actions need auditable evidence. Those choices change schema and API shape. Leaving them to “phase two” usually means rebuilding phase one. Pair discovery with the thinking in [RBAC vs ABAC](/insights/rbac-vs-abac-permission-models) and [how we approach security](/insights/security-in-bespoke-software-projects).",
      },
      {
        type: "paragraph",
        text: "Classify data early enough that hosting and logging choices can respect it. Operational platforms often mix personal data, commercial pricing and safety-critical events in the same screens. If discovery only says “secure by design”, engineers will guess. Prefer a short classification table and a statement of where production data may never appear. That table also informs [Security & Trust](/security) conversations with the client’s own security stakeholders.",
      },
      {
        type: "callout",
        title: "A useful discovery test",
        text: "If a new engineer can read the discovery pack and explain what not to build, which system is authoritative for stock or cases, and how rollback works, discovery succeeded. If they only learn that the client wants a modern portal, it failed.",
      },
      {
        type: "heading",
        text: "Commercial gates and the proving release",
      },
      {
        type: "paragraph",
        text: "Discovery should produce a go/no-go gate: continue into build, pause for data remediation, or stop because a product fit emerged. The proving release should exercise a complete path — create, permissioned action, exception, audit, report — not a clickable shell. That release is evidence for further investment. Pricing conversations on [/pricing](/pricing) stay honest when the envelope is tied to these artefacts rather than a vague day-rate fantasy.",
      },
      {
        type: "paragraph",
        text: "Define kill criteria before optimism sets in: data quality below a threshold, inability to staff an operational owner, or a vendor roadmap that genuinely removes the seam within an acceptable window. Kill criteria protect both sides from sunk-cost theatre. They also keep [enterprise delivery](/enterprise/delivery) honest when later stakeholders try to expand release one into a platform fantasy.",
      },
      {
        type: "heading",
        text: "How ScaleSmiths runs founder-led discovery",
      },
      {
        type: "paragraph",
        text: "We keep discovery founder-led for enterprise work so architecture and commercial risk are not separated. Sessions include operators and decision owners. We write non-goals as carefully as goals. We refuse to invent confidential case studies or claim certifications the organisation does not hold. The [enterprise](/enterprise) page explains the engagement shape; [insights](/insights) and [work](/work) show adjacent thinking. Start with [enterprise discovery](/enterprise/contact) when you need artefacts, not theatre.",
      },
      {
        type: "paragraph",
        text: "Founder-led does not mean unstructured. We time-box workshops, demand sample exports between sessions, and leave each meeting with open decisions named against owners and dates. Between workshops we inspect systems rather than facilitate more sticky notes. The pack that emerges should be boringly specific: diagrams, matrices, graded lists and a release definition a sceptical operations lead can stress-test.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "How long should discovery take?",
      },
      {
        type: "paragraph",
        text: "Long enough to inspect real workflows and data samples; short enough that artefacts remain current. For many mid-market estates that is measured in weeks of focused work, not months of workshops without outputs. Complexity, site count and integration opacity extend it.",
      },
      {
        type: "subheading",
        text: "Do we need a full specification before coding?",
      },
      {
        type: "paragraph",
        text: "You need decision-grade clarity on boundaries, invariants, security and migration — not a waterfall novel. Detail can deepen inside the proving release once the core model is stable.",
      },
      {
        type: "subheading",
        text: "What if stakeholders disagree during discovery?",
      },
      {
        type: "paragraph",
        text: "Surface the disagreement as a named decision with options and consequences. Software cannot reconcile unspoken conflict. Escalate to the operational owner before build encodes the wrong policy.",
      },
      {
        type: "subheading",
        text: "Can discovery conclude that we should not build?",
      },
      {
        type: "paragraph",
        text: "Yes. A successful discovery can recommend configuring an existing product, integrating two systems, or remediating data before any build. Stopping early is a return on the discovery investment.",
      },
      {
        type: "subheading",
        text: "Who should attend?",
      },
      {
        type: "paragraph",
        text: "People who do the work, people who own exceptions, people who own budget and security, and someone who can decide non-goals. Absence of any of those roles usually produces incomplete artefacts.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "rbac-vs-abac-permission-models",
    title: "RBAC vs ABAC: Choosing the Right Permission Model",
    seoTitle: "RBAC vs ABAC for Operational Software",
    description: "A practical comparison of RBAC and ABAC for operational software, including hybrid models, audit implications and implementation trade-offs.",
    answer:
      "Choose RBAC when stable job functions map cleanly to permissions and the organisation can manage role explosion carefully. Choose ABAC when access depends on dynamic attributes — site, tenant, shift, document classification, relationship to a case — that roles alone cannot express without combinatorial chaos. Most serious operational platforms need a hybrid: roles for coarse capability, attributes for scope. The wrong model either blocks work or silently overshares. Permission design belongs in [enterprise](/enterprise) discovery beside the domain model, not as a UI afterthought.",
    priority: 29,
    author: "rhys",
    services: ["/enterprise", "/security", "/custom-systems"],
    work: ["veteranfinder"],
    related: [
      "designing-audit-trails-operational-software",
      "security-in-bespoke-software-projects",
      "when-does-a-business-need-custom-software",
      "enterprise-software-modular-monolith",
    ],
    blocks: [
      {
        type: "heading",
        text: "What RBAC actually buys you",
      },
      {
        type: "paragraph",
        text: "Role-based access control assigns permissions to roles, and roles to users. It is understandable for operators: Warehouse Operative, Site Manager, Finance Approver. Auditors can ask who holds a role. Provisioning can hook joiner/leaver flows to role membership. RBAC works well when job functions are relatively stable and the permission set for a role does not need to vary by every possible contextual dimension. It fails when you invent a new role for every combination of site, partner and clearance — that is role explosion disguised as governance.",
      },
      {
        type: "paragraph",
        text: "Implement RBAC in the service layer, not only in the navigation menu. Hiding a button is not authorisation. Every API and job that mutates state must enforce the same checks. Centralise policy evaluation so UI, API and background workers cannot drift.",
      },
      {
        type: "heading",
        text: "What ABAC actually buys you",
      },
      {
        type: "paragraph",
        text: "Attribute-based access control evaluates policies against attributes of the subject, resource, action and environment. Examples: a user may update a shipment if their siteId matches the shipment’s siteId and the shipment status is not locked; a partner user may read cases where partnerId equals their organisation. ABAC expresses scope naturally. The cost is policy complexity, harder mental models for administrators, and a stronger need for testing and observability of deny/allow decisions.",
      },
      {
        type: "paragraph",
        text: "ABAC without disciplined attribute ownership becomes unpredictable. Attributes must come from trusted sources — identity provider claims, verified resource fields — not from client-supplied request bodies that a user can forge. Treat attribute integrity as part of [Security & Trust](/security).",
      },
      {
        type: "paragraph",
        text: "Environment attributes matter more than teams expect: time windows for privileged exports, network location for admin consoles, or device posture for field apps. Use them sparingly and document them. An environment rule that nobody can explain will be disabled during an incident and never re-enabled correctly. Prefer a small catalogue of environment checks with owners over an open playground of boolean expressions.",
      },
      {
        type: "heading",
        text: "A decision framework for operational software",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "List the sensitive actions (approve, export, override, delete, unlock) rather than every screen.",
          "For each action, ask whether the allow rule depends only on job function or also on resource/environment attributes.",
          "If more than a few contextual dimensions appear, prefer attributes for scope and keep roles coarse.",
          "Cap the number of roles humans must understand; push combinatorial constraints into attributes.",
          "Require deny-by-default and explicit grants; never infer permission from UI reachability.",
          "Decide how break-glass access works, who authorises it, and how it is audited.",
        ],
      },
      {
        type: "paragraph",
        text: "Run the framework on the ten most dangerous actions first. If those ten need attributes, your platform needs ABAC scope even if ninety bland screens would have been fine with roles alone. Security spend should follow blast radius. A misconfigured “view dashboard” role is annoying; a misconfigured “export customer file” capability is an incident.",
      },
      {
        type: "heading",
        text: "Hybrid models that stay maintainable",
      },
      {
        type: "paragraph",
        text: "A common healthy pattern: roles grant capabilities (canApproveCredit, canManageUsers), while attributes constrain resource scope (site, tenant, brand, region). Policies become readable: capability AND scope. This hybrid maps well to modular monoliths where each module declares required capabilities and the platform enforces scope filters in queries. Avoid encoding site lists inside role names. Avoid burying capability checks only in frontend route guards.",
      },
      {
        type: "paragraph",
        text: "Administrators need operable tooling: assign roles, attach site memberships, preview effective access for a user, and simulate a sensitive action against a sample resource. Without preview, support tickets become the policy debugger. Effective-access views also help joiner/leaver audits — you can show what a leaver could touch yesterday and prove revocation today.",
      },
      {
        type: "code",
        language: "text",
        code: ` Subject                Resource              Decision
 +----------------+     +----------------+    +--------+
 | role: Manager  |     | type: Shipment |    | ALLOW  |
 | sites: [A,B]   | --> | site: A        | -> | or     |
 | mfa: true      |     | status: OPEN   |    | DENY   |
 +----------------+     +----------------+    +--------+
 Policy: role has ship.manage AND subject.sites contains resource.site
         AND resource.status in editableStates AND mfa if privileged`,
      },
      {
        type: "heading",
        text: "Multi-tenant and multi-site pitfalls",
      },
      {
        type: "paragraph",
        text: "Partner portals and multi-site operations are where RBAC-only designs collapse. Tenancy must be enforced in every query path, including exports, search and background reports. A single missed filter is a data breach. Prefer a platform-level tenant context established at authentication time, validated on every request, and tested with adversarial fixtures. Case studies such as multi-organisation operational tools in our [work](/work) reinforce why tenant boundaries are product features, not database convenience.",
      },
      {
        type: "paragraph",
        text: "Search is a frequent leak. Global search boxes that ignore tenant scope, autocomplete endpoints that return foreign keys, and reporting jobs that materialise cross-tenant extracts will bypass a carefully drawn UI. Mandate scoped repositories or query helpers that require tenant context to compile. Code review checklists should treat unscoped queries as severity-high defects.",
      },
      {
        type: "heading",
        text: "Auditability of permission decisions",
      },
      {
        type: "paragraph",
        text: "When a privileged action occurs, record who, what, when, on which resource, under which role/attributes, and the policy version if you version policies. Denied attempts on sensitive endpoints also matter. Permission models and [audit trails](/insights/designing-audit-trails-operational-software) are coupled: an ABAC system that cannot explain a decision will not satisfy operational investigations. Keep audit events append-only and queryable.",
      },
      {
        type: "paragraph",
        text: "Policy change itself must be audited. Who added a capability to a role, who expanded a user’s site set, who disabled MFA requirement for an emergency — those are often more important than the subsequent domain action. Store policy-version identifiers on domain audit events so investigators can reconstruct the rule that was live at the time.",
      },
      {
        type: "callout",
        title: "Do not buy flexibility you cannot operate",
        text: "The most expressive policy engine is a liability if nobody can predict outcomes. Prefer a small set of well-tested policy patterns over an open-ended rules playground with no owners.",
      },
      {
        type: "heading",
        text: "Implementation notes for bespoke systems",
      },
      {
        type: "paragraph",
        text: "Store permissions as data you can migrate, not only as hard-coded enums scattered through controllers — though stable capability names should still be code-reviewed. Test policies with matrix fixtures. Load-test scoped queries so attribute filters do not become full table scans. Integrate SSO so joiner/leaver depletes access centrally. For programme context see [custom systems](/custom-systems) and [security in bespoke software projects](/insights/security-in-bespoke-software-projects). Start design conversations in [enterprise discovery](/enterprise/contact).",
      },
      {
        type: "paragraph",
        text: "Cache carefully. Permission caches that outlive revocation create windows of oversharing; caches that miss constantly create latency and encourage engineers to skip checks. Invalidate on role and attribute change, keep TTLs short for privileged capabilities, and never cache a “allow all” short-circuit. Document the caching behaviour in the security design note so operations knows how fast a leaver becomes ineffective.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Is ABAC always more secure than RBAC?",
      },
      {
        type: "paragraph",
        text: "No. Security comes from correct enforcement and least privilege. A tidy RBAC model with deny-by-default can be safer than a sprawling ABAC policy set nobody understands. Choose the model that expresses your real constraints with the least ambiguity.",
      },
      {
        type: "subheading",
        text: "Can we start with RBAC and add attributes later?",
      },
      {
        type: "paragraph",
        text: "Yes, if you keep roles coarse and avoid baking scope into role names. Introduce attribute scope before role explosion begins. Retrofitting tenancy after launch is far more expensive than designing for it early.",
      },
      {
        type: "subheading",
        text: "Where should policies live — code or database?",
      },
      {
        type: "paragraph",
        text: "Stable capability checks often belong in versioned code. Assignments (who has which role, which sites) belong in data. Highly dynamic customer-specific rules may need a constrained policy store with change control and audit — not an ungoverned admin textarea.",
      },
      {
        type: "subheading",
        text: "How do we test permission models?",
      },
      {
        type: "paragraph",
        text: "Build a matrix of subjects, resources and actions with expected allow/deny outcomes. Run it in CI against API handlers and critical queries. Include negative tests for cross-tenant access and privilege escalation attempts.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "offline-first-software-warehouses-field-teams",
    title: "Building Offline-First Software for Warehouses and Field Teams",
    seoTitle: "Offline-First Software for Warehouses & Field Teams",
    description: "Engineering trade-offs for offline-first operational apps: sync, conflict rules, device trust, audit continuity and what not to invent.",
    answer:
      "Offline-first software is justified when connectivity is intermittent and work cannot stop — warehouses with RF dead zones, yards, basements, vehicles and customer sites. The hard problem is not caching screens; it is defining authoritative state, sync boundaries, conflict rules and what happens to audit evidence when devices reconnect out of order. Build a deliberate sync protocol around a small set of offline-capable workflows rather than making the entire enterprise estate optimistic. ScaleSmiths designs these systems as part of [custom systems](/custom-systems) and [enterprise](/enterprise) delivery when field reality demands it.",
    priority: 30,
    author: "trevor-newton-bradley",
    services: ["/enterprise", "/custom-systems", "/custom-web-app-development-uk"],
    work: ["prymal"],
    related: [
      "designing-audit-trails-operational-software",
      "enterprise-software-modular-monolith",
      "security-in-bespoke-software-projects",
      "when-does-a-business-need-custom-software",
    ],
    blocks: [
      {
        type: "heading",
        text: "Offline is a product constraint, not a progressive enhancement",
      },
      {
        type: "paragraph",
        text: "If scanners must keep receiving stock while the access point blips, “try again when online” is an operational failure. Offline-first means the device can accept valid work, queue it safely, and reconcile later under known rules. That changes UX, data modelling and security. It also changes testing: you must simulate partition, clock skew, partial sync and replay. Organisations underestimate this because demos are always on reliable Wi-Fi.",
      },
      {
        type: "paragraph",
        text: "Limit the offline surface. Identity provisioning, complex pricing engines and multi-party approvals often remain online-only. Receiving, put-away, picks, proof-of-delivery and inspection checklists are common offline candidates. Clarity about which workflows are offline-capable prevents a pseudo-offline app that fails the moment a rare path is needed.",
      },
      {
        type: "paragraph",
        text: "Write the offline contract as user-visible behaviour: which actions remain available, which data may be stale, how the UI signals sync debt, and what happens if the maximum offline window expires mid-shift. Operators will invent paper if those rules are vague. Product and warehouse leads should co-author the contract; engineers alone will optimise for elegant sync rather than noisy dock doors.",
      },
      {
        type: "heading",
        text: "Sync architecture that operations can reason about",
      },
      {
        type: "code",
        language: "text",
        code: ` Device                         Server
 +------------------+           +------------------+
 | Local durable DB |  upload   | Ingest / verify  |
 | Outbox events    | --------> | Apply / conflict |
 | Snapshot cache   | <-------- | Ack + changes    |
 +------------------+  download +------------------+
        |                              |
   UI reads local               Audit + projections`,
      },
      {
        type: "paragraph",
        text: "Prefer an outbox of intent events (ReceivedUnit, CompletedPick) over blindly merging row snapshots. Events carry actor, device, timestamps and business keys. The server validates, applies, detects conflicts and returns acknowledgements plus catch-up changes. Local UI should read from a local store so work continues during partition. Idempotency keys are mandatory — retries will happen.",
      },
      {
        type: "paragraph",
        text: "Snapshot downloads need their own discipline. Full database mirrors on every device are rarely viable; prefer scoped working sets — open tasks for this shift, bins for this zone, deliveries for this route. Invalidate and refresh on login, zone change or forced sync. Monitor sync lag as an operational KPI: a warehouse with average lag of forty minutes is not “mostly online”, it is running on delayed truth.",
      },
      {
        type: "heading",
        text: "Conflict rules must be business rules",
      },
      {
        type: "list",
        items: [
          "Last-write-wins is rarely acceptable for inventory or compliance evidence.",
          "Define per-entity conflict policies: reject, merge fields, or require supervisor resolution.",
          "Detect physical impossibilities early (negative stock, double-pick of unique serials).",
          "Surface conflicts to humans with enough context to decide — do not bury them in logs.",
          "Preserve both sides of a conflict in an audit trail until resolution is recorded.",
          "Version schemas so older devices can negotiate or be forced to update before working.",
        ],
      },
      {
        type: "paragraph",
        text: "Warehouse truth is physical. If two devices claim the same serial was picked, software cannot invent consensus — it must escalate. Field service photos and signatures need durable local storage and careful upload with checksum verification. Design those paths with [audit trails](/insights/designing-audit-trails-operational-software) in mind from day one.",
      },
      {
        type: "paragraph",
        text: "Train supervisors on conflict queues the same way you train them on stock discrepancies. A conflict inbox that only engineers understand will backlog until someone deletes it. Provide filters by site, age and risk class, and page on-call when high-risk conflicts exceed a threshold. Conflict handling is part of the operating model funded in [enterprise delivery](/enterprise/delivery), not a free side effect of sync. The same discipline applies when replacing [fragmented internal software](/insights/replace-fragmented-internal-software-without-breaking-operations): unowned exception queues recreate spreadsheets.",
      },
      {
        type: "heading",
        text: "Device trust, identity and lost-device scenarios",
      },
      {
        type: "paragraph",
        text: "Offline devices hold sensitive operational data. Use device registration, remote wipe capability where the platform allows, encrypted local stores, and short-lived tokens with refresh that degrades safely. Stolen-device playbooks matter: revoke device keys, invalidate sessions, and know what data was resident. MFA for privileged online admin differs from shift-login patterns on shared scanners — design both. Align with [Security & Trust](/security) rather than bolting encryption on late.",
      },
      {
        type: "paragraph",
        text: "Shared hardware is common on docks. Prefer shift authentication that binds actions to a person without requiring each scan to fight a full SSO dance while offline. Cache only the minimum identity claims needed for local authorisation, and require online revalidation when capability sets change. Lost shared scanners should not retain yesterday’s supervisor elevation.",
      },
      {
        type: "heading",
        text: "Performance, battery and UX realities",
      },
      {
        type: "paragraph",
        text: "Field hardware is often constrained. Avoid chatty sync. Batch uploads. Make barcode success feedback immediate and obvious in noisy environments. Support large gloves and bright sunlight in UI choices. Background sync should not destroy battery mid-shift. These are engineering requirements, not polish. A beautiful progressive web app that drains a scanner in two hours will be abandoned for paper.",
      },
      {
        type: "paragraph",
        text: "Test on the actual device fleet, not only on developer laptops. Scanner wedges, Bluetooth printers and intermittent captive portals create failure modes browsers hide. Budget a hardware lab day in discovery. If the estate mixes rugged Android and older Windows terminals, the offline client strategy may bifurcate — admit that early rather than shipping a lowest-common-denominator that satisfies nobody.",
      },
      {
        type: "callout",
        title: "Offline scope discipline",
        text: "Every offline workflow multiplies test matrix size. Earn each one with a connectivity failure mode that currently costs the business money or safety. Do not offline-enable vanity screens.",
      },
      {
        type: "heading",
        text: "Where offline-first sits in the wider architecture",
      },
      {
        type: "paragraph",
        text: "Keep the server domain model authoritative. Devices are participants with deferred connectivity, not peers with equal authority. A [modular monolith](/insights/enterprise-software-modular-monolith) with a clear sync ingest module is usually healthier than a mesh of microservices fighting over conflict resolution. Integrate carefully with WMS, ERP or messaging adapters after the offline core is trustworthy. Explore [enterprise delivery](/enterprise/delivery) and [insights](/insights) for how we sequence such programmes; begin with [enterprise discovery](/enterprise/contact) to map dead zones and exception paths honestly.",
      },
      {
        type: "paragraph",
        text: "Offline programmes fail when they are treated as a mobile skin on an online API. The API must speak idempotent commands, return structured conflict objects, and expose catch-up feeds. If the existing online API is chatty CRUD without business intents, redesign that surface before investing in local databases. That redesign often improves the online product as a side effect — another reason to keep the server core clean inside [custom systems](/custom-systems) work.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Is a progressive web app enough for warehouse offline?",
      },
      {
        type: "paragraph",
        text: "Sometimes for light workflows. Many warehouse estates still need native or tightly managed runtimes for scanner integrations, background robustness and device policy. Choose based on hardware and MDM constraints, not fashion.",
      },
      {
        type: "subheading",
        text: "How long can a device stay offline?",
      },
      {
        type: "paragraph",
        text: "Define a maximum offline window per workflow based on conflict risk and storage. Beyond that window, require sync before new high-risk actions. Unlimited offline queues become unreconcilable backlogs.",
      },
      {
        type: "subheading",
        text: "What about clocks and timestamps?",
      },
      {
        type: "paragraph",
        text: "Do not trust device clocks alone for authority. Record device time and server receive time. Order causal history with server sequencing where possible, and design conflict checks that do not assume perfect clock sync.",
      },
      {
        type: "subheading",
        text: "Can we add offline later to an online system?",
      },
      {
        type: "paragraph",
        text: "You can, but expect model changes: outbox patterns, idempotency, local stores and conflict UX. Retrofits are cheaper when the online API was already event-friendly and authoritative fields were well bounded.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "designing-audit-trails-operational-software",
    title: "Designing Audit Trails for Operational Software",
    seoTitle: "Audit Trails for Operational Software",
    description: "How to design audit trails that investigators and operators can trust: event shape, immutability, retention, privacy and performance trade-offs.",
    answer:
      "An audit trail for operational software is a deliberate evidence system, not a verbose application log. It should record who did what to which business object, when, from where, under which authority, and with which before/after or intent payload — in a form that survives denial and investigation. Logs that rotate away, can be edited by admins, or omit the business key fail under pressure. Design audit events alongside the domain model and [permission model](/insights/rbac-vs-abac-permission-models), then protect them as carefully as primary data. This is core [enterprise](/enterprise) engineering, not compliance decoration.",
    priority: 31,
    author: "rhys",
    services: ["/enterprise", "/security", "/custom-systems"],
    work: ["the-business-circle"],
    related: [
      "rbac-vs-abac-permission-models",
      "security-in-bespoke-software-projects",
      "offline-first-software-warehouses-field-teams",
      "when-does-a-business-need-custom-software",
    ],
    blocks: [
      {
        type: "heading",
        text: "Audit events are product requirements",
      },
      {
        type: "paragraph",
        text: "Ask investigation questions first: who overrode a price, who exported personal data, who unlocked a closed period, who changed a delivery address after pick? Those questions define mandatory events. If a privileged action has no event, you do not have an audit trail — you have hope. Product owners should sign off the event catalogue the same way they sign off workflows. Engineers should refuse silent privileged mutations.",
      },
      {
        type: "paragraph",
        text: "Distinguish operational audit (business actions) from infrastructure telemetry (CPU, request latency). Both matter; they answer different questions. Mixing them into one unqueriable stream usually means neither audience is served.",
      },
      {
        type: "paragraph",
        text: "Invite operations, finance and security to nominate the five investigations they actually ran last year. Build the catalogue from those stories. Abstract threat models help, but reminiscences of real disputes catch missing fields — the free-text reason a manager typed, the secondary approver, the ticket number from a side channel. Those fields become mandatory payload keys rather than optional notes.",
      },
      {
        type: "heading",
        text: "A practical event shape",
      },
      {
        type: "code",
        language: "text",
        code: ` audit_event
 - id (uuid)
 - at (server time)
 - actor_id / actor_type (user, system, device)
 - impersonator_id (if break-glass)
 - action (enum: ORDER_STATUS_CHANGED)
 - object_type / object_id
 - tenant_id / site_id
 - request_id / correlation_id
 - auth_context (roles, attrs hash / policy version)
 - payload (intent, before/after redacted)
 - integrity (hash / previous_hash optional)`,
      },
      {
        type: "paragraph",
        text: "Keep action names stable and business-meaningful. Prefer before/after for small critical fields; prefer intent events when the command is the truth. Redact secrets and unnecessary personal data in payloads while retaining investigative value. Correlation IDs stitch UI actions to API commands to job outcomes — essential when [offline sync](/insights/offline-first-software-warehouses-field-teams) replays later.",
      },
      {
        type: "paragraph",
        text: "Version the event schema. Investigators hate silent field renames six months later. Publish a short dictionary of action enums and payload shapes beside the domain model. When you deprecate an action, stop writing it but keep readers able to interpret historical rows. Schema drift without a dictionary turns the trail into archaeology.",
      },
      {
        type: "heading",
        text: "Immutability, access control and retention",
      },
      {
        type: "list",
        items: [
          "Append-only storage: no update/delete paths for normal operators, including administrators.",
          "Separate permissions to read audit from permissions to act in the domain.",
          "Retention schedule by data class; legal hold capability when investigations require it.",
          "Export formats that preserve integrity metadata for external review.",
          "Backup and restore drills that include audit stores, not only primary tables.",
          "Alert on audit-write failure — failing open without evidence is a security incident.",
        ],
      },
      {
        type: "paragraph",
        text: "Some estates add hash chaining for tamper evidence. Useful, but not a substitute for locked-down storage and access control. Also plan for time: investigations may arrive months later. Retention that deletes evidence on a short log rotation schedule is incompatible with operational accountability.",
      },
      {
        type: "paragraph",
        text: "Administrators who can edit domain data must not be able to quietly rewrite history. If your ORM migrates schema with truncate-and-reload habits, carve audit tables out of those paths. Prefer separate schemas or stores with stricter IAM. Document who can run retention jobs and require dual control for bulk deletes outside policy.",
      },
      {
        type: "heading",
        text: "Performance and privacy trade-offs",
      },
      {
        type: "paragraph",
        text: "Writing rich audit events on every read will crush databases and create privacy noise. Focus on mutations, privileged reads (exports, unlocks, decryption), authentication events and admin changes. Asynchronous write paths can improve latency if durability guarantees are explicit — a lost audit event on a credit override is unacceptable even if the UI felt fast. Partition large tables by time and tenant. Index object_id and actor_id for investigator queries.",
      },
      {
        type: "paragraph",
        text: "Privacy regulations still apply. Minimise personal data in payloads, document purposes, and ensure subject-access and erasure processes know what the audit store contains. Erasure may require anonymising actor labels while retaining action evidence — design that policy early with counsel where needed, without pretending a blog post is legal advice.",
      },
      {
        type: "paragraph",
        text: "Load-test investigator queries, not only write paths. An append-only store that cannot answer “show all overrides on this order family in Q2” within a useful time fails its purpose during an incident. Materialised investigator views or constrained search APIs often beat granting raw SQL to panicked managers. Budget index design and retention partitioning as first-class work inside [enterprise delivery](/enterprise/delivery), not as a tidy-up after launch complaints.",
      },
      {
        type: "callout",
        title: "Audit that operators will use",
        text: "If investigators need SQL access to a raw table with no product UI, the trail will be underused and misunderstood. Provide filtered search by object, actor and time — with access controls and its own access logging.",
      },
      {
        type: "heading",
        text: "Integrations and multi-system estates",
      },
      {
        type: "paragraph",
        text: "When actions span adapters — ERP posts, payment captures, messaging — record outbound attempts and inbound acknowledgements with correlation. Dual-writes during migration need audit continuity across old and new systems so a reconstructed timeline remains possible. See [legacy migration planning](/insights/how-to-plan-legacy-system-migration) and [enterprise delivery](/enterprise/delivery).",
      },
      {
        type: "paragraph",
        text: "Partner actions on portals belong in the same trail with clear actor types. “System” is not an acceptable actor label when a partner user clicked approve. Likewise, service accounts that apply inbound webhooks should name the integration and the external event id so disputes with counterparties can be evidenced without digging through vendor consoles you may lose access to later.",
      },
      {
        type: "heading",
        text: "How this shows up in ScaleSmiths programmes",
      },
      {
        type: "paragraph",
        text: "We treat audit catalogues as discovery artefacts, wire them into acceptance tests, and include them in [Security & Trust](/security) conversations without claiming certifications we do not hold. Related reading across [insights](/insights) covers permissions and security engineering. For a programme conversation, use [enterprise discovery](/enterprise/contact) or review [work](/work) for operational system patterns.",
      },
      {
        type: "paragraph",
        text: "Acceptance tests should attempt privileged actions and assert event presence, actor fidelity and redaction rules. CI that only checks HTTP 200 on overrides is incomplete. Make missing audit events fail the build for catalogue-listed actions. That single habit prevents the common late discovery that “we logged it somewhere in the app logger” — which rotated away last Tuesday.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Are database triggers enough?",
      },
      {
        type: "paragraph",
        text: "Triggers can capture row changes but often miss actor context, auth attributes, intent and correlated side effects. Prefer application-level events enriched with request context, optionally complemented by storage-level guards.",
      },
      {
        type: "subheading",
        text: "Should we audit every field change?",
      },
      {
        type: "paragraph",
        text: "Audit what investigations and accountability require. High-churn non-sensitive fields can create noise and cost. Critical commercial, safety and personal-data fields deserve richer evidence.",
      },
      {
        type: "subheading",
        text: "How do we handle system actors and jobs?",
      },
      {
        type: "paragraph",
        text: "Give automated processes explicit actor identities and reasons. Record the triggering user when a user schedules a job. Otherwise overnight changes look ownerless.",
      },
      {
        type: "subheading",
        text: "What about break-glass access?",
      },
      {
        type: "paragraph",
        text: "Break-glass must mint distinctive audit events, time-box elevation, notify owners and require retrospective review. Silent omnipotent admin accounts defeat the trail.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "when-custom-software-costs-less-than-saas-sprawl",
    title: "When Custom Software Costs Less Than SaaS Sprawl",
    seoTitle: "When Custom Software Costs Less Than SaaS Sprawl",
    description: "How to compare custom software TCO with SaaS sprawl: licences, reconciliation labour, integration tax, incident risk and ownership costs.",
    answer:
      "Custom software costs less than SaaS sprawl when the organisation already pays — in licences, integration maintenance and human reconciliation — more than the cost of owning a coherent platform for the same workflow. The comparison is total cost and risk over years, not build quote versus one annual subscription. Sprawl hides cost in duplicated entities, brittle connectors and staff who act as middleware. A bespoke system can be cheaper when the workflow is distinctive and stable enough to own; it is more expensive when the need is generic and productised. ScaleSmiths frames this inside [pricing](/pricing) conversations and [enterprise](/enterprise) discovery with numbers attached to operations, not slogans.",
    priority: 32,
    author: "trevor-newton-bradley",
    services: ["/enterprise", "/pricing", "/custom-systems"],
    work: ["pinkys-prints", "the-business-circle"],
    related: [
      "when-two-saas-platforms-should-become-one-bespoke-system",
      "when-does-a-business-need-custom-software",
      "what-enterprise-software-discovery-should-produce",
      "replace-fragmented-internal-software-without-breaking-operations",
    ],
    blocks: [
      {
        type: "heading",
        text: "Sprawl has a balance sheet even when finance does not see it",
      },
      {
        type: "paragraph",
        text: "Each SaaS tool arrives with a tidy per-seat price. The sprawl cost arrives later: overlapping modules, export gymnastics, identity silos, and people copying fields between systems because the vendors will not share a domain model. Those people are a recurring opex line whether or not they appear under “software”. Incident cost also compounds — when statuses diverge, customer promises break and senior staff intervene. A fair comparison must monetise reconciliation hours, failed hand-offs and blocked change, not only invoices.",
      },
      {
        type: "paragraph",
        text: "Start with one value stream. Map every tool touch, licence, integration and manual bridge. Attach approximate annual cost and failure frequency. This is uncomfortable and clarifying. Without it, “custom is expensive” is an untested slogan.",
      },
      {
        type: "paragraph",
        text: "Interview the people who keep sprawl alive: the coordinator who rebuilds the Friday pack, the analyst who reconciles two stock figures, the manager who re-enters approvals into a second system. Ask how many hours and how often things go wrong. Their answers are often more accurate than vendor ROI calculators. Capture ranges, not false precision — then keep those ranges visible in the business case so optimism cannot silently delete them.",
      },
      {
        type: "heading",
        text: "A TCO model that survives scrutiny",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Sum direct licences and mandatory add-ons across the sprawl set for three to five years.",
          "Add integration build and keep-alive cost (connectors, iPaaS, bespoke glue, monitoring).",
          "Estimate reconciliation labour and exception handling attributable to the seam.",
          "Price incident and delay risk using historical events, not optimism.",
          "For custom: include discovery, build, migration, hosting, observability, support and change capacity.",
          "Include exit costs both ways: leaving vendors versus owning a codebase you must maintain.",
          "Apply a sensitivity range — best/likely/worst — instead of a single heroic number.",
        ],
      },
      {
        type: "paragraph",
        text: "Custom wins when sprawl’s seam costs dominate and the organisation will fund ownership. Custom loses when a single product covers 80% of the need with acceptable compromise and low integration tax. See also [when two SaaS platforms should become one bespoke system](/insights/when-two-saas-platforms-should-become-one-bespoke-system) and [when a business needs custom software](/insights/when-does-a-business-need-custom-software).",
      },
      {
        type: "paragraph",
        text: "Present the model as two curves toward the same reliability target, not as a beauty contest between a sales demo and an engineering estimate. If the SaaS path cannot meet audit, offline or permission constraints without unsafe workarounds, note those as non-monetised blockers — or monetise the residual risk explicitly. A cheaper path that cannot satisfy [Security & Trust](/security) constraints is not cheaper; it is unfinished.",
      },
      {
        type: "heading",
        text: "Ownership cost is real — price it, do not hide it",
      },
      {
        type: "paragraph",
        text: "Owning software means environments, dependency updates, security response, product decisions and knowledge continuity. Founder-led delivery reduces agency theatre, but it does not abolish run cost. A responsible proposal separates build from operate and names who does what. Understating run cost to win a build is how custom projects earn a bad reputation. Prefer honest envelopes on [/pricing](/pricing) and an operating model the client can staff or contract.",
      },
      {
        type: "paragraph",
        text: "Include change capacity: how many meaningful improvements per quarter the operating model can absorb. Sprawl often feels “cheap to change” until you count the coordinator time across five vendors. Custom feels “expensive to change” until you count a single backlog with one architecture. Make both visible. Organisations that buy custom and then starve change capacity recreate stagnation with higher fixed cost.",
      },
      {
        type: "code",
        language: "text",
        code: ` 5-year lens (illustrative categories)
 ------------------------------------
 SaaS sprawl:  licences + connectors + human middleware + incidents
 Custom path:  build + migrate + host/observe + change capacity + residual integrations

 Decision: which curve is lower for the SAME workflow reliability target?`,
      },
      {
        type: "heading",
        text: "Where custom economics usually work",
      },
      {
        type: "paragraph",
        text: "Distinctive operational workflows with multi-site permissions, offline constraints, deep audit needs or partner tenancy often fit poorly into generic SaaS. Paying for unused modules while still funding spreadsheets is a smell. Consolidation into a [custom system](/custom-systems) can remove seats, connectors and rework simultaneously — if discovery produces a sharp release one. Economics fail when stakeholders demand a clone of every legacy quirk plus a speculative platform roadmap on day one.",
      },
      {
        type: "paragraph",
        text: "Look for licence piles that exist to paper over one missing workflow. If three products are each 60% right and staff supply the remaining 40%, you are already funding a bespoke system — just a fragmented, unowned one. Concentrating that spend into a coherent core is often the economic move, provided [enterprise discovery](/enterprise/contact) can define a proving release that retires at least one paid seam early.",
      },
      {
        type: "heading",
        text: "Migrate value, not archaeology",
      },
      {
        type: "paragraph",
        text: "Cost overruns often come from migrating everything. Grade data and workflows. Retire low-value tools instead of rebuilding them. Dual-run only what safety requires. [Enterprise delivery](/enterprise/delivery) should make retirement part of the business case — licence savings do not appear if nobody switches the old tools off.",
      },
      {
        type: "paragraph",
        text: "Assign a retirement owner with a date and a licence cancellation checklist. Engineering can deliver a replacement and still watch finance renew the old SaaS because nobody filed the exit. Put cancellation milestones in the same plan as cutover gates. That single governance habit converts theoretical TCO wins into banked ones.",
      },
      {
        type: "callout",
        title: "Cheaper is not the only win condition",
        text: "Sometimes custom costs a similar amount but buys control: permission fidelity, auditability, offline resilience or change velocity. Price those outcomes explicitly so the decision is not a pure spreadsheet duel.",
      },
      {
        type: "heading",
        text: "How we keep the commercial conversation honest",
      },
      {
        type: "paragraph",
        text: "In [enterprise discovery](/enterprise/contact) we gather licence inventories, integration lists and operator time samples before recommending build. We do not invent ROI percentages or confidential client savings. We present ranges, assumptions and kill criteria. Related [insights](/insights) and [work](/work) show the engineering posture behind the numbers; [Security & Trust](/security) explains baseline controls that belong in both custom and SaaS comparisons.",
      },
      {
        type: "paragraph",
        text: "When the model is close, we recommend buying time: a time-boxed integration improvement or a thinner custom adapter rather than a full platform bet. Economic honesty includes the option to not build. The [enterprise](/enterprise) engagement model exists to decide, not to force a build narrative onto every sprawl complaint.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Can a low-code platform beat both options?",
      },
      {
        type: "paragraph",
        text: "Sometimes for light internal tools. Low-code still incurs licence, governance and lock-in costs, and it can recreate sprawl if every team ships an app. Judge it with the same TCO and permission/audit tests.",
      },
      {
        type: "subheading",
        text: "What discount rate or horizon should we use?",
      },
      {
        type: "paragraph",
        text: "Use the horizon over which the workflow must remain coherent — often three to five years for operational platforms. Be consistent between options. Revisit annually as licences and headcount change.",
      },
      {
        type: "subheading",
        text: "How do we account for build overruns?",
      },
      {
        type: "paragraph",
        text: "Use ranged estimates, contingency tied to named risks (data quality, integration opacity), and a proving release gate before full commitment. Discovery quality is the main overrun control.",
      },
      {
        type: "subheading",
        text: "What if SaaS vendors offer a discount to stay?",
      },
      {
        type: "paragraph",
        text: "Re-run the model with the discount. If seam labour and risk still dominate, a discount on licences does not fix the architecture. If it closes the gap and compromise is acceptable, staying can be rational.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "how-to-plan-legacy-system-migration",
    title: "How to Plan a Legacy System Migration",
    seoTitle: "How to Plan a Legacy System Migration",
    description: "A practical plan for legacy system migration: inventory, data grades, strangler slices, dual-run, cutover criteria and rollback.",
    answer:
      "Plan a legacy system migration as a sequenced reduction of risk: inventory the estate, grade data and workflows, design strangler slices with dual-run evidence, and define cutover criteria that operations can refuse if unmet. Treat the legacy system as a production dependency until parity is proven — not as an embarrassment to switch off on a fixed date. Migration fails when teams confuse rewrite ambition with cutover engineering. ScaleSmiths embeds migration planning in [enterprise delivery](/enterprise/delivery) and [enterprise discovery](/enterprise/contact) before build velocity becomes the only metric.",
    priority: 33,
    author: "rhys",
    services: ["/enterprise", "/enterprise/delivery", "/custom-systems"],
    work: ["veteranfinder", "prymal"],
    related: [
      "replace-fragmented-internal-software-without-breaking-operations",
      "what-enterprise-software-discovery-should-produce",
      "enterprise-software-modular-monolith",
      "when-does-a-business-need-custom-software",
    ],
    blocks: [
      {
        type: "heading",
        text: "Inventory before ambition",
      },
      {
        type: "paragraph",
        text: "List applications, databases, scheduled jobs, file exchanges, report packs, user populations and contractual constraints. Capture who can still make emergency changes. Legacy systems often survive because one person knows the batch calendar. If that person is unavailable, your migration plan is incomplete. Include shadow IT that production depends on — the spreadsheet that corrects finance exports is in scope whether anyone likes it or not.",
      },
      {
        type: "paragraph",
        text: "Document interfaces with directionality and failure modes. A nightly CSV that silently truncates fields is a different risk from a synchronous API with retries. Migration design follows those truths.",
      },
      {
        type: "paragraph",
        text: "Photograph or export the operational calendars: month-end locks, peak trading weeks, regulatory filing windows. Cutover timing that ignores those calendars is negligence dressed as project management. Inventory also means knowing which licences auto-renew mid-programme so finance is not surprised by paying for overlap longer than planned.",
      },
      {
        type: "heading",
        text: "Grade workflows and data",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Critical path workflows that must never stop (fulfil, invoice, safety checks).",
          "Important but pausable workflows (analytics rebuilds, non-urgent admin).",
          "Retirable workflows that exist only because the legacy UI made them easy.",
          "Data grade A: required for live operations on day one of a slice.",
          "Data grade B: recent history needed for customer service within weeks.",
          "Data grade C: archive in place or migrate later under a separate programme.",
        ],
      },
      {
        type: "paragraph",
        text: "Grading prevents the classic failure mode: boiling the ocean of thirty years of inconsistent history before any user can take an order in the new system. Cleanse grade A deliberately; do not launder grade C into the new core “just in case”.",
      },
      {
        type: "paragraph",
        text: "Sample grade A data for duplicates, orphaned references and impossible states. Publish the findings to budget holders before build estimates harden. Data remediation is often a parallel workstream with its own owners — warehouse leads correcting bin codes, finance merging customer records. If remediation is left solely to engineers writing transform scripts, you will migrate myths with better types.",
      },
      {
        type: "heading",
        text: "Design the strangler and the anti-corruption layer",
      },
      {
        type: "code",
        language: "text",
        code: ` Users/Partners
       |
   Edge routing / feature flags
       |
 +-----+------+        +----------------+
 | New slice  |<------>| Anti-corruption|
 | (modular)  |        | adapters       |
 +-----+------+        +--------+-------+
       |                        |
       v                        v
  New data store          Legacy system
       ^                        |
       +---- dual-run compare --+`,
      },
      {
        type: "paragraph",
        text: "Anti-corruption adapters translate legacy schemas into the new domain language so legacy weirdness does not infect the new model. Feature flags and routing let you move cohorts — one site, one product line, one partner — rather than everyone at once. Prefer a [modular monolith](/insights/enterprise-software-modular-monolith) as the new home unless organisational scale already demands distribution.",
      },
      {
        type: "paragraph",
        text: "Choose cohort order for learning, not politics alone. A smaller site with cooperative staff and moderate volume teaches dual-run mechanics before you touch the flagship warehouse. Document what each cohort is meant to prove. If cohort one only proves that login works, you wasted a cutover window. Cohort plans belong in [enterprise delivery](/enterprise/delivery) artefacts beside the technical sequence.",
      },
      {
        type: "heading",
        text: "Dual-run, parity and cutover criteria",
      },
      {
        type: "paragraph",
        text: "Dual-run produces evidence: matching counts, status histograms, financial totals and spot-checked entities. Define thresholds and owners. Cutover criteria should be written as gates — parity within X, training completion, support rota live, rollback rehearsed — not as a calendar appointment. Operations must have authority to delay. Parallel to [replacing fragmented internal software](/insights/replace-fragmented-internal-software-without-breaking-operations), freeze non-essential legacy change during dual-run.",
      },
      {
        type: "paragraph",
        text: "Automate parity where possible and keep a human sampling ritual for the rest. Dashboards that nobody opens are not controls. Schedule a short daily dual-run stand-up while a slice is live: mismatches, workarounds, training gaps. Close the stand-up only when exit criteria are met or consciously deferred with a new date — never by fatigue.",
      },
      {
        type: "heading",
        text: "Rollback is a product feature",
      },
      {
        type: "paragraph",
        text: "If you cannot state how to disable the new slice and restore a known-good path within an agreed window, you are not ready to cut traffic. Rollback may mean DNS/feature-flag reversal, queue draining rules and a communication plan. Data written only in the new system during a failed window needs a reconciliation strategy. Practice this in staging with production-like volumes.",
      },
      {
        type: "paragraph",
        text: "Write the rollback runbook as a checklist with names and channels. Include customer communication if external partners hit the slice. Store the runbook where on-call can find it without VPN archaeology. A rollback plan that lives only in a kickoff deck will not be followed at 21:40 on a Friday.",
      },
      {
        type: "callout",
        title: "Migration success metric",
        text: "Success is continuous business outcomes through the change, plus a switched-off legacy dependency on a planned date. A new system that never becomes the sole authority is a parallel cost centre.",
      },
      {
        type: "heading",
        text: "Security during migration",
      },
      {
        type: "paragraph",
        text: "Do not widen access “temporarily” without expiry. Sync pipelines can become exfiltration paths if credentials are shared broadly. Apply least privilege to migration service accounts, encrypt dumps at rest, and audit exports. Align with [Security & Trust](/security) and [security in bespoke projects](/insights/security-in-bespoke-software-projects). Legacy often holds dormant accounts — cleanse them rather than copying them forward.",
      },
      {
        type: "paragraph",
        text: "Treat production extracts used for mapping as high-sensitivity artefacts with retention limits. Delete interim files after successful import verification. Log who accessed dumps. Migration convenience is a common path to lingering copies on laptops — forbid that path in the runbook and provide a controlled analysis environment instead.",
      },
      {
        type: "heading",
        text: "Programme artefacts and governance",
      },
      {
        type: "paragraph",
        text: "A migration plan should live beside the discovery pack: sequence diagram of slices, RACI for gates, communication plan, and a retirement checklist for licences and infrastructure. See [what discovery should produce](/insights/what-enterprise-software-discovery-should-produce). For commercial framing use [/pricing](/pricing); for capability context see [enterprise](/enterprise), [insights](/insights) and [work](/work).",
      },
      {
        type: "paragraph",
        text: "Governance should empower delay. Steering groups that only cheer green dates create hidden risk. Give operations a formal red flag that pauses cutover without career punishment. Engineering integrity depends on that cultural permission as much as on adapters and parity scripts — a theme that also appears when [fragmented internal software](/insights/replace-fragmented-internal-software-without-breaking-operations) is being retired under live load.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Should we rewrite or replace gradually?",
      },
      {
        type: "paragraph",
        text: "Replace gradually unless the legacy estate is tiny and fully understood. Big-bang rewrites concentrate unknown risk into one irreversible moment.",
      },
      {
        type: "subheading",
        text: "How do we migrate stored procedures and batch logic?",
      },
      {
        type: "paragraph",
        text: "Extract behaviour into explicit domain services with tests. Do not transliterate thousands of lines blindly. Prioritise procedures on the critical path; retire obsolete batches.",
      },
      {
        type: "subheading",
        text: "What about reporting users who only live in the old system?",
      },
      {
        type: "paragraph",
        text: "Provide a read model or agreed dual reporting period with reconciliation. Moving writers without a reporting path creates shadow systems overnight.",
      },
      {
        type: "subheading",
        text: "When can we decommission legacy?",
      },
      {
        type: "paragraph",
        text: "When no critical workflow depends on it, parity gates have passed, legal retention needs are met elsewhere, and access can be revoked. Decommission is a project with its own checklist — not a party after launch day.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "enterprise-software-modular-monolith",
    title: "Why Enterprise Software Should Start as a Modular Monolith",
    seoTitle: "Start Enterprise Software as a Modular Monolith",
    description: "Why most enterprise operational systems should begin as modular monoliths: clearer boundaries, simpler transactions, cheaper ops — and when to split later.",
    answer:
      "Most enterprise operational systems should start as a modular monolith: one deployable unit with enforced module boundaries, a single transactional database where appropriate, and explicit interfaces between domains. That shape preserves development speed and transactional integrity while you are still discovering the real seams. Premature microservices recreate network failure modes, distributed transactions and organisational overhead before the domain is understood. Split later, along tested boundaries, when scale or team topology demands it. ScaleSmiths recommends this default in [enterprise](/enterprise) architecture conversations and [custom systems](/custom-systems) delivery.",
    priority: 34,
    author: "rhys",
    services: ["/enterprise", "/custom-systems", "/custom-web-app-development-uk"],
    work: ["the-business-circle", "veteranfinder"],
    related: [
      "how-to-plan-legacy-system-migration",
      "rbac-vs-abac-permission-models",
      "when-two-saas-platforms-should-become-one-bespoke-system",
      "when-does-a-business-need-custom-software",
    ],
    blocks: [
      {
        type: "heading",
        text: "The monolith that fails is the unmodular one",
      },
      {
        type: "paragraph",
        text: "Critics of monoliths usually describe a ball of mud: shared tables without ownership, circular imports, and features that cannot change without collateral damage. That is a modularity failure, not proof that one deployable is wrong. A modular monolith organises code and data ownership by domain — identity/permissions, orders, inventory, billing adapters — with rules that prevent casual cross-module table reach-ins. Those rules can be architectural tests, package boundaries and code review norms.",
      },
      {
        type: "paragraph",
        text: "Microservices without those boundaries simply distribute the mud. You pay latency and ops cost for the same entanglement. Start where modularity is cheapest to enforce: inside one process and one primary store, with clear modules.",
      },
      {
        type: "paragraph",
        text: "Enterprise programmes also underestimate cognitive load. A new operational domain is hard enough without adding service discovery, distributed tracing gaps and partial failure modes on week three. Keep the runtime simple while the language of the business is still being discovered in [enterprise discovery](/enterprise/contact). Complexity should track proven needs, not fashion.",
      },
      {
        type: "heading",
        text: "What “modular” must mean in practice",
      },
      {
        type: "list",
        items: [
          "Each module owns its tables or table prefixes and exposes an application API to others.",
          "Cross-module calls go through service interfaces, not opportunistic SQL joins across ownership lines.",
          "Shared kernels stay tiny (IDs, clock, auth context) — not a dumping ground for convenience.",
          "Module boundaries align to domain language discovered in [enterprise discovery](/enterprise/contact).",
          "Integration adapters sit at the edges so vendor schemas do not leak inward.",
          "Permission checks and audit events are platform capabilities modules must use, not reimplement.",
        ],
      },
      {
        type: "paragraph",
        text: "Publish a module map that non-engineers can read: what each module owns, what it refuses to own, and which adapters touch the outside world. When a stakeholder asks for a feature, locate it on the map before estimating. Features that straddle three modules without a clear home are usually under-analysed requirements, not evidence you needed microservices yesterday.",
      },
      {
        type: "heading",
        text: "Transactional and operational advantages",
      },
      {
        type: "paragraph",
        text: "Operational workflows often need atomic updates across closely related entities — allocate stock and confirm pick lines together, or refuse the whole command. In a monolith this is a local transaction. In a microservice estate it becomes sagas, outboxes and compensating actions before the domain even stabilises. Observability is also simpler: one service map, correlated logs, fewer partial deploy matrices. For many mid-market platforms, that operational simplicity is worth more than theoretical independent scaling of a rarely hot module.",
      },
      {
        type: "paragraph",
        text: "Local transactions also simplify audit and permission enforcement for compound commands. One request, one auth decision, one audit event, one commit or rollback. Distributed sagas can be correct, but they multiply failure stories your on-call must learn. Earn that complexity with a measured need — for example a module whose scale or regulatory isolation is proven — not with a template repository that scaffolds twelve services by default.",
      },
      {
        type: "code",
        language: "text",
        code: ` Modular monolith (default)
 +--------------------------------------+
 | API / UI                             |
 |--------------------------------------|
 | Orders | Inventory | Identity | Jobs |
 |  API   |   API     |   API    |      |
 |  data  |   data    |   data   |      |
 |--------------------------------------|
 | Postgres (schemas / bounded tables)  |
 +--------------------------------------+
           |
      Adapters out (ERP, email, SSO)`,
      },
      {
        type: "heading",
        text: "When to split a module out later",
      },
      {
        type: "paragraph",
        text: "Extract a service when a boundary is stable, the team topology needs independent cadence, scaling characteristics diverge sharply, or a compliance boundary demands isolation. Extract along the existing module API with an anti-corruption mindset. Do not split because a conference talk praised mesh networking. Premature distribution is one of the expensive ways SaaS consolidation projects recreate sprawl inside their own cloud account — see [when two SaaS platforms should become one](/insights/when-two-saas-platforms-should-become-one-bespoke-system).",
      },
      {
        type: "paragraph",
        text: "Before extracting, write the failure mode you are solving: deploy contention, CPU hotspot, data residency, or third-party rate limits. If you cannot name it, you are rearranging boxes. After extraction, keep the modular monolith as the system of record for closely related domains rather than dissolving everything into peers on day one of the split.",
      },
      {
        type: "heading",
        text: "Permissions, audit and modularity",
      },
      {
        type: "paragraph",
        text: "Centralise authn/authz context and audit writing as platform modules. Domain modules declare capabilities and emit domain events; they should not each invent tenancy filters. That keeps [RBAC/ABAC](/insights/rbac-vs-abac-permission-models) and [audit trails](/insights/designing-audit-trails-operational-software) consistent. Security reviews become tractable when enforcement points are few and tested — aligned with [Security & Trust](/security).",
      },
      {
        type: "paragraph",
        text: "Platform modules should be boring and well-tested. Resist letting every domain team fork their own auth helpers “just this once”. Drift in helpers is how tenant filters disappear. Code owners and architectural tests protect the platform the same way they protect domain boundaries.",
      },
      {
        type: "callout",
        title: "Modularity is a testable property",
        text: "If you cannot run a build check that fails when module A imports module B’s tables, you do not have a modular monolith — you have hopeful folders. Invest in boundary enforcement early.",
      },
      {
        type: "heading",
        text: "Delivery implications",
      },
      {
        type: "paragraph",
        text: "A modular monolith fits strangler migrations well: new modules take over slices while adapters speak to legacy. [Enterprise delivery](/enterprise/delivery) can ship one deployable through environments without choreographing twelve repositories on day one. Choose [custom web app](/custom-web-app-development-uk) and backend patterns that keep modules clear in code. For programme entry points use [enterprise](/enterprise), browse [insights](/insights) and [work](/work), and start scoping via [enterprise discovery](/enterprise/contact).",
      },
      {
        type: "paragraph",
        text: "Repository structure should mirror modules without over-fragmenting packages. A single CI pipeline with module-level test targets usually beats a forest of pipelines that obscure the path to production. Keep deployment boring so attention stays on domain risk — the place migrations and consolidations actually fail. That posture is consistent with how we approach [legacy migration](/insights/how-to-plan-legacy-system-migration) and consolidation programmes. When in doubt, ship one modular deployable that operations can reason about, then earn every later split with evidence rather than aspiration.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Does a modular monolith prevent scaling?",
      },
      {
        type: "paragraph",
        text: "No. You can scale the deployable horizontally for many workloads. Extract only the modules that prove a distinct scaling or isolation need. Measure first.",
      },
      {
        type: "subheading",
        text: "Is this incompatible with modern cloud deployment?",
      },
      {
        type: "paragraph",
        text: "Not at all. Containerise the monolith, use managed Postgres, separate workers if needed, and keep infrastructure as code. Cloud-native describes operable packaging and observability — not a mandatory microservice count.",
      },
      {
        type: "subheading",
        text: "How do multiple teams collaborate on one monolith?",
      },
      {
        type: "paragraph",
        text: "Own modules, enforce boundaries, use code owners, and keep release trains predictable. If team count and release contention become the bottleneck, that is evidence for extraction — not a reason to skip modularity at the start.",
      },
      {
        type: "subheading",
        text: "What database pattern should we use?",
      },
      {
        type: "paragraph",
        text: "Start with one database and logical separation (schemas or owned tables). Split data stores when a module’s lifecycle, scale or compliance truly diverges — after the boundary has proven stable.",
      },
    ],
  }),

  buildEnterpriseArticle({
    slug: "security-in-bespoke-software-projects",
    title: "How We Approach Security in Bespoke Software Projects",
    seoTitle: "Security in Bespoke Software Projects",
    description: "How ScaleSmiths approaches security in bespoke software: identity, environments, secrets, least privilege, audit and threat-aware delivery.",
    answer:
      "Security in bespoke software projects is a set of engineering defaults enforced throughout delivery: identity-first access, environment separation, secrets hygiene, least privilege in application and infrastructure, auditable privileged actions, dependency discipline and threat-aware design reviews. It is not a badge bolted on at the end, and it is not a substitute for the client’s own policies and assurance programmes. ScaleSmiths aligns project controls with the posture described on [Security & Trust](/security) and makes security artefacts part of [enterprise discovery](/enterprise/contact) and [enterprise delivery](/enterprise/delivery) rather than optional extras.",
    priority: 35,
    author: "trevor-newton-bradley",
    services: ["/enterprise", "/security", "/custom-systems"],
    work: ["veteranfinder", "the-business-circle"],
    related: [
      "rbac-vs-abac-permission-models",
      "designing-audit-trails-operational-software",
      "what-enterprise-software-discovery-should-produce",
      "when-does-a-business-need-custom-software",
    ],
    blocks: [
      {
        type: "heading",
        text: "Security is a delivery property, not a brochure section",
      },
      {
        type: "paragraph",
        text: "Bespoke systems fail security reviews when authentication is improvised, production data appears in shared staging, secrets live in tickets, and authorisation is a hidden button. We treat those as project defects with the same seriousness as broken checkout flows. Early discovery captures data classes, identity requirements, admin surfaces and integration trust boundaries. Those inputs change architecture. Retrofitting tenancy or SSO after the schema hardens is far more expensive than designing for them.",
      },
      {
        type: "paragraph",
        text: "We do not claim ISO 27001 certification or Cyber Essentials certification as a substitute for project controls. Where clients require specific assurance frameworks, we work within their programmes and evidence project practices honestly — controls, logs, diagrams and test results — without theatre.",
      },
      {
        type: "paragraph",
        text: "Security conversations belong in the same rooms as workflow mapping. If only a questionnaire arrives after UI sign-off, expect expensive rework. Bring IdP constraints, hosting preferences and data classes to [enterprise discovery](/enterprise/contact) so the proving release already exercises identity, least privilege and audit rather than promising them later.",
      },
      {
        type: "heading",
        text: "Identity, sessions and privilege",
      },
      {
        type: "paragraph",
        text: "Prefer enterprise SSO (OIDC/SAML) when the client has an identity provider. Enforce MFA for privileged roles where the IdP supports it. Application sessions should be short-lived relative to risk, with refresh and revocation paths. Authorisation belongs in the service layer using a clear [RBAC/ABAC](/insights/rbac-vs-abac-permission-models) model. Break-glass accounts need time-boxing and audit. Shared passwords and long-lived personal tokens for server-to-server calls are treated as defects.",
      },
      {
        type: "paragraph",
        text: "Service-to-service credentials should be scoped to the minimum APIs required, rotated on a known cadence, and owned by a named role. Avoid a single “integration user” that can read every tenant. Where partners access portals, tenant context must be established at authentication and enforced on every query — the same discipline described for multi-site estates in our [enterprise](/enterprise) architecture work.",
      },
      {
        type: "heading",
        text: "Environments, secrets and data handling",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Separate development, staging and production with distinct credentials and network controls.",
          "Prohibit production personal data in shared non-production environments unless anonymised under agreement.",
          "Store secrets in a proper secret manager or environment mechanism — never in git.",
          "Rotate credentials that may have been exposed; automate where practical.",
          "Encrypt data in transit; encrypt sensitive data at rest according to platform capability and data class.",
          "Limit production access to named roles with joiner/leaver processes.",
        ],
      },
      {
        type: "paragraph",
        text: "Migration pipelines deserve the same scrutiny as the app: dump access, transit encryption and retention of interim files. See [legacy migration planning](/insights/how-to-plan-legacy-system-migration).",
      },
      {
        type: "paragraph",
        text: "Seed data and screenshots also leak. Redact demos, scrub ticket attachments, and keep staging datasets generated or anonymised. Engineers moving fast will paste customer rows into chat tools unless the operating rules make a safer path the easiest path. Put those rules in the delivery handbook, not only in a security appendix nobody opens.",
      },
      {
        type: "heading",
        text: "Application threat basics we design for",
      },
      {
        type: "code",
        language: "text",
        code: ` Trust boundaries (simplified)
 ----------------------------
 [Users] --TLS--> [Edge/WAF?] --TLS--> [App]
                                         |
                                   Authn/Authz
                                         |
                    +--------------------+------------------+
                    |                    |                  |
               Domain API           Job workers        Adapters
                    |                    |                  |
                 Postgres             Queues           Third parties
                    |
                 Audit store`,
      },
      {
        type: "paragraph",
        text: "We design against common failure classes: injection, CSRF on cookie sessions, SSRF via integrations, path traversal on uploads, insecure direct object references across tenants, and over-broad CORS. File uploads get type/size constraints and isolated storage. Exports of personal or commercial data are privileged, rate-aware and [audited](/insights/designing-audit-trails-operational-software). Dependency updates are part of maintenance, not an annual surprise.",
      },
      {
        type: "paragraph",
        text: "Threat modelling for bespoke operational software should be concrete: abuse cases against the ten privileged actions, not a generic OWASP poster. Walk the order override, the bulk export, the admin impersonation path and the integration callback. For each, name the control and the test that proves it. That catalogue becomes acceptance criteria inside [enterprise delivery](/enterprise/delivery).",
      },
      {
        type: "heading",
        text: "Secure delivery practices",
      },
      {
        type: "paragraph",
        text: "Pull requests, protected branches, CI checks and least-privilege deploy roles reduce accidental risk. Infrastructure as code makes reviews possible. Logging should avoid secrets and excessive personal data while retaining investigative value. Incident response needs named contacts, a severity rubric and a path to rotate credentials quickly. For offline or field components, device trust and local encryption enter the design — see [offline-first systems](/insights/offline-first-software-warehouses-field-teams).",
      },
      {
        type: "paragraph",
        text: "Dependency scanning and update cadence belong in the operating model. A bespoke system that freezes packages for eighteen months accumulates known vulnerabilities without anyone choosing that risk consciously. Schedule updates, test them, and keep a rollback path. Security is partly boredom executed on time.",
      },
      {
        type: "callout",
        title: "Honest assurance",
        text: "A secure project produces evidence: architecture diagrams, permission matrices, audit catalogues, environment diagrams and test results. Marketing claims without that evidence are not a control.",
      },
      {
        type: "heading",
        text: "How clients should engage us on security",
      },
      {
        type: "paragraph",
        text: "Bring existing policies, IdP constraints, hosting preferences and data classes to discovery. Share penetration-test requirements early so remediation windows exist before launch. Read [Security & Trust](/security), the [enterprise](/enterprise) overview and related [insights](/insights). Public [work](/work) shows operational systems where tenancy and permissions mattered. When you are ready for artefacts rather than slogans, start [enterprise discovery](/enterprise/contact) or review [custom systems](/custom-systems) and [/services](/services).",
      },
      {
        type: "paragraph",
        text: "If a third-party assessment is required, budget time for it as a phase with a freeze on risky changes while findings are triaged. Surfacing a pen test the week before cutover is how organisations choose between launching with known issues and slipping commercial dates. We would rather schedule the awkward work early than improvise under launch pressure.",
      },
      {
        type: "heading",
        text: "Frequently asked questions",
      },
      {
        type: "subheading",
        text: "Do you store customer data in training models?",
      },
      {
        type: "paragraph",
        text: "Project data is not treated as free training material. Provider usage, if any, follows contractual and technical controls agreed for the engagement. Default enterprise delivery does not require sending operational databases to generative models.",
      },
      {
        type: "subheading",
        text: "Can you work inside our cloud accounts?",
      },
      {
        type: "paragraph",
        text: "Yes, when IAM boundaries, access reviews and operational ownership are agreed. Deployment topology is a design choice — ScaleSmiths-managed, client cloud, or portable containers — as described in our enterprise architecture framing.",
      },
      {
        type: "subheading",
        text: "Will you sign our security questionnaire?",
      },
      {
        type: "paragraph",
        text: "We respond to proportionate questionnaires with accurate descriptions of project controls. We will not invent certifications or imply controls we do not operate.",
      },
      {
        type: "subheading",
        text: "How early should security specialists join?",
      },
      {
        type: "paragraph",
        text: "For high-sensitivity estates, involve client security during discovery. For others, founder-led engineering still applies the defaults above and escalates when residual risk needs specialist review.",
      },
      {
        type: "subheading",
        text: "What is the minimum bar for a proving release?",
      },
      {
        type: "paragraph",
        text: "Authenticated access, enforced authorisation on APIs, secrets out of source control, environment separation, basic audit for privileged actions, and a clear owner for production access. Broader controls follow risk — but those minima are not optional.",
      },
    ],
  }),
]
