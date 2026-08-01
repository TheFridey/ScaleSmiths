import { expect, test, type Page } from "@playwright/test"
import { readFile, unlink, writeFile } from "node:fs/promises"

const prompt = "Build a premium lead-generation website for a Nottingham commercial roofing company. They want larger contracts, have weak branding and need enquiries sent by email and WhatsApp."
const createdRunIds = new Set<number>()

test.afterEach(async ({ page }) => {
  for (const runId of createdRunIds) await cancelRun(page, runId, "Forge E2E afterEach cleanup.")
  createdRunIds.clear()
})

async function interpret(page: import("@playwright/test").Page, request = prompt, websiteUrl = "") {
  await page.goto("/forge/new")
  if (websiteUrl) await page.getByLabel(/^Existing website URL/).fill(websiteUrl)
  await page.getByLabel(/^What should Forge build\?/).fill(request)
  await page.getByRole("button", { name: "Generate brief", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: /Approve Forge/ })).toBeVisible({ timeout: 60_000 })
}

test("1. creates a new project from prompt only", async ({ page }) => {
  await interpret(page)
  await page.getByRole("button", { name: "Approve Brief and Build Draft", exact: true }).click()
  await page.waitForURL(/\/forge\/\d+\?view=overview/, { timeout: 30_000 })
  await expect(page.getByRole("navigation", { name: "Project workspace" })).toBeVisible()
  await pauseCreatedRun(page)
})

test("2. creates a project from website URL and prompt using the guarded deterministic reader", async ({ page }) => {
  await interpret(page, prompt, "https://fixture-roofing.example.test")
  await expect(page.getByRole("textbox", { name: /^Business Editable interpretation$/ })).toContainText("Fixture Roofing")
  await page.getByRole("button", { name: "Approve Brief and Build Draft", exact: true }).click()
  await page.waitForURL(/\/forge\/\d+\?view=overview/, { timeout: 30_000 })
  await pauseCreatedRun(page)
})

test("3. reviews and edits the interpreted brief before creation", async ({ page }) => {
  await interpret(page)
  const outcome = page.getByLabel(/^Primary outcome/)
  await expect(outcome).not.toHaveValue("")
  await outcome.fill("Win qualified commercial maintenance contracts.")
  await expect(outcome).toHaveValue("Win qualified commercial maintenance contracts.")
  await page.getByRole("button", { name: "Use your judgement", exact: true }).click()
  await expect(page.getByLabel(/^Open questions/)).toContainText("Use Forge judgement")
})

test("4. approving the brief creates and starts a Forge Run", async ({ page }) => {
  test.setTimeout(240_000)
  await interpret(page, `${prompt} Use a restrained navy and copper direction.`)
  await page.getByRole("button", { name: "Approve Brief and Build Draft", exact: true }).click()
  await page.waitForURL(/\/forge\/(\d+)\?view=overview/, { timeout: 30_000 })
  const projectId = Number(page.url().match(/\/forge\/(\d+)/)?.[1])
  const readCurrentRun = () => page.evaluate(async (id) => {
    const response = await fetch(`/api/forge/projects/${id}/runs/current`, { cache: "no-store" })
    return { ok: response.ok, status: response.status, body: await response.json() }
  }, projectId)
  let runId: number | undefined
  try {
    const response = await readCurrentRun()
    expect(response.ok, `current run API returned ${response.status}`).toBe(true)
    const body = response.body
    expect(body.run).toBeTruthy()
    runId = body.run.id
    createdRunIds.add(runId)
    expect(["running", "paused", "completed"]).toContain(body.run.status)
    let latest = { run: body.run.status as string | undefined, copy: undefined as string | undefined, code: undefined as string | undefined, workspaceCreated: false }
    await expect.poll(async () => {
      await browserApi(page, "/api/forge/jobs/run", "POST", { limit: 1 })
      const current = await readCurrentRun()
      const payload = current.body as { run?: { status: string; steps: Array<{ stage: string; status: string }>; events: Array<{ eventType: string }> } }
      const copy = payload.run?.steps.find((step) => step.stage === "copy")
      const code = payload.run?.steps.find((step) => step.stage === "code_generation")
      latest = { run: payload.run?.status, copy: copy?.status, code: code?.status, workspaceCreated: payload.run?.events.some((event) => event.eventType === "workspace_created") ?? false }
      return latest
    }, { message: "Manual E2E drains should reach code generation with an isolated workspace.", timeout: 120_000, intervals: [500, 1_000] }).toMatchObject({
      run: expect.stringMatching(/running|paused|completed/), copy: "completed", code: expect.stringMatching(/queued|running|completed/), workspaceCreated: true,
    })
  } finally {
    if (runId) {
      await cancelRun(page, runId, "Journey 4 reached its controlled transition; cancel remaining work.")
      await writeFile("test-results/forge-journey-4-run.json", JSON.stringify({ runId }), "utf8")
    }
  }
})

