import { FORGE_PROJECT_STATES, type ForgeProjectState } from "./forge-state-machine"

/*
 * Preview approval in the Forge project workspace.
 *
 * The next action ("Record client approval" after an internal approval) used to appear only once a complete server
 * re-render of the project page reached the browser. The PATCH that records the approval already returns the persisted
 * project, but the interface ignored it, so a slow re-render left the page offering an approval that had already been
 * recorded (reproduced by delaying the page's RSC responses; the same 11.1 s failure was seen intermittently in CI).
 *
 * The interface now advances only on the server's own confirmation, the project it returns from the committed update,
 * and gives way to the page's props as soon as the next server render arrives. Nothing here is optimistic: a failed or
 * unconfirmed request never changes the displayed status.
 */

export type PreviewDecision = { nextStatus: ForgeProjectState; approvalScope: "internal" | "client"; label: string; busyLabel: string; doneMessage: string }

/** The decision available from a status, or null where the preview cannot be approved from here. */
export function previewDecisionFor(status: string): PreviewDecision | null {
  if (status === "preview") return { nextStatus: "client_review", approvalScope: "internal", label: "Internally approve preview", busyLabel: "Recording internal approval…", doneMessage: "Internal approval recorded." }
  if (status === "client_review") return { nextStatus: "ready_to_deploy", approvalScope: "client", label: "Record client approval", busyLabel: "Recording client approval…", doneMessage: "Client approval recorded." }
  return null
}

const isProjectState = (value: unknown): value is ForgeProjectState => typeof value === "string" && (FORGE_PROJECT_STATES as readonly string[]).includes(value)

/**
 * The status the server says it persisted, read from the PATCH response body (`{ ok: true, project }`).
 * Returns null when the response does not carry a recognisable status, so the caller does not advance.
 */
export function confirmedStatusFrom(body: unknown): ForgeProjectState | null {
  if (!body || typeof body !== "object") return null
  const project = (body as { project?: unknown }).project
  if (!project || typeof project !== "object") return null
  const status = (project as { status?: unknown }).status
  return isProjectState(status) ? status : null
}

/** A server-confirmed status, valid only for the props snapshot it was confirmed against. */
export type ConfirmedStatus = { basedOn: object; status: ForgeProjectState }

/**
 * The status to display. A confirmation applies only while the page still shows the props it was made against;
 * once a newer server render arrives (a new `project` object), the props are authoritative again, including any
 * change someone else has made since.
 */
export function displayedStatus<S extends string>(project: { status?: S | null }, confirmed: ConfirmedStatus | null): S | ForgeProjectState {
  if (confirmed && confirmed.basedOn === project) return confirmed.status
  return project.status ?? "intake"
}
