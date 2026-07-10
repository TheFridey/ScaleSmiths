import "server-only"
import path from "node:path"
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import {
  FORGE_GENERATED_SITES_DIR,
  FORGE_WORKSPACE_TEMPLATE,
  assertForgeWorkspaceFileAllowed,
  buildForgeWorkspaceRelativePath,
  buildForgeWorkspaceSlug,
  canDeleteForgeWorkspace,
  type ForgeWorkspaceMetadata,
  type ForgeWorkspaceProject,
} from "@/lib/forge-workspace"
import { captureMonitoringException } from "./monitoring"

export class ForgeWorkspaceError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeWorkspaceError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function createForgeProjectWorkspace(project: ForgeWorkspaceProject, existing?: ForgeWorkspaceMetadata | null) {
  const now = new Date().toISOString()
  const metadata: ForgeWorkspaceMetadata = {
    projectId: project.id,
    slug: buildForgeWorkspaceSlug(project),
    relativePath: buildForgeWorkspaceRelativePath(project),
    template: FORGE_WORKSPACE_TEMPLATE,
    fileCount: 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  try {
    const workspaceRoot = resolveWorkspaceRoot(metadata)
    await mkdir(workspaceRoot, { recursive: true })
    for (const file of buildTemplateFiles(project)) await writeForgeWorkspaceFile(metadata, file.path, file.content, { allowExecutableScripts: true, overwrite: false })
    metadata.fileCount = (await listForgeWorkspaceFiles(metadata)).length
    metadata.updatedAt = new Date().toISOString()
    return metadata
  } catch (error) {
    captureMonitoringException(error, { projectId: project.id, forgeStage: "workspace_generation", workspacePath: metadata.relativePath })
    throw error
  }
}

export async function writeForgeWorkspaceFile(
  workspace: ForgeWorkspaceMetadata,
  relativePath: string,
  content: string,
  options: { allowExecutableScripts?: boolean; overwrite?: boolean } = {},
) {
  const target = resolveWorkspaceFile(workspace, relativePath, content, options)

  if (options.overwrite === false && await fileExists(target.absolutePath)) return

  try {
    await mkdir(path.dirname(target.absolutePath), { recursive: true })
    await writeFile(target.absolutePath, content, "utf8")
  } catch (error) {
    captureMonitoringException(error, { projectId: workspace.projectId, forgeStage: "workspace_write", relativePath: target.relativePath })
    throw error
  }
}

export async function readForgeWorkspaceFile(workspace: ForgeWorkspaceMetadata, relativePath: string) {
  const target = resolveWorkspaceFile(workspace, relativePath)
  return readFile(target.absolutePath, "utf8")
}

export async function listForgeWorkspaceFiles(workspace: ForgeWorkspaceMetadata) {
  const workspaceRoot = resolveWorkspaceRoot(workspace)
  if (!await fileExists(workspaceRoot)) return []

  const files: string[] = []
  await walk(workspaceRoot, workspaceRoot, files)
  return files.sort()
}

export async function deleteForgeWorkspace(project: ForgeWorkspaceProject, workspace: ForgeWorkspaceMetadata) {
  if (!canDeleteForgeWorkspace(project)) {
    throw new ForgeWorkspaceError("Generated workspaces can only be deleted for archived, test, demo, or sandbox projects.", 403)
  }

  const workspaceRoot = resolveWorkspaceRoot(workspace)
  await rm(workspaceRoot, { recursive: true, force: true })
}

export async function cleanupForgeWorkspaceTransientOutput(workspace: ForgeWorkspaceMetadata) {
  const workspaceRoot = resolveWorkspaceRoot(workspace)
  const transientPaths = [
    ".next/cache",
    ".turbo",
    "coverage",
    "npm-debug.log",
    "yarn-error.log",
    "pnpm-debug.log",
  ]

  for (const relativePath of transientPaths) {
    const absolutePath = path.resolve(workspaceRoot, relativePath)
    ensureInside(workspaceRoot, absolutePath)
    await rm(absolutePath, { recursive: true, force: true })
  }
}

export function resolveWorkspaceRoot(workspace: ForgeWorkspaceMetadata) {
  const root = repoRoot()
  const generatedRoot = path.resolve(root, FORGE_GENERATED_SITES_DIR)
  const workspaceRoot = path.resolve(root, workspace.relativePath)
  ensureInside(generatedRoot, workspaceRoot)
  return workspaceRoot
}

function resolveWorkspaceFile(workspace: ForgeWorkspaceMetadata, relativePath: string, content = "", options: { allowExecutableScripts?: boolean } = {}) {
  const allowed = assertForgeWorkspaceFileAllowed(relativePath, content, options)
  if (!allowed.ok) throw new ForgeWorkspaceError(allowed.error, 400)

  const workspaceRoot = resolveWorkspaceRoot(workspace)
  const absolutePath = path.resolve(workspaceRoot, allowed.path)
  ensureInside(workspaceRoot, absolutePath)
  return { relativePath: allowed.path, absolutePath }
}

function repoRoot() {
  return path.basename(process.cwd()) === "admin" ? path.resolve(process.cwd(), "..") : process.cwd()
}

function ensureInside(parent: string, child: string) {
  const relative = path.relative(parent, child)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ForgeWorkspaceError("Resolved path is outside the generated-sites workspace.", 400)
  }
}

async function walk(root: string, current: string, files: string[]) {
  const entries = await readdir(current, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) {
      await walk(root, absolute, files)
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).replace(/\\/g, "/"))
    }
  }
}

async function fileExists(absolutePath: string) {
  try {
    await stat(absolutePath)
    return true
  } catch {
    return false
  }
}

