import type { ForgeRepairPatch } from "@/lib/forge-qa"

// Repair patches arrive as full-file replacements from the AI provider, which is capped at a
// per-task token budget. A large file (e.g. src/lib/site-data.ts) can be truncated mid-string,
// producing an "Unterminated string literal" that is then written and re-fails typecheck. We
// parse the replacement up front and reject syntactically broken source before it touches the
// workspace, so a truncated/garbled response fails the attempt instead of corrupting the site.

const PARSEABLE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

function isParseablePath(path: string) {
  const lower = path.toLowerCase()
  return PARSEABLE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export async function validateForgeRepairPatchSyntax(
  patches: ForgeRepairPatch[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const targets = patches.filter((patch) => isParseablePath(patch.path))
  if (!targets.length) return { ok: true }

  // typescript is a devDependency only needed when a repair runs, so import it lazily.
  const ts = (await import("typescript")).default ?? (await import("typescript"))

  for (const patch of targets) {
    const result = ts.transpileModule(patch.content, {
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.Preserve,
        isolatedModules: true,
      },
      fileName: patch.path,
    })

    const syntaxError = (result.diagnostics ?? []).find(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    )
    if (syntaxError) {
      const message = ts.flattenDiagnosticMessageText(syntaxError.messageText, "\n")
      return {
        ok: false,
        error: `Repair produced syntactically invalid source for ${patch.path} (TS${syntaxError.code}: ${message}). The AI response was likely truncated; not writing the broken file.`,
      }
    }
  }

  return { ok: true }
}
