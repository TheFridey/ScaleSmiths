import { createHash } from "node:crypto"
import { getActiveForgeDependencyPolicy, type ForgeDependencyPolicy } from "./forge-dependency-policy"

export type ForgeDependencyDecision = "admitted" | "warning" | "blocked"
export type ForgeVulnerabilitySeverity = "none" | "low" | "moderate" | "high" | "critical" | "unknown"

export interface ForgeDependencyAdmissionEntry {
  package: string
  dependencyPath: string
  direct: boolean
  dependencyType: "production" | "development" | "optional" | "transitive"
  requestedRange: string | null
  resolvedVersion: string
  source: string
  integrity: string | null
  licence: string
  vulnerabilityResult: { severity: ForgeVulnerabilitySeverity; advisoryCount: number; advisoryNames: string[] }
  policyDecision: ForgeDependencyDecision
  reason: string
  lifecycleScript: boolean
  nativeBinary: boolean
  policyVersion: string
  evidenceTimestamp: string
}

export interface ForgeDependencyAdmissionReport {
  schemaVersion: "1.0"
  status: "passed" | "failed"
  policyVersion: string
  evidenceTimestamp: string
  workspaceHash: string
  packageJsonHash: string
  lockfileHash: string
  sbomHash: string
  auditStatus: "passed" | "failed"
  auditError: string | null
  packageCount: number
  admittedCount: number
  warningCount: number
  blockedCount: number
  blockingReasons: string[]
  warnings: string[]
  dependencies: ForgeDependencyAdmissionEntry[]
}

export interface ForgeDependencyEvidence {
  report: ForgeDependencyAdmissionReport
  reportHash: string
  sbom: Record<string, unknown>
  sbomHash: string
  packageJsonHash: string
  lockfileHash: string
}

type JsonObject = Record<string, unknown>
type LockEntry = JsonObject & { version?: unknown; resolved?: unknown; integrity?: unknown; license?: unknown; deprecated?: unknown; link?: unknown; hasInstallScript?: unknown; gypfile?: unknown; os?: unknown; cpu?: unknown; dependencies?: unknown; optionalDependencies?: unknown; peerDependencies?: unknown }

export function buildForgeDependencyEvidence(input: {
  packageJson: string
  packageLock: string
  auditReport: unknown
  workspaceHash: string
  evidenceTimestamp?: string
  policy?: ForgeDependencyPolicy
}): ForgeDependencyEvidence {
  const policy = input.policy ?? getActiveForgeDependencyPolicy()
  const evidenceTimestamp = input.evidenceTimestamp ?? new Date().toISOString()
  const manifest = parseObject(input.packageJson, "package.json")
  const lock = parseObject(input.packageLock, "package-lock.json")
  const packages = objectValue(lock.packages)
  const root = objectValue(packages[""])
  if (lock.lockfileVersion !== 2 && lock.lockfileVersion !== 3) throw new Error("Generated package-lock.json must use lockfile version 2 or 3.")
  if (!Object.keys(packages).length || !Object.keys(root).length) throw new Error("Generated package-lock.json does not contain an exact package graph.")

  const packageJsonHash = sha256(input.packageJson)
  const lockfileHash = sha256(input.packageLock)
  const direct = directDependencies(manifest)
  const lockDirect = directDependencies(root)
  const structuralBlockers = [...compareDirectDependencyMaps(direct, lockDirect), ...validateManifestPolicy(manifest, direct, packages, policy)]
  const reachable = findReachablePackagePaths(packages, direct)
  const audit = normalizeAudit(input.auditReport)
  if (audit.error) structuralBlockers.push(`Vulnerability audit failed: ${audit.error}`)

  const dependencyRows = Object.entries(packages)
    .filter(([dependencyPath]) => dependencyPath !== "")
    .map(([dependencyPath, value]) => analysePackage({ dependencyPath, entry: objectValue(value) as LockEntry, direct, reachable, audit, policy, evidenceTimestamp }))
    .sort((left, right) => left.dependencyPath.localeCompare(right.dependencyPath))

  if (dependencyRows.length > policy.maximumPackageCount) structuralBlockers.push(`Package count ${dependencyRows.length} exceeds the policy maximum of ${policy.maximumPackageCount}.`)
  const blocked = dependencyRows.filter((item) => item.policyDecision === "blocked")
  const warnings = dependencyRows.filter((item) => item.policyDecision === "warning")
  const rootName = stringValue(manifest.name) || "generated-forge-site"
  const sbom = buildSpdxSbom({ rootName, rootVersion: stringValue(manifest.version) || "0.0.0", workspaceHash: input.workspaceHash, lockfileHash, policyVersion: policy.version, evidenceTimestamp, dependencies: dependencyRows })
  const sbomHash = hashCanonicalJson(sbom)
  const blockingReasons = [...new Set([...structuralBlockers, ...blocked.map((item) => `${item.package}@${item.resolvedVersion}: ${item.reason}`)])]
  const report: ForgeDependencyAdmissionReport = {
    schemaVersion: "1.0",
    status: blockingReasons.length ? "failed" : "passed",
    policyVersion: policy.version,
    evidenceTimestamp,
    workspaceHash: input.workspaceHash,
    packageJsonHash,
    lockfileHash,
    sbomHash,
    auditStatus: audit.error ? "failed" : "passed",
    auditError: audit.error,
    packageCount: dependencyRows.length,
    admittedCount: dependencyRows.filter((item) => item.policyDecision === "admitted").length,
    warningCount: warnings.length,
    blockedCount: blocked.length + structuralBlockers.length,
    blockingReasons,
    warnings: warnings.map((item) => `${item.package}@${item.resolvedVersion}: ${item.reason}`),
    dependencies: dependencyRows,
  }
  return { report, reportHash: hashCanonicalJson(report), sbom, sbomHash, packageJsonHash, lockfileHash }
}

