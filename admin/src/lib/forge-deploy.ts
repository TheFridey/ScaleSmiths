import type { JsonValue } from "./forge-ai"
import type { ForgeQaStatus } from "./forge-qa"
import type { ForgeVisualQaStatus } from "./forge-visual-qa"

export const FORGE_DEPLOY_ARTIFACT_TITLE = "Deployment Notes"
export const FORGE_DEPLOY_ARTIFACT_KIND = "forge_deployment_notes"

export type ForgeDeployMethod = "manual" | "vps" | "github"
export type ForgeDeployLifecycle = "draft" | "ready" | "deployed"

/**
 * Deployment methods are described as data so future automatic methods can be added without
 * changing callers. `automated: false` for every V1 method — ScaleSmiths never mutates a client
 * server automatically. Each method only generates instructions, config files, and a checklist.
 */
export const FORGE_DEPLOY_METHODS: { id: ForgeDeployMethod; label: string; description: string; automated: boolean }[] = [
  { id: "manual", label: "Manual export & deploy", description: "Export the site and follow host-agnostic deploy instructions.", automated: false },
  { id: "vps", label: "VPS deployment package", description: "Generate Dockerfile, nginx, systemd, and a deploy script to run on your own VPS.", automated: false },
  { id: "github", label: "GitHub repo push (placeholder)", description: "Generate a repo + CI workflow you push manually. ScaleSmiths does not push on your behalf.", automated: false },
]

export function isForgeDeployMethod(value: unknown): value is ForgeDeployMethod {
  return value === "manual" || value === "vps" || value === "github"
}

/* ── checklist ──────────────────────────────────────────────────────── */

export type ForgeDeployChecklistKey =
  | "domain"
  | "env_vars"
  | "resend_verified"
  | "whatsapp_confirmed"
  | "analytics_configured"
  | "sitemap_submitted"
  | "build_passing"
  | "lighthouse_accepted"

export type ForgeDeployChecklistStatus = "passed" | "pending" | "failed" | "skipped"
export type ForgeDeployChecklistSource = "auto" | "manual"

export interface ForgeDeployChecklistItem extends Record<string, JsonValue> {
  key: ForgeDeployChecklistKey
  label: string
  status: ForgeDeployChecklistStatus
  detail: string
  source: ForgeDeployChecklistSource
}

// Manual confirmations the admin ticks off; build_passing is never manual.
export type ForgeDeployManualKey = Exclude<ForgeDeployChecklistKey, "build_passing">

export type ForgeDeployConfirmations = Record<ForgeDeployManualKey, boolean>

export interface ForgeDeploySignals {
  hasGeneratedSite: boolean
  qaStatus: ForgeQaStatus | null
  lighthouseStatus: ForgeVisualQaStatus | null
  resendEnabled: boolean
  whatsappEnabled: boolean
  analyticsEnabled: boolean
}

export function defaultForgeDeployConfirmations(): ForgeDeployConfirmations {
  return {
    domain: false,
    env_vars: false,
    resend_verified: false,
    whatsapp_confirmed: false,
    analytics_configured: false,
    sitemap_submitted: false,
    lighthouse_accepted: false,
  }
}

export function parseForgeDeployConfirmations(value: unknown): ForgeDeployConfirmations {
  const defaults = defaultForgeDeployConfirmations()
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults
  const input = value as Record<string, unknown>
  for (const key of Object.keys(defaults) as ForgeDeployManualKey[]) {
    if (typeof input[key] === "boolean") defaults[key] = input[key] as boolean
  }
  return defaults
}

