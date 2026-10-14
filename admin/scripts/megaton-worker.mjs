const token = process.env.MEGATON_WORKER_TOKEN;
if (
  !token ||
  process.env.MEGATON_ENABLED !== "true" ||
  process.env.MEGATON_EXTERNAL_ENABLED !== "true" ||
  process.env.MEGATON_STOP !== "false"
)
  throw new Error("Megaton worker is not configured or enabled.");
const url = new URL(
  process.env.MEGATON_WORKER_URL || "http://127.0.0.1:3001/api/megaton/worker",
);
if (
  url.pathname !== "/api/megaton/worker" ||
  !(
    url.protocol === "https:" ||
    (url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
  )
)
  throw new Error("Use HTTPS or a loopback worker URL.");
const interval = Number(process.env.MEGATON_WORKER_INTERVAL_SECONDS || 60);
if (!Number.isInteger(interval) || interval < 30 || interval > 3600)
  throw new Error("Worker interval must be 30–3600 seconds.");
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
while (!stopped) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120000),
      redirect: "error",
    });
    console.log(
      JSON.stringify({ at: new Date().toISOString(), status: response.status }),
    );
    if (response.status === 401 || response.status === 403) stopped = true;
  } catch {
    console.error(
      "Megaton worker request failed; retrying at bounded interval.",
    );
  }
  if (!stopped)
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
}