export function verifyForgeDependencyEvidence(input: {
  report: unknown
  reportHash: string | null | undefined
  sbom: unknown
  sbomHash: string | null | undefined
  packageJson: string
  packageLock: string
  workspaceHash: string
  storedPackageJsonHash?: string | null
  storedLockfileHash?: string | null
  storedPolicyVersion?: string | null
  storedEvidenceTimestamp?: string | null
  now?: Date
  policy?: ForgeDependencyPolicy
}) {
  const errors: string[] = []
  const policy = input.policy ?? getActiveForgeDependencyPolicy()
  const report = objectValue(input.report) as Partial<ForgeDependencyAdmissionReport>
  const sbom = objectValue(input.sbom)
  const packageJsonHash = sha256(input.packageJson)
  const lockfileHash = sha256(input.packageLock)
  if (!input.reportHash || hashCanonicalJson(input.report) !== input.reportHash) errors.push("Dependency-admission report hash does not match its stored evidence.")
  if (!input.sbomHash || hashCanonicalJson(input.sbom) !== input.sbomHash) errors.push("Generated-site SBOM hash does not match its stored evidence.")
  if (report.packageJsonHash !== packageJsonHash) errors.push("Generated package.json changed after dependency admission.")
  if (report.lockfileHash !== lockfileHash) errors.push("Generated package-lock.json changed after dependency admission.")
  if (input.storedPackageJsonHash !== undefined && input.storedPackageJsonHash !== report.packageJsonHash) errors.push("Candidate package.json hash does not match the dependency report.")
  if (input.storedLockfileHash !== undefined && input.storedLockfileHash !== report.lockfileHash) errors.push("Candidate lockfile hash does not match the dependency report.")
  if (input.storedPolicyVersion !== undefined && input.storedPolicyVersion !== report.policyVersion) errors.push("Candidate policy version does not match the dependency report.")
  if (input.storedEvidenceTimestamp !== undefined && input.storedEvidenceTimestamp !== report.evidenceTimestamp) errors.push("Candidate evidence timestamp does not match the dependency report.")
  if (report.workspaceHash !== input.workspaceHash) errors.push("Dependency evidence is bound to a different workspace hash.")
  if (report.sbomHash !== input.sbomHash) errors.push("Dependency report and generated-site SBOM hashes do not agree.")
  if (report.policyVersion !== policy.version) errors.push(`Dependency policy ${String(report.policyVersion ?? "missing")} is no longer active; regenerate candidate evidence with ${policy.version}.`)
  if (report.status !== "passed" || Number(report.blockedCount ?? 0) > 0) errors.push("Dependency admission did not pass for every locked package.")
  if (report.auditStatus !== "passed") errors.push("Known-vulnerability audit evidence is missing or failed.")
  if (sbom.spdxVersion !== "SPDX-2.3" || sbom.dataLicense !== "CC0-1.0") errors.push("Generated-site SBOM is not valid SPDX JSON evidence.")
  const comment = stringValue(objectValue(sbom.creationInfo).comment)
  if (!comment.includes(input.workspaceHash) || !comment.includes(lockfileHash) || !comment.includes(policy.version)) errors.push("Generated-site SBOM is not bound to the candidate workspace, lockfile and policy.")
  const createdAt = Date.parse(String(report.evidenceTimestamp ?? ""))
  const ageMs = (input.now ?? new Date()).getTime() - createdAt
  if (!Number.isFinite(createdAt) || ageMs < 0 || ageMs > policy.evidenceMaximumAgeHours * 60 * 60 * 1000) errors.push(`Dependency evidence is older than the ${policy.evidenceMaximumAgeHours}-hour admission window.`)
  return { valid: errors.length === 0, errors, report: report as ForgeDependencyAdmissionReport }
}