function buildTemplateFiles(project: ForgeWorkspaceProject) {
  const title = project.businessName || project.name
  const description = `${title} website generated in ScaleSmiths Forge.`

  return [
    {
      path: "package.json",
      content: JSON.stringify({
        private: true,
        name: buildForgeWorkspaceSlug(project),
        version: "0.1.0",
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "next lint",
        },
        dependencies: {
          "@types/node": "latest",
          "@types/react": "latest",
          "@types/react-dom": "latest",
          "autoprefixer": "latest",
          "next": "latest",
          "postcss": "latest",
          "react": "latest",
          "react-dom": "latest",
          "tailwindcss": "latest",
          "typescript": "latest",
        },
        devDependencies: {},
      }, null, 2),
    },
    { path: "next.config.mjs", content: "const nextConfig = {}\n\nexport default nextConfig\n" },
    {
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "es5",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./src/*"] },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      }, null, 2),
    },
    { path: "postcss.config.mjs", content: "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n" },
    {
      path: "tailwind.config.ts",
      content: [
        "import type { Config } from 'tailwindcss'",
        "",
        "const config: Config = {",
        "  content: ['./src/**/*.{ts,tsx}'],",
        "  theme: { extend: {} },",
        "  plugins: [],",
        "}",
        "",
        "export default config",
        "",
      ].join("\n"),
    },
    {
      path: "src/app/layout.tsx",
      content: [
        "import type { Metadata } from 'next'",
        "import './globals.css'",
        "",
        "export const metadata: Metadata = {",
        `  title: ${JSON.stringify(title)},`,
        `  description: ${JSON.stringify(description)},`,
        "}",
        "",
        "export default function RootLayout({ children }: { children: React.ReactNode }) {",
        "  return (",
        "    <html lang=\"en\">",
        "      <body>{children}</body>",
        "    </html>",
        "  )",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/app/page.tsx",
      content: [
        "import { Hero } from '@/components/Hero'",
        "import { LeadForm } from '@/components/LeadForm'",
        "import { WhatsAppCTA } from '@/components/WhatsAppCTA'",
        "",
        "export default function Home() {",
        "  return (",
        "    <main>",
        `      <Hero title=${JSON.stringify(title)} subtitle=\"Generated site workspace ready for Forge code generation.\" />`,
        "      <section className=\"mx-auto max-w-5xl px-6 py-16\">",
        "        <h2 className=\"text-2xl font-semibold\">Reusable component scaffold</h2>",
        "        <p className=\"mt-3 text-neutral-700\">Hero, TrustBar, ServicesGrid, ServiceDetail, ProcessSection, ReviewsSection, FAQSection, ContactSection, WhatsAppCTA, LeadForm, and LocalSEOSection are ready for generated implementation.</p>",
        "      </section>",
        "      <LeadForm />",
        "      <WhatsAppCTA />",
        "    </main>",
        "  )",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/app/globals.css",
      content: [
        "@tailwind base;",
        "@tailwind components;",
        "@tailwind utilities;",
        "",
        "body {",
        "  margin: 0;",
        "  color: #171717;",
        "  background: #f8fafc;",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/app/api/contact/route.ts",
      content: [
        "import { NextResponse } from 'next/server'",
        "",
        "export async function POST() {",
        "  // Resend-ready placeholder. Wire this to a server-only RESEND_API_KEY in a later Forge stage.",
        "  return NextResponse.json({ ok: true, message: 'Contact placeholder received.' })",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/components/Hero.tsx",
      content: [
        "export function Hero({ title, subtitle }: { title: string; subtitle: string }) {",
        "  return (",
        "    <section className=\"mx-auto max-w-5xl px-6 py-20\">",
        "      <h1 className=\"text-4xl font-bold tracking-tight text-neutral-950\">{title}</h1>",
        "      <p className=\"mt-4 max-w-2xl text-lg text-neutral-700\">{subtitle}</p>",
        "    </section>",
        "  )",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/components/LeadForm.tsx",
      content: [
        "export function LeadForm() {",
        "  return (",
        "    <section className=\"mx-auto max-w-5xl px-6 py-12\">",
        "      <form className=\"grid gap-3 rounded-lg border bg-white p-5\">",
        "        <input name=\"name\" placeholder=\"Name\" />",
        "        <input name=\"email\" placeholder=\"Email\" />",
        "        <textarea name=\"message\" placeholder=\"Project details\" />",
        "        <button type=\"submit\" className=\"rounded bg-neutral-950 px-4 py-2 text-white\">Send enquiry</button>",
        "      </form>",
        "    </section>",
        "  )",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/components/WhatsAppCTA.tsx",
      content: [
        "export function WhatsAppCTA() {",
        "  return (",
        "    <section className=\"mx-auto max-w-5xl px-6 py-8\">",
        "      <a className=\"inline-flex rounded border px-4 py-2\" href=\"#\" aria-label=\"WhatsApp placeholder\">WhatsApp CTA placeholder</a>",
        "    </section>",
        "  )",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "src/components/index.ts",
      content: [
        "export { Hero } from './Hero'",
        "export { LeadForm } from './LeadForm'",
        "export { WhatsAppCTA } from './WhatsAppCTA'",
        "",
      ].join("\n"),
    },
    {
      path: "README.md",
      content: [
        `# ${title}`,
        "",
        "Generated by ScaleSmiths Forge.",
        "",
        "This workspace is intentionally isolated under `generated-sites/` and must not modify the ScaleSmiths admin or public web apps.",
        "",
      ].join("\n"),
    },
  ]
}
