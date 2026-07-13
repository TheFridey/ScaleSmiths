# Forge benchmark suite

The Forge benchmark suite gives prompt, schema and model changes a repeatable quality check without requiring paid provider calls in pull-request CI.

Run the deterministic suite from `admin/`:

```bash
npm run test:forge-benchmark
```

The runner writes JSON and Markdown reports under `admin/benchmark-results/forge/`. These files are local/CI artifacts and are ignored by Git.

## Fixtures

The benchmark fixtures live in `admin/src/lib/forge-benchmarks.ts` and cover:

- plastering contractor;
- electrician;
- podiatrist;
- e-commerce brand;
- motorsport technology business;
- veteran support organisation;
- premium professional service;
- weak input;
- contradictory input;
- old website migration.

Each fixture defines ground-truth facts, required pages and services, prohibited invented claims, required trust signals, the primary conversion goal, design constraints, a quality rubric, known contradictions and expected clarification questions.

## Reported metrics

Reports include schema pass rate, consistency score, content quality, cost, latency, retry count, fallback rate, human-review requirement and regression against a supplied baseline prompt/schema/model report.

Offline reports use the deterministic mock candidate, so `costUsd` is `null`, retry count is zero, and fallback usage is explicit. This keeps normal CI fast and free while still exercising the benchmark schema and scoring rules.

To compare with an earlier report:

```bash
npm run test:forge-benchmark -- --compare benchmark-results/forge/latest.json
```

## Live-provider evaluations

Live evaluations must be opt-in and should run only from scheduled or manually dispatched trusted workflows with provider budgets configured. The offline runner refuses live mode unless `FORGE_BENCHMARK_LIVE=true` is present, and even then does not execute provider calls itself. Wire scheduled live runs through the Forge provider evaluation worker so normal pull requests never spend provider credits.

When live evaluations are added, keep provider prompts, raw provider response bodies, API keys and generated source out of benchmark artifacts. Store only normalized usage, model identifiers, schema/prompt versions, safe findings and aggregate scores.
