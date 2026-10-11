/**
 * WCAG relative-luminance and contrast helpers for design-token verification.
 * Uses sRGB linearisation per WCAG 2.x.
 */

export type Rgb = readonly [number, number, number]

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Parse #RGB / #RRGGBB into 0–255 channels. */
export function parseHexColor(hex: string): Rgb {
  const trimmed = hex.trim()
  if (!HEX_RE.test(trimmed)) {
    throw new Error(`Invalid hex colour: ${hex}`)
  }
  const raw = trimmed.slice(1)
  const full = raw.length === 3
    ? raw.split("").map((c) => c + c).join("")
    : raw
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

function channelLuminance(channel: number): number {
  const s = channel / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** Contrast ratio of two colours (order-independent), minimum 1. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(parseHexColor(foreground))
  const l2 = relativeLuminance(parseHexColor(background))
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsWcagAa(foreground: string, background: string, options?: { largeText?: boolean }): boolean {
  const min = options?.largeText ? 3 : 4.5
  return contrastRatio(foreground, background) >= min
}

export function meetsWcagAaUi(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 3
}

/** Canonical public-site token pairs that must remain AA-safe (forge palette). */
export const PUBLIC_CONTRAST_PAIRS = [
  { name: "body on bg", fg: "#f5efe6", bg: "#0b0a08", largeText: false },
  { name: "t2 on bg", fg: "#c9bdb0", bg: "#0b0a08", largeText: false },
  { name: "t3 on bg (large/UI)", fg: "#95887a", bg: "#0b0a08", largeText: true },
  { name: "acc ink on gold CTA", fg: "#1a1208", bg: "#e8a045", largeText: false },
  { name: "paper ink on paper", fg: "#1a140e", bg: "#d9d0c4", largeText: false },
  { name: "paper text on paper", fg: "#2c241c", bg: "#d9d0c4", largeText: false },
  { name: "paper muted on paper (large/UI)", fg: "#5c5348", bg: "#d9d0c4", largeText: true },
  { name: "paper muted on paper (body)", fg: "#5c5348", bg: "#d9d0c4", largeText: false },
  { name: "paper text on paper-soft", fg: "#2c241c", bg: "#ccc3b6", largeText: false },
  { name: "acc on paper (link)", fg: "#7a3f12", bg: "#d9d0c4", largeText: false },
  { name: "CTA ink on paper-acc", fg: "#f5efe6", bg: "#7a3f12", largeText: false },
] as const