export function buildForgeDeployChecklist(signals: ForgeDeploySignals, confirmations: ForgeDeployConfirmations): ForgeDeployChecklistItem[] {
  const manual = (key: ForgeDeployManualKey, label: string, detail: string, confirmedDetail: string): ForgeDeployChecklistItem => ({
    key,
    label,
    status: confirmations[key] ? "passed" : "pending",
    detail: confirmations[key] ? confirmedDetail : detail,
    source: "manual",
  })

  const integration = (key: ForgeDeployManualKey, enabled: boolean, label: string, pending: string, confirmed: string, skipped: string): ForgeDeployChecklistItem => {
    if (!enabled) return { key, label, status: "skipped", detail: skipped, source: "manual" }
    return { key, label, status: confirmations[key] ? "passed" : "pending", detail: confirmations[key] ? confirmed : pending, source: "manual" }
  }

  const buildStatus: ForgeDeployChecklistStatus = signals.qaStatus === "passed" ? "passed" : signals.qaStatus === "failed" ? "failed" : "pending"
  const buildItem: ForgeDeployChecklistItem = {
    key: "build_passing",
    label: "Build passing",
    status: buildStatus,
    detail: signals.qaStatus === "passed"
      ? "Generated-site QA (install, typecheck, lint, build) passed."
      : signals.qaStatus === "failed"
        ? "Generated-site QA is failing. Fix and re-run QA before deploying."
        : "Run generated-site QA to confirm the build passes.",
    source: "auto",
  }

  const lighthouseItem: ForgeDeployChecklistItem = signals.lighthouseStatus === "passed"
    ? { key: "lighthouse_accepted", label: "Lighthouse threshold accepted", status: "passed", detail: "Lighthouse & visual QA passed configured thresholds.", source: "auto" }
    : signals.lighthouseStatus === "failed"
      ? { key: "lighthouse_accepted", label: "Lighthouse threshold accepted", status: "failed", detail: "Lighthouse & visual QA failed thresholds. Improve scores or accept manually after review.", source: "auto" }
      : manual("lighthouse_accepted", "Lighthouse threshold accepted", "Run Lighthouse & visual QA, or confirm you accept the current scores.", "Lighthouse scores reviewed and accepted.")

  return [
    manual("domain", "Domain configured", "Point the client domain/DNS at the deployment target.", "Domain/DNS confirmed."),
    manual("env_vars", "Env vars added", "Add required environment variables (e.g. RESEND_API_KEY) to the host.", "Environment variables confirmed on the host."),
    integration("resend_verified", signals.resendEnabled, "Resend verified", "Verify the Resend sender/domain and confirm the contact form sends.", "Resend sender/domain verified.", "Resend is not enabled for this project."),
    integration("whatsapp_confirmed", signals.whatsappEnabled, "WhatsApp number confirmed", "Confirm the WhatsApp business number produces a working wa.me link.", "WhatsApp number confirmed.", "WhatsApp is not enabled for this project."),
    integration("analytics_configured", signals.analyticsEnabled, "Analytics configured", "Add and verify the analytics property/tag.", "Analytics configured.", "Analytics is not enabled for this project."),
    manual("sitemap_submitted", "Sitemap submitted", "Submit /sitemap.xml in Google Search Console once live.", "Sitemap submitted to Search Console."),
    buildItem,
    lighthouseItem,
  ]
}

export function evaluateForgeDeployReadiness(checklist: ForgeDeployChecklistItem[]) {
  const failed = checklist.filter((item) => item.status === "failed").map((item) => item.label)
  const pending = checklist.filter((item) => item.status === "pending").map((item) => item.label)
  return { ready: failed.length === 0 && pending.length === 0, failed, pending }
}

/* ── deployment plan per method ─────────────────────────────────────── */

export interface ForgeDeployFile extends Record<string, JsonValue> {
  path: string
  description: string
  content: string
}

export interface ForgeDeploymentPlan extends Record<string, JsonValue> {
  method: ForgeDeployMethod
  title: string
  summary: string
  steps: string[]
  files: ForgeDeployFile[]
  warnings: string[]
  postDeploy: string[]
}

export interface ForgeDeployContext {
  businessName: string
  slug: string
  workspacePath: string | null
  exportZipName: string
}

export function buildForgeDeploymentPlan(method: ForgeDeployMethod, ctx: ForgeDeployContext): ForgeDeploymentPlan {
  switch (method) {
    case "vps": return buildVpsPlan(ctx)
    case "github": return buildGithubPlan(ctx)
    case "manual":
    default: return buildManualPlan(ctx)
  }
}

function buildManualPlan(ctx: ForgeDeployContext): ForgeDeploymentPlan {
  return {
    method: "manual",
    title: `Manual deployment — ${ctx.businessName}`,
    summary: "Export the generated site and deploy it to any Node-capable host (Vercel, Netlify, Render, or a managed Next.js host).",
    steps: [
      `Export the site ZIP (${ctx.exportZipName}) from the Export panel.`,
      "Unzip and run `npm install` then `npm run build` locally to confirm a clean build.",
      "Create the project on your chosen host and connect the unzipped source (or upload the build).",
      "Add environment variables on the host (e.g. `RESEND_API_KEY`). Never commit secrets.",
      "Point the client domain/DNS at the host and enable HTTPS.",
      "Deploy, then run the deployment checklist below.",
    ],
    files: [],
    warnings: [
      "Keep the contact form in test mode until the verified Resend sender/domain is live.",
      "Do not commit `.env` files or API keys to any repository.",
    ],
    postDeploy: defaultPostDeploy(),
  }
}