function analysePackage(input: { dependencyPath: string; entry: LockEntry; direct: Map<string, { range: string; type: ForgeDependencyAdmissionEntry["dependencyType"] }>; reachable: Set<string>; audit: ReturnType<typeof normalizeAudit>; policy: ForgeDependencyPolicy; evidenceTimestamp: string }): ForgeDependencyAdmissionEntry {
  const name = packageNameFromPath(input.dependencyPath)
  const version = stringValue(input.entry.version) || "UNKNOWN"
  const directRule = input.dependencyPath === `node_modules/${name}` ? input.direct.get(name) : undefined
  const reasons: string[] = []
  const warnings: string[] = []
  const source = dependencySource(input.entry)
  const licence = stringValue(input.entry.license) || "NOASSERTION"
  const vulnerability = input.audit.byPackage.get(name) ?? { severity: "none" as const, advisoryCount: 0, advisoryNames: [] }
  const nativeBinary = Boolean(input.entry.gypfile || input.entry.os || input.entry.cpu || /^(?:@next\/swc-|@img\/|sharp$|fsevents$)/.test(name))
  const lifecycleScript = input.entry.hasInstallScript === true

  if (!input.reachable.has(input.dependencyPath)) reasons.push("Lockfile entry is extraneous or unreachable from the generated manifest.")
  if (input.policy.blockedPackages.includes(name)) reasons.push("Package is explicitly blocked by policy.")
  if (!sourceAllowed(source, input.policy)) reasons.push(`Dependency source ${source} is prohibited.`)
  if (source.startsWith("https://") && !stringValue(input.entry.integrity)) reasons.push("Registry package is missing lockfile integrity evidence.")
  const licenceDecision = evaluateLicence(licence, input.policy)
  if (!licenceDecision.allowed) reasons.push(licenceDecision.reason)
  if (nativeBinary && !reviewedNativePackage(name, version, input.policy)) reasons.push("Native or platform-specific package has not received explicit review.")
  if (lifecycleScript && !reviewedNativePackage(name, version, input.policy)) reasons.push("Dependency lifecycle scripts are prohibited unless the package/version is explicitly reviewed.")
  if (input.policy.blockingVulnerabilitySeverities.includes(vulnerability.severity as "high" | "critical")) reasons.push(`${vulnerability.severity} known vulnerability evidence blocks admission.`)
  if (vulnerability.severity === "unknown") reasons.push("Vulnerability severity could not be classified safely.")
  if (input.policy.warningVulnerabilitySeverities.includes(vulnerability.severity as "low" | "moderate")) warnings.push(`${vulnerability.severity} vulnerability requires review but is below the blocking threshold.`)
  if (stringValue(input.entry.deprecated)) warnings.push("Package version is marked deprecated by its registry metadata.")

  if (directRule) {
    const rule = input.policy.approvedPackages[name]
    if (!rule) reasons.push("Direct dependency is not on the approved package allowlist.")
    else {
      if (!rule.manifestRanges.includes(directRule.range)) reasons.push(`Requested range ${directRule.range} is not an approved manifest range.`)
      if (!versionInBounds(version, rule.minimumVersion, rule.maximumVersionExclusive)) reasons.push(`Resolved version ${version} is outside the approved range.`)
      if (Date.parse(input.evidenceTimestamp) - Date.parse(rule.reviewedAt) > input.policy.maximumReviewAgeDays * 86_400_000) warnings.push(`Package review is older than ${input.policy.maximumReviewAgeDays} days.`)
    }
  } else if (!input.policy.approvedTransitiveVersions[name]?.includes(version)) {
    reasons.push("Transitive package name and exact version are not on the reviewed lock-graph allowlist.")
  }

  const policyDecision: ForgeDependencyDecision = reasons.length ? "blocked" : warnings.length ? "warning" : "admitted"
  return {
    package: name,
    dependencyPath: input.dependencyPath,
    direct: Boolean(directRule),
    dependencyType: directRule?.type ?? "transitive",
    requestedRange: directRule?.range ?? null,
    resolvedVersion: version,
    source,
    integrity: stringValue(input.entry.integrity) || null,
    licence,
    vulnerabilityResult: vulnerability,
    policyDecision,
    reason: [...reasons, ...warnings].join(" ") || "Package is reachable from an approved dependency and satisfies source, licence, vulnerability, lifecycle and native-code policy.",
    lifecycleScript,
    nativeBinary,
    policyVersion: input.policy.version,
    evidenceTimestamp: input.evidenceTimestamp,
  }
}

