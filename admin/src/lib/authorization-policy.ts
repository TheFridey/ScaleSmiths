import type { Capability } from "./rbac"

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]
export type AuthorizationScope = "global" | "client" | "forge-project" | "forge-run" | "resource-owner" | "self"

export interface AuthorizationExpectation {
  id: string
  route: string
  method: HttpMethod
  domain: string
  capability: Capability | null
  scope: AuthorizationScope
  scopeRule: string
  authenticated: boolean
  allow: string
  deny: string
}

type PolicyRule = Omit<AuthorizationExpectation, "route" | "method" | "capability"> & {
  route: RegExp
  methods: readonly HttpMethod[]
  capability: Capability | null | ((method: HttpMethod, pathname: string) => Capability | null)
}

const readWrite = (read: Capability, write: Capability) => (method: HttpMethod) =>
  (["GET", "HEAD", "OPTIONS"] as readonly HttpMethod[]).includes(method) ? read : write

const rule = (value: PolicyRule) => value

/**
 * Authoritative, ordered authorization policy for admin HTTP surfaces.
 * Rules are explicit by operation family; route discovery tests prove that every exported
 * handler is covered. More-sensitive rules must precede broader domain rules.
 */
export const AUTHORIZATION_POLICY = [
  rule({ id: "auth.protocol", route: /^\/api\/auth(?:\/|$)/, methods: HTTP_METHODS, domain: "identity", capability: null, scope: "self", scopeRule: "Auth.js protocol controls apply.", authenticated: false, allow: "Protocol-valid request proceeds.", deny: "Auth.js rejects invalid credentials or protocol state." }),
  rule({ id: "health.container", route: /^\/api\/health$/, methods: ["GET"], domain: "operations", capability: null, scope: "global", scopeRule: "Constant-time infrastructure token is checked by the handler.", authenticated: false, allow: "Valid health probe succeeds.", deny: "Missing or invalid probe token is rejected." }),
  rule({ id: "monitoring.self-test", route: /^\/api\/monitoring\/self-test$/, methods: ["POST"], domain: "operations", capability: null, scope: "global", scopeRule: "Dedicated monitoring token is checked by the handler.", authenticated: false, allow: "Valid monitoring probe succeeds.", deny: "Missing or invalid monitoring token is rejected." }),
  rule({ id: "security.logout", route: /^\/api\/security\/logout$/, methods: ["POST"], domain: "identity", capability: null, scope: "self", scopeRule: "Only the authenticated session is revoked.", authenticated: true, allow: "Any current admin may end their own session.", deny: "Unauthenticated request returns 401." }),
  rule({ id: "security.mfa", route: /^\/api\/security\/mfa$/, methods: ["GET", "POST"], domain: "identity", capability: "settings.manage", scope: "self", scopeRule: "MFA operation is bound to the current admin identity.", authenticated: true, allow: "settings.manage succeeds.", deny: "Unauthenticated returns 401; missing capability returns 403." }),
  rule({ id: "admin-users.collection", route: /^\/api\/admin-users$/, methods: ["GET", "POST"], domain: "identity", capability: readWrite("admin_users.read", "admin_users.manage"), scope: "global", scopeRule: "Owner assignment additionally requires admin_users.owner.assign.", authenticated: true, allow: "Required capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "admin-users.member", route: /^\/api\/admin-users\/[^/]+$/, methods: ["PATCH"], domain: "identity", capability: "admin_users.manage", scope: "resource-owner", scopeRule: "Credential reset/MFA invalidation additionally requires admin_users.credentials.reset; protected identity fields use dedicated service validation.", authenticated: true, allow: "Account changes with required capability succeed.", deny: "401 unauthenticated; 403 insufficient capability; protected changes are rejected." }),
  rule({ id: "portal-users.collection", route: /^\/api\/portal-users$/, methods: ["GET", "POST"], domain: "portal-accounts", capability: readWrite("portal_users.read", "portal_users.manage"), scope: "client", scopeRule: "Portal account must reference an explicit portal client association.", authenticated: true, allow: "Required capability succeeds for an explicitly linked account.", deny: "401/403; invalid or missing client link is rejected." }),
  rule({ id: "portal-users.member", route: /^\/api\/portal-users\/[^/]+$/, methods: ["PATCH"], domain: "portal-accounts", capability: "portal_users.manage", scope: "client", scopeRule: "Credential reset additionally requires portal_users.credentials.reset and cannot be combined with account edits.", authenticated: true, allow: "Scoped account edit succeeds.", deny: "401/403; mixed credential/account change is rejected." }),
  rule({ id: "claims", route: /^\/api\/claims(?:\/[^/]+)?$/, methods: ["GET", "POST", "PATCH"], domain: "claims", capability: readWrite("claims.read", "claims.manage"), scope: "global", scopeRule: "Claim identifier selects an approved public-claim record.", authenticated: true, allow: "Required capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "client-analytics", route: /^\/api\/clients\/[^/]+\/analytics$/, methods: ["GET", "POST"], domain: "reporting", capability: readWrite("analytics.read", "analytics.write"), scope: "client", scopeRule: "Client id constrains every analytics query/write.", authenticated: true, allow: "Capability and client scope succeed.", deny: "401/403; unknown or foreign client is rejected." }),
  rule({ id: "client-finance", route: /^\/api\/clients\/[^/]+\/(?:invoice-code|billing)$/, methods: ["PATCH"], domain: "finance", capability: "finance.write", scope: "client", scopeRule: "Client id selects billing identity; generic client updates cannot edit protected billing identifiers.", authenticated: true, allow: "finance.write succeeds.", deny: "401/403; protected identifier changes through generic routes are ignored/rejected." }),
  rule({ id: "clients", route: /^\/api\/clients(?:\/[^/]+)?$/, methods: ["GET", "POST", "PATCH"], domain: "client-management", capability: readWrite("clients.read", "clients.write"), scope: "client", scopeRule: "Specific operations are bound to the route client id; portal_client_id and invoice_client_code are protected.", authenticated: true, allow: "Required capability succeeds.", deny: "401/403; protected identifiers cannot be edited generically." }),
  rule({ id: "client-requests", route: /^\/api\/client-requests\/[^/]+(?:\/(?:messages|timeline))?$/, methods: ["PATCH", "POST"], domain: "client-management", capability: "clients.write", scope: "client", scopeRule: "Request id resolves to its owning client before mutation.", authenticated: true, allow: "clients.write on the scoped request succeeds.", deny: "401/403; unknown request cannot be used to cross client scope." }),
  rule({ id: "prospects", route: /^\/api\/prospects(?:\/[^/]+)?(?:\/(?:activities|lead-score))?$/, methods: ["GET", "POST", "PATCH"], domain: "sales", capability: readWrite("leads.read", "leads.write"), scope: "global", scopeRule: "Nested operations remain bound to the selected prospect id.", authenticated: true, allow: "Required capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "proposals", route: /^\/api\/proposals(?:\/[^/]+)?$/, methods: ["GET", "POST", "PATCH"], domain: "sales", capability: readWrite("leads.read", "leads.write"), scope: "global", scopeRule: "Proposal id is validated by the proposal service.", authenticated: true, allow: "Required capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "finance", route: /^\/api\/(?:invoices|invoice-catalogue|invoice-settings)(?:\/[^/]+)?(?:\/(?:delivery|pdf))?$/, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], domain: "finance", capability: readWrite("finance.read", "finance.write"), scope: "client", scopeRule: "Invoice access is bound to invoice/client records; immutable snapshots and publication state are service-enforced.", authenticated: true, allow: "Required finance capability succeeds.", deny: "401/403; missing invoice/client ownership returns domain-safe failure." }),
  rule({ id: "monthly-reports", route: /^\/api\/monthly-reports(?:\/[^/]+)?$/, methods: ["GET", "POST", "PATCH"], domain: "reporting", capability: readWrite("finance.read", "finance.write"), scope: "client", scopeRule: "Report id is resolved with its client association.", authenticated: true, allow: "Required finance capability succeeds.", deny: "401/403; invalid client/report association is rejected." }),
  rule({ id: "delivery-projects", route: /^\/api\/projects(?:\/[^/]+)?(?:\/(?:milestones|deliverables|resources|decisions)(?:\/[^/]+)?)?$/, methods: ["GET", "POST", "PATCH"], domain: "delivery", capability: readWrite("projects.read", "projects.write"), scope: "client", scopeRule: "Every nested record is resolved through its delivery project and owning client; Forge and deployment links must belong to the same client/project graph.", authenticated: true, allow: "Required project capability and ownership checks succeed.", deny: "401/403; unknown or cross-project identifiers and invalid lifecycle transitions are rejected." }),
  rule({ id: "kanban", route: /^\/api\/kanban(?:\/[^/]+)?$/, methods: ["GET", "POST", "PATCH"], domain: "project-management", capability: readWrite("projects.read", "projects.write"), scope: "global", scopeRule: "Card id is validated by the kanban service.", authenticated: true, allow: "Required project capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "operations", route: /^\/api\/operations\/(?:brief|capacity)$/, methods: ["POST"], domain: "operations", capability: "projects.write", scope: "global", scopeRule: "Operation is generated for authorised internal project data.", authenticated: true, allow: "projects.write succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "forge.audit", route: /^\/api\/forge\/(?:ai-usage\/export|approval-intelligence|economics\/export|human-edits)$/, methods: ["GET"], domain: "forge-audit", capability: "audit.read", scope: "global", scopeRule: "Optional project/client filters narrow results and never broaden access.", authenticated: true, allow: "audit.read succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "forge.reconciliation", route: /^\/api\/forge\/reconciliation$/, methods: ["GET", "POST"], domain: "forge-configuration", capability: readWrite("audit.read", "forge.configure"), scope: "global", scopeRule: "Reconciliation mutations are configuration-authority operations.", authenticated: true, allow: "Required capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "forge.deploy", route: /^\/api\/forge\/projects\/[^/]+\/(?:deploy|deployment-candidates)$/, methods: ["GET", "POST"], domain: "release-deployment", capability: (method, path) => path.endsWith("/deployment-candidates") && method === "GET" ? "forge.read" : "deployments.execute", scope: "forge-project", scopeRule: "Project id and deployment candidate evidence must match; release gates remain fail closed.", authenticated: true, allow: "Read or deployment capability succeeds for the project.", deny: "401/403; stale, foreign, or unapproved candidate is rejected." }),
  rule({ id: "forge.integrations", route: /^\/api\/forge\/projects\/[^/]+\/integrations\/[^/]+$/, methods: ["PATCH"], domain: "forge-configuration", capability: "forge.configure", scope: "forge-project", scopeRule: "Integration configuration is bound to the Forge project.", authenticated: true, allow: "forge.configure succeeds.", deny: "401/403; cross-project configuration is rejected." }),
  rule({ id: "forge.approvals", route: /^\/api\/forge\/projects\/[^/]+\/(?:sitemap|copy|design|design-system|component-spec|visual-critique)$/, methods: ["PATCH"], domain: "forge-approval", capability: "forge.approve", scope: "forge-project", scopeRule: "Approval applies only to the named project artifact/version.", authenticated: true, allow: "forge.approve succeeds.", deny: "401/403; artifact/project mismatch is rejected." }),
  rule({ id: "forge.migration-decision", route: /^\/api\/forge\/projects\/[^/]+\/migration-execution$/, methods: ["PATCH"], domain: "release-deployment", capability: "forge.approve", scope: "forge-project", scopeRule: "Rollback/export approval requires forge.approve; deployment action additionally requires deployments.execute in the handler.", authenticated: true, allow: "Action-specific capability and project candidate match succeed.", deny: "401/403; invalid action or candidate mismatch is rejected." }),
  rule({ id: "forge.projects", route: /^\/api\/forge\/projects(?:\/[^/]+)?$/, methods: ["GET", "POST", "PATCH"], domain: "forge-projects", capability: readWrite("projects.read", "projects.write"), scope: "forge-project", scopeRule: "Member operations bind to the named project id.", authenticated: true, allow: "Required project capability succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
  rule({ id: "forge.read", route: /^\/api\/forge\/(?:ai\/health|jobs\/[^/]+|projects\/[^/]+\/(?:artifacts\/[^/]+|clarifications|command-chat|intake|preview|workflow-plan|runs\/current))$/, methods: ["GET"], domain: "forge", capability: "forge.read", scope: "forge-project", scopeRule: "Read is constrained by the project/job/artifact identifier in the route.", authenticated: true, allow: "forge.read succeeds.", deny: "401/403; identifier mismatch or missing resource is rejected." }),
  rule({ id: "forge.run-read", route: /^\/api\/forge\/runs\/[^/]+$/, methods: ["GET"], domain: "forge", capability: "forge.read", scope: "forge-run", scopeRule: "Run id resolves to its owning project workflow.", authenticated: true, allow: "forge.read succeeds for the run.", deny: "401/403; unknown or cross-project run is rejected." }),
  rule({ id: "forge.execute", route: /^\/api\/forge(?:\/.*)?$/, methods: ["POST", "PATCH", "DELETE"], domain: "forge", capability: "forge.execute", scope: "forge-project", scopeRule: "Project/run/job/task identifiers are resolved server-side and must belong to the same workflow graph.", authenticated: true, allow: "forge.execute succeeds, subject to action-specific stronger rules above.", deny: "401/403; cross-project/run identifiers and invalid transitions are rejected." }),
  rule({ id: "forge.health", route: /^\/api\/forge\/health$/, methods: ["GET"], domain: "forge", capability: "forge.read", scope: "global", scopeRule: "Authenticated Forge health details only.", authenticated: true, allow: "forge.read succeeds.", deny: "401 unauthenticated; 403 insufficient capability." }),
] as const satisfies readonly PolicyRule[]

export function authorizationExpectation(pathname: string, methodValue: string): AuthorizationExpectation | null {
  const method = methodValue.toUpperCase() as HttpMethod
  if (!(HTTP_METHODS as readonly string[]).includes(method)) return null
  for (const policy of AUTHORIZATION_POLICY) {
    if (!policy.methods.includes(method) || !policy.route.test(pathname)) continue
    return { ...policy, route: pathname, method, capability: typeof policy.capability === "function" ? policy.capability(method, pathname) : policy.capability }
  }
  return null
}