function buildVpsPlan(ctx: ForgeDeployContext): ForgeDeploymentPlan {
  const service = `forge-${ctx.slug}`
  return {
    method: "vps",
    title: `VPS deployment package — ${ctx.businessName}`,
    summary: "Run the generated Next.js site on your own VPS using Docker (or Node + systemd) behind nginx. ScaleSmiths generates the config; you run it.",
    steps: [
      "Export the site ZIP and copy it to the VPS (e.g. `scp`), then unzip into `/opt/" + service + "`.",
      "Add a `.env` file on the server with required variables (e.g. `RESEND_API_KEY`). Keep it readable only by the app user.",
      "Option A (Docker): build and run with the generated `Dockerfile`.",
      "Option B (Node): `npm ci && npm run build`, then install the generated systemd unit and start it.",
      "Put nginx in front using the generated `nginx.conf`, then issue TLS with certbot.",
      "Run the deployment checklist below.",
    ],
    files: [
      { path: "Dockerfile", description: "Production container for the generated Next.js site.", content: vpsDockerfile() },
      { path: "nginx.conf", description: "Reverse proxy from port 80/443 to the app on port 3000.", content: vpsNginx(ctx.businessName) },
      { path: `${service}.service`, description: "systemd unit for the Node deployment option.", content: vpsSystemd(service) },
      { path: "deploy.sh", description: "Manual deploy helper to run ON the VPS (review before running).", content: vpsDeployScript(service) },
    ],
    warnings: [
      "These files are a starting point — review them before running anything on a server.",
      "`deploy.sh` is provided for you to run manually on your VPS. ScaleSmiths does not execute it for you.",
      "Store secrets in the server `.env` only; never bake them into the image or repo.",
    ],
    postDeploy: defaultPostDeploy(),
  }
}

function buildGithubPlan(ctx: ForgeDeployContext): ForgeDeploymentPlan {
  return {
    method: "github",
    title: `GitHub deployment (placeholder) — ${ctx.businessName}`,
    summary: "Generate a repository scaffold and CI workflow that you push manually. This is a placeholder: ScaleSmiths does not create repos or push code on your behalf in V1.",
    steps: [
      "Export the site ZIP and unzip it locally.",
      "Create a new private GitHub repository for the client site.",
      "Add the generated `.github/workflows/deploy.yml` (review it first) and a `.gitignore` that excludes `.env` and `node_modules`.",
      "Commit and push manually: `git init && git add . && git commit -m \"Initial site\" && git push`.",
      "Add deploy secrets in GitHub repository settings (never in the repo).",
      "Connect the repo to your host's GitHub integration, then run the checklist below.",
    ],
    files: [
      { path: ".github/workflows/deploy.yml", description: "Example CI workflow (build only — no auto-deploy credentials included).", content: githubWorkflow() },
      { path: ".gitignore", description: "Ensures secrets and build artifacts are never committed.", content: githubGitignore() },
    ],
    warnings: [
      "Placeholder only: review the workflow and add your own deploy step/credentials before relying on CI.",
      "Never commit `.env` files, API keys, or tokens. The generated `.gitignore` excludes them by default.",
      "ScaleSmiths does not push to client repositories automatically in V1.",
    ],
    postDeploy: defaultPostDeploy(),
  }
}

function defaultPostDeploy(): string[] {
  return [
    "Submit `/sitemap.xml` in Google Search Console.",
    "Test the contact form end-to-end and confirm the lead email arrives.",
    "Confirm WhatsApp click-to-chat opens the correct number (if enabled).",
    "Re-run Lighthouse against the live URL and record the scores.",
  ]
}

/* ── notes artifact ─────────────────────────────────────────────────── */

export interface ForgeDeploymentNotes extends Record<string, JsonValue> {
  kind: typeof FORGE_DEPLOY_ARTIFACT_KIND
  method: ForgeDeployMethod
  lifecycle: ForgeDeployLifecycle
  plan: ForgeDeploymentPlan
  checklist: ForgeDeployChecklistItem[]
  confirmations: ForgeDeployConfirmations
  readiness: { ready: boolean; failed: string[]; pending: string[] }
  readyAt: string | null
  deployedAt: string | null
  generatedAt: string
}

export interface ForgeDeployArtifactState {
  notes: ForgeDeploymentNotes | null
  lifecycle: ForgeDeployLifecycle
  method: ForgeDeployMethod
  confirmations: ForgeDeployConfirmations
  ready: boolean
  updatedAt: string | null
}

export function readForgeDeploymentArtifact(metadata: Record<string, unknown> | null | undefined): ForgeDeployArtifactState {
  const empty: ForgeDeployArtifactState = {
    notes: null,
    lifecycle: "draft",
    method: "manual",
    confirmations: defaultForgeDeployConfirmations(),
    ready: false,
    updatedAt: null,
  }
  if (!metadata || metadata.kind !== FORGE_DEPLOY_ARTIFACT_KIND || typeof metadata.notes !== "object" || metadata.notes === null) {
    return empty
  }
  const notes = metadata.notes as Partial<ForgeDeploymentNotes>
  if (notes.kind !== FORGE_DEPLOY_ARTIFACT_KIND || !isForgeDeployMethod(notes.method) || typeof notes.plan !== "object" || notes.plan === null || !Array.isArray(notes.checklist)) {
    return empty
  }
  const full = notes as ForgeDeploymentNotes
  return {
    notes: full,
    lifecycle: full.lifecycle ?? "draft",
    method: full.method,
    confirmations: parseForgeDeployConfirmations(full.confirmations),
    ready: Boolean(full.readiness?.ready),
    updatedAt: full.generatedAt ?? null,
  }
}