function buildSpdxSbom(input: { rootName: string; rootVersion: string; workspaceHash: string; lockfileHash: string; policyVersion: string; evidenceTimestamp: string; dependencies: ForgeDependencyAdmissionEntry[] }): Record<string, unknown> {
  const rootId = "SPDXRef-RootPackage"
  const packages = [{ name: input.rootName, SPDXID: rootId, versionInfo: input.rootVersion, downloadLocation: "NOASSERTION", filesAnalyzed: false, licenseConcluded: "NOASSERTION", licenseDeclared: "NOASSERTION", copyrightText: "NOASSERTION" }, ...input.dependencies.map((item) => ({
    name: item.package,
    SPDXID: spdxId(item.dependencyPath),
    versionInfo: item.resolvedVersion,
    downloadLocation: item.source.startsWith("https://") ? item.source : "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: item.licence,
    copyrightText: "NOASSERTION",
    ...spdxChecksums(item.integrity),
    externalRefs: [{ referenceCategory: "PACKAGE-MANAGER", referenceType: "purl", referenceLocator: `pkg:npm/${encodeURIComponent(item.package)}@${encodeURIComponent(item.resolvedVersion)}` }],
  }))]
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `${input.rootName}-forge-generated-site`,
    documentNamespace: `https://scalesmiths.co.uk/spdx/forge/${input.workspaceHash}/${input.lockfileHash}`,
    creationInfo: { created: input.evidenceTimestamp, creators: ["Organization: ScaleSmiths", `Tool: ScaleSmiths Forge dependency admission ${input.policyVersion}`], comment: `workspace-sha256=${input.workspaceHash}; lockfile-sha256=${input.lockfileHash}; policy=${input.policyVersion}` },
    packages,
    relationships: [{ spdxElementId: "SPDXRef-DOCUMENT", relatedSpdxElement: rootId, relationshipType: "DESCRIBES" }, ...input.dependencies.map((item) => ({ spdxElementId: rootId, relatedSpdxElement: spdxId(item.dependencyPath), relationshipType: "DEPENDS_ON" }))],
  }
}

function spdxChecksums(integrity: string | null) {
  if (!integrity) return {}
  const match = /^(sha1|sha256|sha384|sha512)-([A-Za-z0-9+/=]+)$/.exec(integrity)
  if (!match) return {}
  return { checksums: [{ algorithm: match[1].toUpperCase(), checksumValue: Buffer.from(match[2], "base64").toString("hex") }] }
}