test("5. observes an active Forge Run in the production workspace", async ({ page }) => {
  const row = await fixture(page, "E2E Active Run")
  await page.goto(`/forge/${row.project_id}?view=overview`)
  await expect(page.getByRole("heading", { level: 1, name: "E2E Active Run", exact: true })).toBeVisible()
  await expect(page.getByText(/Current run/i).first()).toBeVisible()
  await expect(page.getByText(/running/i).first()).toBeVisible()
})

test("6. pauses a running Forge Run through the authenticated API", async ({ page }) => {
  const row = await fixture(page, "E2E Active Run")
  const response = await browserApi(page, `/api/forge/runs/${row.run_id}/pause`, "POST", { reason: "Release journey pause verification." })
  expect(response.ok).toBe(true)
  expect((await runState(page, row.run_id)).status).toBe("paused")
})

test("7. resumes the paused Forge Run and records the transition", async ({ page }) => {
  const row = await fixture(page, "E2E Active Run")
  const response = await browserApi(page, `/api/forge/runs/${row.run_id}/resume`, "POST", {})
  expect(response.ok).toBe(true)
  const state = await runState(page, row.run_id)
  expect(state.status).not.toBe("paused")
  expect(state.events).toContain("run_started")
})

test("8. displays a provider failure with an operator-facing recovery", async ({ page }) => {
  const row = await fixture(page, "E2E Provider Failure")
  await page.goto(`/forge/${row.project_id}?view=attention&run=${row.run_id}&stage=${row.stage}&item=${encodeURIComponent(row.incident_id)}`)
  await expect(page.getByRole("heading", { name: "Needs attention", exact: true })).toBeVisible()
  const incident = page.locator(`.project-attention-view:visible [data-incident-id="${row.incident_id}"]`)
  await expect(incident).toContainText(/Anthropic is unavailable/i)
  await expect(incident).toContainText(/fallback/i)
  await expect(page).toHaveURL(new RegExp(`item=${encodeURIComponent(row.incident_id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))
})

test("9. retries a provider-failed stage through the real run API", async ({ page }) => {
  const row = await fixture(page, "E2E Provider Failure")
  const response = await browserApi(page, `/api/forge/runs/${row.run_id}/steps/${row.stage}/retry`, "POST", {})
  expect(response.ok).toBe(true)
  expect((await runState(page, row.run_id)).events).toContain("step_retry_requested")
})

test("10. displays a failed functional QA stage", async ({ page }) => {
  const row = await fixture(page, "E2E QA Failure")
  await page.goto(`/forge/${row.project_id}?view=attention`)
  const incident = page.locator(`.project-attention-view:visible [data-incident-id="${row.incident_id}"]`)
  await expect(incident.getByRole("heading", { name: "Quality Check Failed", exact: true })).toBeVisible()
  await expect(incident).toContainText(/Functional QA failed/i)
  await expect(incident.getByRole("button", { name: "Retry safely", exact: true })).toBeVisible()
})

test("11. requests repair by retrying the failed atomic QA stage", async ({ page }) => {
  const row = await fixture(page, "E2E QA Failure")
  const response = await browserApi(page, `/api/forge/runs/${row.run_id}/steps/${row.stage}/retry`, "POST", {})
  expect(response.ok).toBe(true)
  expect((await runState(page, row.run_id)).events).toContain("step_retry_requested")
})

for (const [number, viewport, width, height] of [
  [12, "desktop", 1440, 900],
  [13, "tablet", 1024, 768],
  [14, "mobile", 390, 844],
] as const) {
  test(`${number}. opens the ${viewport} preview workspace`, async ({ page }) => {
    const row = await fixture(page, "E2E Preview Ready")
    if (number === 12) {
      await expectJourneyFourIsolated(page)
    }
    await page.setViewportSize({ width, height })
    await page.goto(`/forge/${row.project_id}?view=preview&viewport=${viewport}`)
    await expect(page.getByRole("heading", { name: "Review preview", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled()
    await expect(page.getByRole("button", { name: "Internally approve preview", exact: true })).toBeVisible()
    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      shell: (() => {
        const element = document.querySelector<HTMLElement>(".admin-shell")
        const rect = element?.getBoundingClientRect()
        return element && rect ? { left: rect.left, right: rect.right, width: rect.width, scrollWidth: element.scrollWidth } : null
      })(),
      sidebar: (() => {
        const element = document.querySelector<HTMLElement>(".admin-sidebar")
        const rect = element?.getBoundingClientRect()
        return element && rect ? { left: rect.left, right: rect.right, width: rect.width, scrollWidth: element.scrollWidth } : null
      })(),
      offenders: [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((element) => !element.closest(".project-view-nav"))
        .map((element) => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right }))
        .filter((element) => element.right > window.innerWidth + 1)
        .slice(0, 10),
      overflowingContainers: [...document.querySelectorAll<HTMLElement>("body *")]
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }))
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .slice(0, 15),
    }))
    expect(overflow, JSON.stringify(overflow)).toMatchObject({
      documentWidth: width,
      viewportWidth: width,
      offenders: [],
    })
  })
}

test("15. submits guarded feedback and invalidates only affected run stages", async ({ page }) => {
  const row = await fixture(page, "E2E Feedback Ready")
  await page.goto(`/forge/${row.project_id}?view=preview`)
  await page.getByRole("button", { name: "Request changes", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Preview feedback", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Internally approve preview", exact: true })).toBeVisible()
  await page.getByLabel("Forge command").fill("Apply this client feedback: make the layout more premium without changing the approved copy.")
  await page.getByRole("button", { name: "Send", exact: true }).click()
  await expect(page.getByText("Confirmation required", { exact: true })).toBeVisible({ timeout: 45_000 })
  await page.getByRole("button", { name: "Confirm and Run", exact: true }).click()
  await expect(page.getByText(/Applied the feedback scope/i)).toBeVisible({ timeout: 30_000 })
  await expect.poll(async () => {
    const response = await browserApi(page, `/api/forge/runs/${row.run_id}`)
    const payload = response.body as {
      run: { steps: Array<{ stage: string; status: string }>; events: Array<{ eventType: string }> }
    }
    return {
      research: payload.run.steps.find((step) => step.stage === "research")?.status,
      copy: payload.run.steps.find((step) => step.stage === "copy")?.status,
      design: payload.run.steps.find((step) => step.stage === "design_direction")?.status,
      invalidated: payload.run.events.some((event) => event.eventType === "command_feedback_invalidated"),
    }
  }).toEqual({ research: "completed", copy: "completed", design: expect.not.stringMatching(/^completed$/), invalidated: true })
})

test("16. approves the preview through the existing project action", async ({ page }) => {
  const row = await fixture(page, "E2E Preview Ready")
  await page.goto(`/forge/${row.project_id}?view=preview`)
  await page.getByRole("button", { name: "Internally approve preview", exact: true }).click()
  await expect(page).toHaveURL(/view=preview/)
  await expect(page.getByRole("button", { name: "Record client approval", exact: true })).toBeVisible()
  const project = await browserApi(page, `/api/forge/projects/${row.project_id}`)
  expect((project.body as { project: { status: string } }).project.status).toBe("client_review")
  await page.getByRole("button", { name: "Advanced", exact: true }).click()
  await page.getByRole("button", { name: "Activity", exact: true }).click()
  await expect(page.getByText(/Recorded internal preview approval/i)).toBeVisible()
})

test("17. blocks deployment without the required final evidence and approval", async ({ page }) => {
  const row = await fixture(page, "E2E Deployment Blocked")
  const response = await browserApi(page, `/api/forge/projects/${row.project_id}/deploy`, "POST", {
    action: "mark_deployed", method: "manual", confirmations: {},
  })
  expect(response.ok).toBe(false)
  expect(response.status).toBe(400)
  expect((response.body as { error: string }).error).toMatch(/approval|ready|checklist|candidate/i)
})

test("18. opens Advanced records for historical tasks, artifacts and activity", async ({ page }) => {
  const row = await fixture(page, "E2E Active Run")
  await page.goto(`/forge/${row.project_id}?view=advanced`)
  await expect(page.getByRole("button", { name: "Tasks", exact: true })).toBeVisible()
  await expect(page.getByText(/fixture/i).first()).toBeVisible()
  await page.getByRole("button", { name: "Artifacts", exact: true }).click()
  await expect(page.getByText(/artifact/i).first()).toBeVisible()
  await page.getByRole("button", { name: "Activity", exact: true }).click()
  await expect(page.getByText(/activity fixture/i)).toBeVisible()
})

async function fixture(page: Page, name: string) {
  if (!page.url().startsWith("http")) await page.goto("/forge")
  const projectsResponse = await browserApi(page, "/api/forge/projects")
  expect(projectsResponse.ok).toBe(true)
  const projectsBody = projectsResponse.body as { projects?: Array<{ id: number; name: string }> }
  const project = projectsBody.projects?.find((item) => item.name === name)
  expect(project, `Fixture project ${name} should exist`).toBeTruthy()
  const runResponse = await browserApi(page, `/api/forge/projects/${project!.id}/runs/current`)
  expect(runResponse.ok).toBe(true)
  const runBody = runResponse.body as { run?: { id: number; status: string; steps: Array<{ stage: string; status: string }> } }
  expect(runBody.run).toBeTruthy()
  const stage = runBody.run!.steps[0]!.stage
  const category = name === "E2E Provider Failure" ? "provider_unavailable" : name === "E2E QA Failure" ? "quality_failure" : undefined
  const technicalReference = name === "E2E Provider Failure" ? "fixture-provider" : name === "E2E QA Failure" ? "fixture-qa" : undefined
  return {
    project_id: project!.id,
    run_id: runBody.run!.id,
    stage,
    run_status: runBody.run!.status,
    step_status: runBody.run!.steps[0]!.status,
    incident_id: category && technicalReference ? incidentIdentity(project!.id, runBody.run!.id, stage, category, technicalReference) : "",
  }
}

async function expectJourneyFourIsolated(page: Page) {
  const evidence = JSON.parse(await readFile("test-results/forge-journey-4-run.json", "utf8")) as { runId: number }
  expect((await runState(page, evidence.runId)).status).toBe("cancelled")
  await unlink("test-results/forge-journey-4-run.json")
}

function incidentIdentity(projectId: number, runId: number, stage: string, category: string, technicalReference: string) {
  return `incident:${[projectId, runId, stage, "none", category, technicalReference].map((part) => encodeURIComponent(String(part))).join(":")}`
}

async function cancelRun(page: Page, runId: number, reason: string) {
  const state = await runState(page, runId)
  if (["completed", "cancelled"].includes(state.status)) return
  const response = await browserApi(page, `/api/forge/runs/${runId}/cancel`, "POST", { reason })
  expect(response.ok).toBe(true)
  expect((await runState(page, runId)).status).toBe("cancelled")
}

async function runState(page: Page, runId: number) {
  const response = await browserApi(page, `/api/forge/runs/${runId}`)
  expect(response.ok).toBe(true)
  const body = response.body as { run: { status: string; events: Array<{ eventType: string }> } }
  return { status: body.run.status, events: body.run.events.map((event) => event.eventType) }
}

async function browserApi(page: Page, path: string, method = "GET", data?: unknown) {
  return page.evaluate(async ({ path: requestPath, method: requestMethod, data: requestData }) => {
    const response = await fetch(requestPath, {
      method: requestMethod,
      cache: "no-store",
      headers: requestData === undefined ? undefined : { "content-type": "application/json" },
      body: requestData === undefined ? undefined : JSON.stringify(requestData),
    })
    return { ok: response.ok, status: response.status, body: await response.json() }
  }, { path, method, data })
}

async function pauseCreatedRun(page: Page) {
  const projectId = Number(page.url().match(/\/forge\/(\d+)/)?.[1])
  expect(projectId).toBeGreaterThan(0)
  const current = await browserApi(page, `/api/forge/projects/${projectId}/runs/current`)
  expect(current.ok).toBe(true)
  const runId = (current.body as { run?: { id: number } }).run?.id
  expect(runId).toBeTruthy()
  createdRunIds.add(runId!)
  await cancelRun(page, runId!, "Release journey fixture created successfully; cancel downstream generation.")
}
