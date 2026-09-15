export interface ConfiguredLink {
  label: string
  /** Environment variable supplying the URL. Unset or invalid means the link is not published. */
  envVar: string
}

export interface PublicLink {
  label: string
  href: string
}

export type PublicEnv = Record<string, string | undefined>

/**
 * Optional profile/contact links come from configuration only. An unset, blank or non-HTTPS
 * value publishes nothing rather than a broken, unsafe or unverified link.
 */
export function resolveConfiguredLinks(configs: readonly ConfiguredLink[], env: PublicEnv): PublicLink[] {
  return configs
    .map((config) => ({ label: config.label, href: (env[config.envVar] ?? "").trim() }))
    .filter((link) => isPublishableLink(link.href))
}

export function isPublishableLink(value: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "mailto:"
  } catch {
    return false
  }
}

/** `sameAs` only accepts web profiles, never mailto links. */
export function sameAsUrls(links: readonly PublicLink[]): string[] {
  return links.map((link) => link.href).filter((href) => href.startsWith("https:"))
}