export function buildForgeDeploymentNotesContent(notes: ForgeDeploymentNotes): string {
  const plan = notes.plan
  return [
    `# Deployment Notes — ${plan.title}`,
    `Method: ${methodLabel(notes.method)} · Lifecycle: ${notes.lifecycle}`,
    notes.readyAt ? `Marked ready: ${notes.readyAt}` : null,
    notes.deployedAt ? `Marked deployed: ${notes.deployedAt}` : null,
    "",
    "## Summary",
    plan.summary,
    "",
    "## Steps",
    ...plan.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Deployment checklist",
    ...notes.checklist.map((item) => `- [${item.status === "passed" || item.status === "skipped" ? "x" : " "}] ${item.label} (${item.status}) — ${item.detail}`),
    "",
    notes.readiness.ready
      ? "All checklist items are satisfied — ready to deploy."
      : `Outstanding before deploy: ${[...notes.readiness.failed, ...notes.readiness.pending].join(", ") || "none"}.`,
    "",
    ...(plan.files.length ? [
      "## Generated files",
      ...plan.files.flatMap((file) => [
        `### ${file.path}`,
        file.description,
        "",
        "```",
        file.content,
        "```",
        "",
      ]),
    ] : []),
    "## After deployment",
    ...plan.postDeploy.map((step) => `- ${step}`),
    "",
    "## Warnings",
    ...(plan.warnings.length ? plan.warnings.map((warning) => `- ${warning}`) : ["- None."]),
  ].filter((line) => line !== null).join("\n").trim()
}

export function methodLabel(method: ForgeDeployMethod): string {
  return FORGE_DEPLOY_METHODS.find((entry) => entry.id === method)?.label ?? method
}

/* ── generated file contents ────────────────────────────────────────── */

function vpsDockerfile(): string {
  return [
    "FROM node:20-alpine AS builder",
    "WORKDIR /app",
    "COPY package*.json ./",
    "RUN npm ci",
    "COPY . .",
    "RUN npm run build",
    "",
    "FROM node:20-alpine AS runner",
    "WORKDIR /app",
    "ENV NODE_ENV=production",
    "COPY --from=builder /app ./",
    "EXPOSE 3000",
    "CMD [\"npm\", \"run\", \"start\"]",
    "",
  ].join("\n")
}

function vpsNginx(businessName: string): string {
  return [
    `# nginx reverse proxy for ${businessName}`,
    "server {",
    "  listen 80;",
    "  server_name your-domain.example;",
    "",
    "  location / {",
    "    proxy_pass http://127.0.0.1:3000;",
    "    proxy_http_version 1.1;",
    "    proxy_set_header Host $host;",
    "    proxy_set_header X-Real-IP $remote_addr;",
    "    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "    proxy_set_header X-Forwarded-Proto $scheme;",
    "  }",
    "}",
    "",
  ].join("\n")
}

function vpsSystemd(service: string): string {
  return [
    "[Unit]",
    `Description=ScaleSmiths generated site (${service})`,
    "After=network.target",
    "",
    "[Service]",
    "Type=simple",
    `WorkingDirectory=/opt/${service}`,
    "Environment=NODE_ENV=production",
    "EnvironmentFile=/opt/" + service + "/.env",
    "ExecStart=/usr/bin/npm run start",
    "Restart=on-failure",
    "User=www-data",
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ].join("\n")
}

function vpsDeployScript(service: string): string {
  return [
    "#!/usr/bin/env bash",
    "# Review before running. Run this ON your VPS, not from the admin app.",
    "set -euo pipefail",
    "",
    `APP_DIR=\"/opt/${service}\"`,
    "cd \"$APP_DIR\"",
    "npm ci",
    "npm run build",
    `sudo systemctl restart ${service}`,
    "echo \"Deployed. Check: sudo systemctl status " + service + "\"",
    "",
  ].join("\n")
}

function githubWorkflow(): string {
  return [
    "name: build",
    "on:",
    "  push:",
    "    branches: [main]",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20",
    "      - run: npm ci",
    "      - run: npm run build",
    "      # Add your own deploy step + secrets here. No deploy credentials are included by default.",
    "",
  ].join("\n")
}

function githubGitignore(): string {
  return [
    "node_modules/",
    ".next/",
    ".env",
    ".env.*",
    "!.env.example",
    ".DS_Store",
    "",
  ].join("\n")
}
