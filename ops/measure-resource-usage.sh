#!/usr/bin/env bash
# Measure ScaleSmiths container resource usage for capacity planning.
#
# Run this on the production VPS:
#   1. During normal operation (typical traffic, no Forge jobs running)
#   2. During busy operation (Forge project generation, admin dashboard active)
#
# Collect at least 3 snapshots per scenario, spaced 30s apart.

set -euo pipefail

echo "=== ScaleSmiths container resource usage ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "NOTE: docker stats output is a point-in-time snapshot."
echo "Run this script multiple times under each workload scenario."
echo ""

docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null || {
  echo "ERROR: docker stats failed. Is Docker running?"
  exit 1
}

echo ""
echo "=== Interpretation guide ==="
echo "MEM USAGE / LIMIT: current memory usage vs container limit (or host total if no limit)"
echo "MEM %: percentage of limit (or host if no limit set)"
echo "CPU %: percentage of host CPU"
echo ""
echo "=== Evidence required before setting resource limits ==="
echo ""
echo "Memory: record peak MEM USAGE across all snapshots, then add 50% headroom."
echo "  Example: web peaks at 180MiB -> set mem_limit: 270M (or 300M)"
echo ""
echo "CPU: record maximum CPU % across all snapshots."
echo "  CPU limits are throttling limits, not reservations."
echo "  Set cpus higher than observed peaks to avoid throttling under load."
echo "  A runaway process (100% CPU sustained) is throttled but NOT killed by CPU limits."
echo "  For OOM protection, memory limits matter more than CPU limits."
echo ""
echo "Forge/sandbox: Docker sandbox containers are already constrained by"
echo "  FORGE_SANDBOX_CPUS and FORGE_SANDBOX_MEMORY env vars."
echo "  Monitor admin container memory during active Forge runs (npm install,"
echo "  preview builds can spike transiently)."
echo ""
echo "PostgreSQL: shared_buffers and work_mem control memory inside the container."
echo "  The container memory limit should accommodate shared_buffers +"
echo "  (max_connections * work_mem) + OS overhead (~256MiB)."
echo ""
echo "=== Suggested first limits (measure before applying) ==="
echo "These are ORDER-OF-MAGNITUDE estimates, NOT production settings:"
echo "  web:    memory 512M, cpus 2.0  (Next.js SSR, ~180MiB idle typical)"
echo "  admin:  memory 1G,   cpus 2.0  (Next.js + Forge worker + Docker CLI)"
echo "  postgres: memory depends on shared_buffers config"
echo "  nginx:  memory 64M,  cpus 0.5  (static reverse proxy, near-zero baseline)"
echo ""
echo "Do NOT apply limits without measuring YOUR deployment first."
echo "Different traffic, Forge project complexity, and DB size change these numbers."