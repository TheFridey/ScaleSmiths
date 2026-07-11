// Test-only stub for the `server-only` package.
//
// The real `server-only` package throws unconditionally when its default
// export is resolved outside of React's "react-server" bundler condition
// (see node_modules/next/dist/compiled/server-only/index.js). Next.js's own
// webpack config special-cases this import so server components can use it
// safely, but Vitest has no such alias by default and the package is not
// installed as a project dependency.
//
// Importing a server-only module directly in a unit test (as Task 5's
// `forge-provider-health.test.ts` does for the pure `resolveFailoverTarget`
// export) is an intentional, accepted pattern here — the guard exists to
// keep server code out of client bundles, not to block test execution.
// This stub is aliased in `vitest.config.ts` so that import is a no-op
// under test.
export {}
