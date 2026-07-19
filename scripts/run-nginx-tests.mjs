// Orchestrates the disposable host-Nginx topology harness: build the mock
// upstreams, edge and Nginx (deriving from the shared production snippets), wait
// until they are healthy, then run the request-assertion suite inside the tester
// container on the compose network. Everything is torn down afterwards. Mirrors
// scripts/run-admin-integration-tests.mjs.
import { spawn } from "node:child_process"
import process from "node:process"

const project = "scalesmiths-nginx-test"
const compose = ["compose", "-p", project, "-f", "docker-compose.nginx-test.yml"]

try {
  // Start everything except the profiled tester, waiting for healthchecks.
  await command("docker", [...compose, "up", "-d", "--build", "--wait"])
  // Run the assertions; a non-zero exit (a failed route/header/misroute) fails CI.
  await command("docker", [...compose, "run", "--rm", "tester"])
} finally {
  await command("docker", [...compose, "down", "--volumes", "--remove-orphans"]).catch((error) =>
    console.error(`Nginx harness cleanup failed: ${error.message}`),
  )
}

function command(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: "inherit", windowsHide: true })
    child.once("error", reject)
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${executable} ${args.join(" ")} exited with ${code}`))))
  })
}
