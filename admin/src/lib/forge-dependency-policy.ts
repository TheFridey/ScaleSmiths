export interface ForgeDependencyPolicyPackageRule {
  manifestRanges: string[]
  minimumVersion: string
  maximumVersionExclusive: string
  reviewedAt: string
}

export interface ForgeDependencyPolicy {
  version: string
  status: "active" | "historical"
  effectiveAt: string
  description: string
  allowedRegistries: string[]
  approvedPackages: Record<string, ForgeDependencyPolicyPackageRule>
  approvedTransitiveVersions: Record<string, string[]>
  blockedPackages: string[]
  allowedLicenceIdentifiers: string[]
  deniedLicenceIdentifiers: string[]
  reviewedNativePackages: Array<{ pattern: string; minimumVersion: string; maximumVersionExclusive: string }>
  lifecycleScripts: "deny_unreviewed"
  maximumReviewAgeDays: number
  evidenceMaximumAgeHours: number
  maximumPackageCount: number
  blockingVulnerabilitySeverities: Array<"high" | "critical">
  warningVulnerabilitySeverities: Array<"low" | "moderate">
}

const POLICY_2026_07_14_1: ForgeDependencyPolicy = {
  version: "2026-07-14.1",
  status: "active",
  effectiveAt: "2026-07-14T00:00:00.000Z",
  description: "Initial generated-site npm dependency admission baseline.",
  allowedRegistries: ["https://registry.npmjs.org"],
  approvedPackages: {
    "@types/node": { manifestRanges: ["^22"], minimumVersion: "22.0.0", maximumVersionExclusive: "23.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "@types/react": { manifestRanges: ["^18"], minimumVersion: "18.0.0", maximumVersionExclusive: "19.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "@types/react-dom": { manifestRanges: ["^18"], minimumVersion: "18.0.0", maximumVersionExclusive: "19.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "autoprefixer": { manifestRanges: ["^10.4.19"], minimumVersion: "10.4.19", maximumVersionExclusive: "11.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "framer-motion": { manifestRanges: ["^12.0.0"], minimumVersion: "12.0.0", maximumVersionExclusive: "13.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "gsap": { manifestRanges: ["^3.13.0"], minimumVersion: "3.13.0", maximumVersionExclusive: "4.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "lenis": { manifestRanges: ["^1.3.8"], minimumVersion: "1.3.8", maximumVersionExclusive: "2.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "next": { manifestRanges: ["15.5.20"], minimumVersion: "15.5.20", maximumVersionExclusive: "15.5.21", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "postcss": { manifestRanges: ["^8.4.38"], minimumVersion: "8.4.38", maximumVersionExclusive: "9.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "react": { manifestRanges: ["18.3.1"], minimumVersion: "18.3.1", maximumVersionExclusive: "18.3.2", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "react-dom": { manifestRanges: ["18.3.1"], minimumVersion: "18.3.1", maximumVersionExclusive: "18.3.2", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "resend": { manifestRanges: ["6.17.2"], minimumVersion: "6.17.2", maximumVersionExclusive: "6.17.3", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "tailwindcss": { manifestRanges: ["^3.4.4"], minimumVersion: "3.4.4", maximumVersionExclusive: "4.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
    "typescript": { manifestRanges: ["^5.5.2"], minimumVersion: "5.5.2", maximumVersionExclusive: "6.0.0", reviewedAt: "2026-07-14T00:00:00.000Z" },
  },
  approvedTransitiveVersions: {
    "@alloc/quick-lru": ["5.2.0"],
    "@emnapi/runtime": ["1.11.2"],
    "@img/colour": ["1.1.0"],
    "@img/sharp-darwin-arm64": ["0.34.5"],
    "@img/sharp-darwin-x64": ["0.34.5"],
    "@img/sharp-libvips-darwin-arm64": ["1.2.4"],
    "@img/sharp-libvips-darwin-x64": ["1.2.4"],
    "@img/sharp-libvips-linux-arm": ["1.2.4"],
    "@img/sharp-libvips-linux-arm64": ["1.2.4"],
    "@img/sharp-libvips-linux-ppc64": ["1.2.4"],
    "@img/sharp-libvips-linux-riscv64": ["1.2.4"],
    "@img/sharp-libvips-linux-s390x": ["1.2.4"],
    "@img/sharp-libvips-linux-x64": ["1.2.4"],
    "@img/sharp-libvips-linuxmusl-arm64": ["1.2.4"],
    "@img/sharp-libvips-linuxmusl-x64": ["1.2.4"],
    "@img/sharp-linux-arm": ["0.34.5"],
    "@img/sharp-linux-arm64": ["0.34.5"],
    "@img/sharp-linux-ppc64": ["0.34.5"],
    "@img/sharp-linux-riscv64": ["0.34.5"],
    "@img/sharp-linux-s390x": ["0.34.5"],
    "@img/sharp-linux-x64": ["0.34.5"],
    "@img/sharp-linuxmusl-arm64": ["0.34.5"],
    "@img/sharp-linuxmusl-x64": ["0.34.5"],
    "@img/sharp-wasm32": ["0.34.5"],
    "@img/sharp-win32-arm64": ["0.34.5"],
    "@img/sharp-win32-ia32": ["0.34.5"],
    "@img/sharp-win32-x64": ["0.34.5"],
    "@jridgewell/gen-mapping": ["0.3.13"],
    "@jridgewell/resolve-uri": ["3.1.2"],
    "@jridgewell/sourcemap-codec": ["1.5.5"],
    "@jridgewell/trace-mapping": ["0.3.31"],
    "@next/env": ["15.5.20"],
    "@next/swc-darwin-arm64": ["15.5.20"],
    "@next/swc-darwin-x64": ["15.5.20"],
    "@next/swc-linux-arm64-gnu": ["15.5.20"],
    "@next/swc-linux-arm64-musl": ["15.5.20"],
    "@next/swc-linux-x64-gnu": ["15.5.20"],
    "@next/swc-linux-x64-musl": ["15.5.20"],
    "@next/swc-win32-arm64-msvc": ["15.5.20"],
    "@next/swc-win32-x64-msvc": ["15.5.20"],
    "@nodelib/fs.scandir": ["2.1.5"],
    "@nodelib/fs.stat": ["2.0.5"],
    "@nodelib/fs.walk": ["1.2.8"],
    "@stablelib/base64": ["1.0.1"],
    "@swc/helpers": ["0.5.15"],
    "@types/prop-types": ["15.7.15"],
    "any-promise": ["1.3.0"],
    "anymatch": ["3.1.3"],
    "arg": ["5.0.2"],
    "baseline-browser-mapping": ["2.10.43"],
    "binary-extensions": ["2.3.0"],
    "braces": ["3.0.3"],
    "browserslist": ["4.28.6"],
    "camelcase-css": ["2.0.1"],
    "caniuse-lite": ["1.0.30001805"],
    "chokidar": ["3.6.0"],
    "client-only": ["0.0.1"],
    "commander": ["4.1.1"],
    "cssesc": ["3.0.0"],
    "csstype": ["3.2.3"],
    "detect-libc": ["2.1.2"],
    "didyoumean": ["1.2.2"],
    "dlv": ["1.1.3"],
    "electron-to-chromium": ["1.5.389"],
    "es-errors": ["1.3.0"],
    "escalade": ["3.2.0"],
    "fast-glob": ["3.3.3"],
    "fast-sha256": ["1.3.0"],
    "fastq": ["1.20.1"],
    "fdir": ["6.5.0"],
    "fill-range": ["7.1.1"],
    "fraction.js": ["5.3.4"],
    "fsevents": ["2.3.3"],
    "function-bind": ["1.1.2"],
    "glob-parent": ["5.1.2", "6.0.2"],
    "hasown": ["2.0.4"],
    "is-binary-path": ["2.1.0"],
    "is-core-module": ["2.16.2"],
    "is-extglob": ["2.1.1"],
    "is-glob": ["4.0.3"],
    "is-number": ["7.0.0"],
    "jiti": ["1.21.7"],
    "js-tokens": ["4.0.0"],
    "lilconfig": ["3.1.3"],
    "lines-and-columns": ["1.2.4"],
    "loose-envify": ["1.4.0"],
    "merge2": ["1.4.1"],
    "micromatch": ["4.0.8"],
    "motion-dom": ["12.42.2"],
    "motion-utils": ["12.39.0"],
    "mz": ["2.7.0"],
    "nanoid": ["3.3.15"],
    "node-releases": ["2.0.51"],
    "normalize-path": ["3.0.0"],
    "object-assign": ["4.1.1"],
    "object-hash": ["3.0.0"],
    "path-parse": ["1.0.7"],
    "picocolors": ["1.1.1"],
    "picomatch": ["2.3.2", "4.0.5"],
    "pify": ["2.3.0"],
    "pirates": ["4.0.7"],
    "postal-mime": ["2.7.4"],
    "postcss": ["8.4.31"],
    "postcss-import": ["15.1.0"],
    "postcss-js": ["4.1.0"],
    "postcss-load-config": ["6.0.1"],
    "postcss-nested": ["6.2.0"],
    "postcss-selector-parser": ["6.1.4"],
    "postcss-value-parser": ["4.2.0"],
    "queue-microtask": ["1.2.3"],
    "read-cache": ["1.0.0"],
    "readdirp": ["3.6.0"],
    "resolve": ["1.22.12"],
    "reusify": ["1.1.0"],
    "run-parallel": ["1.2.0"],
    "scheduler": ["0.23.2"],
    "semver": ["7.8.5"],
    "sharp": ["0.34.5"],
    "source-map-js": ["1.2.1"],
    "standardwebhooks": ["1.0.0"],
    "styled-jsx": ["5.1.6"],
    "sucrase": ["3.35.1"],
    "supports-preserve-symlinks-flag": ["1.0.0"],
    "thenify": ["3.3.1"],
    "thenify-all": ["1.6.0"],
    "tinyglobby": ["0.2.17"],
    "to-regex-range": ["5.0.1"],
    "ts-interface-checker": ["0.1.13"],
    "tslib": ["2.8.1"],
    "undici-types": ["6.21.0"],
    "update-browserslist-db": ["1.2.3"],
    "util-deprecate": ["1.0.2"],
  },
  blockedPackages: ["child-process", "ffi-napi", "node-pty", "puppeteer", "puppeteer-core", "playwright", "playwright-core"],
  allowedLicenceIdentifiers: ["0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC-BY-4.0", "ISC", "LGPL-3.0-only", "LGPL-3.0-or-later", "MIT", "MIT-0", "Unlicense"],
  deniedLicenceIdentifiers: ["AGPL-1.0", "AGPL-1.0-only", "AGPL-1.0-or-later", "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later", "GPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0", "GPL-3.0-only", "GPL-3.0-or-later", "SSPL-1.0"],
  reviewedNativePackages: [
    { pattern: "@next/swc-*", minimumVersion: "15.5.20", maximumVersionExclusive: "15.5.21" },
    { pattern: "@img/colour", minimumVersion: "1.0.0", maximumVersionExclusive: "2.0.0" },
    { pattern: "@img/sharp-*", minimumVersion: "0.34.0", maximumVersionExclusive: "0.35.0" },
    { pattern: "@img/sharp-libvips-*", minimumVersion: "1.2.0", maximumVersionExclusive: "1.3.0" },
    { pattern: "sharp", minimumVersion: "0.34.0", maximumVersionExclusive: "0.35.0" },
    { pattern: "fsevents", minimumVersion: "2.3.0", maximumVersionExclusive: "2.4.0" },
  ],
  lifecycleScripts: "deny_unreviewed",
  maximumReviewAgeDays: 180,
  evidenceMaximumAgeHours: 24,
  maximumPackageCount: 250,
  blockingVulnerabilitySeverities: ["high", "critical"],
  warningVulnerabilitySeverities: ["low", "moderate"],
}

export const FORGE_DEPENDENCY_POLICY_REGISTRY: Readonly<Record<string, ForgeDependencyPolicy>> = {
  [POLICY_2026_07_14_1.version]: POLICY_2026_07_14_1,
}

export const ACTIVE_FORGE_DEPENDENCY_POLICY_VERSION = POLICY_2026_07_14_1.version

export function getActiveForgeDependencyPolicy() {
  return FORGE_DEPENDENCY_POLICY_REGISTRY[ACTIVE_FORGE_DEPENDENCY_POLICY_VERSION]
}

export function getForgeDependencyPolicy(version: string) {
  return FORGE_DEPENDENCY_POLICY_REGISTRY[version] ?? null
}