function normalizeAudit(value: unknown) {
  const report = objectValue(value)
  const errorObject = objectValue(report.error)
  const metadataVulnerabilities = objectValue(objectValue(report.metadata).vulnerabilities)
  const schemaError = report.auditReportVersion !== 2 || !("vulnerabilities" in report) || !Object.keys(metadataVulnerabilities).length ? "npm audit returned unsupported or incomplete evidence." : null
  const error = stringValue(errorObject.summary) || stringValue(errorObject.message) || (Object.keys(errorObject).length ? "npm audit returned an error." : schemaError)
  const byPackage = new Map<string, ForgeDependencyAdmissionEntry["vulnerabilityResult"]>()
  for (const [name, raw] of Object.entries(objectValue(report.vulnerabilities))) {
    const item = objectValue(raw)
    const severity = normalizeSeverity(item.severity)
    const via = Array.isArray(item.via) ? item.via : []
    const advisoryNames = via.flatMap((entry) => typeof entry === "string" ? [entry] : [stringValue(objectValue(entry).title) || stringValue(objectValue(entry).name)]).filter(Boolean)
    byPackage.set(name, { severity, advisoryCount: Math.max(via.length, severity === "none" ? 0 : 1), advisoryNames })
  }
  return { error, byPackage }
}

function directDependencies(value: JsonObject) {
  const result = new Map<string, { range: string; type: ForgeDependencyAdmissionEntry["dependencyType"] }>()
  for (const [field, type] of [["dependencies", "production"], ["devDependencies", "development"], ["optionalDependencies", "optional"]] as const) {
    for (const [name, range] of Object.entries(objectValue(value[field]))) if (typeof range === "string") result.set(name, { range, type })
  }
  return result
}

function compareDirectDependencyMaps(manifest: ReturnType<typeof directDependencies>, lock: ReturnType<typeof directDependencies>) {
  const errors: string[] = []
  for (const [name, spec] of manifest) {
    const locked = lock.get(name)
    if (!locked) errors.push(`Lockfile is missing direct dependency ${name}.`)
    else if (locked.range !== spec.range || locked.type !== spec.type) errors.push(`Lockfile declaration for ${name} does not match package.json.`)
  }
  for (const name of lock.keys()) if (!manifest.has(name)) errors.push(`Lockfile root contains undeclared dependency ${name}.`)
  return errors
}

function validateManifestPolicy(manifest: JsonObject, direct: ReturnType<typeof directDependencies>, packages: JsonObject, policy: ForgeDependencyPolicy) {
  const errors: string[] = []
  for (const [name, spec] of direct) {
    const rule = policy.approvedPackages[name]
    if (!rule) errors.push(`Direct dependency ${name} is not on the approved package allowlist.`)
    else if (!rule.manifestRanges.includes(spec.range)) errors.push(`Direct dependency ${name} uses unapproved range ${spec.range}.`)
    if (/^(?:git\+|git:|github:|https?:|file:|link:|workspace:)|^[^@/]+\/[^/]+#?/i.test(spec.range)) errors.push(`Direct dependency ${name} uses a prohibited Git, file, link, workspace or tarball source.`)
    if (!resolveLockedDependencyPath("", name, packages)) errors.push(`Lockfile has no resolved package entry for direct dependency ${name}.`)
  }
  const scripts = objectValue(manifest.scripts)
  for (const name of ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly", "prepack", "postpack"]) if (typeof scripts[name] === "string") errors.push(`Generated-site lifecycle script ${name} is prohibited.`)
  return errors
}

function findReachablePackagePaths(packages: JsonObject, direct: ReturnType<typeof directDependencies>) {
  const reachable = new Set<string>()
  const queue: string[] = []
  for (const name of direct.keys()) { const resolved = resolveLockedDependencyPath("", name, packages); if (resolved) queue.push(resolved) }
  while (queue.length) {
    const dependencyPath = queue.shift()!
    if (reachable.has(dependencyPath)) continue
    reachable.add(dependencyPath)
    const entry = objectValue(packages[dependencyPath])
    const names = new Set([...Object.keys(objectValue(entry.dependencies)), ...Object.keys(objectValue(entry.optionalDependencies)), ...Object.keys(objectValue(entry.peerDependencies))])
    for (const name of names) { const resolved = resolveLockedDependencyPath(dependencyPath, name, packages); if (resolved && !reachable.has(resolved)) queue.push(resolved) }
  }
  return reachable
}

function resolveLockedDependencyPath(parentPath: string, name: string, packages: JsonObject) {
  let current = parentPath
  while (true) {
    const candidate = current ? `${current}/node_modules/${name}` : `node_modules/${name}`
    if (candidate in packages) return candidate
    if (!current) break
    const index = current.lastIndexOf("/node_modules/")
    current = index < 0 ? "" : current.slice(0, index)
  }
  return null
}

function dependencySource(entry: LockEntry) {
  if (entry.link === true) return "file:link"
  const resolved = stringValue(entry.resolved)
  if (!resolved) return "registry:inferred-from-lockfile"
  return resolved
}

function sourceAllowed(source: string, policy: ForgeDependencyPolicy) {
  if (source === "registry:inferred-from-lockfile") return true
  if (/^(?:git\+|git:|github:|file:|link:|workspace:)/i.test(source)) return false
  try { const url = new URL(source); return url.protocol === "https:" && policy.allowedRegistries.includes(url.origin) } catch { return false }
}

function evaluateLicence(licence: string, policy: ForgeDependencyPolicy) {
  if (!licence || licence === "NOASSERTION" || licence === "UNLICENSED") return { allowed: false, reason: "Package licence is missing or unasserted." }
  const identifiers = licence.match(/[A-Za-z0-9.-]+/g)?.filter((item) => !["AND", "OR", "WITH"].includes(item)) ?? []
  const denied = identifiers.find((item) => policy.deniedLicenceIdentifiers.includes(item))
  if (denied) return { allowed: false, reason: `Licence ${denied} is on the denylist.` }
  const unapproved = identifiers.find((item) => !policy.allowedLicenceIdentifiers.includes(item))
  if (unapproved) return { allowed: false, reason: `Licence ${unapproved} is not on the allowlist.` }
  return { allowed: identifiers.length > 0, reason: identifiers.length ? "Licence is approved." : "Package licence could not be parsed." }
}

function reviewedNativePackage(name: string, version: string, policy: ForgeDependencyPolicy) {
  return policy.reviewedNativePackages.some((rule) => globMatches(rule.pattern, name) && versionInBounds(version, rule.minimumVersion, rule.maximumVersionExclusive))
}

function globMatches(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
  return new RegExp(`^${escaped}$`).test(value)
}

function versionInBounds(version: string, minimum: string, maximumExclusive: string) {
  return compareVersions(version, minimum) >= 0 && compareVersions(version, maximumExclusive) < 0
}

function compareVersions(left: string, right: string) {
  const a = parseVersion(left); const b = parseVersion(right)
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index]
  return 0
}

function parseVersion(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [-1, -1, -1]
}

function packageNameFromPath(dependencyPath: string) {
  const marker = "node_modules/"
  const index = dependencyPath.lastIndexOf(marker)
  return dependencyPath.slice(index + marker.length)
}

function spdxId(value: string) { return `SPDXRef-Package-${sha256(value).slice(0, 20)}` }
function normalizeSeverity(value: unknown): ForgeVulnerabilitySeverity { return value === "low" || value === "moderate" || value === "high" || value === "critical" ? value : value ? "unknown" : "none" }
function parseObject(value: string, name: string) { try { return objectValue(JSON.parse(value)) } catch { throw new Error(`Generated ${name} is not valid JSON.`) } }
function objectValue(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {} }
function stringValue(value: unknown) { return typeof value === "string" ? value : "" }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex") }
export function hashCanonicalJson(value: unknown): string { return sha256(stableJson(value)) }
function stableJson(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined"; if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; return `{${Object.entries(value as JsonObject).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}` }
