import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { validateDocumentationLinks, loadDocumentation } from "./check-documentation-links.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("accepts repository documentation links and canonical release references", () => {
  assert.deepEqual(validateDocumentationLinks(loadDocumentation(root), root), [])
})

test("rejects missing, malformed and escaping documentation targets", () => {
  const documents = loadDocumentation(root)
  documents.push({
    path: "docs/link-policy-fixture.md",
    content: "[missing](missing.md)\n[invalid](bad%ZZ.md)\n[outside](../../outside.md)\n",
  })
  const failures = validateDocumentationLinks(documents, root)
  assert(failures.some((failure) => failure.startsWith("[broken-link] docs/link-policy-fixture.md")))
  assert(failures.some((failure) => failure.startsWith("[invalid-link] docs/link-policy-fixture.md")))
  assert(failures.some((failure) => failure.startsWith("[outside-repository] docs/link-policy-fixture.md")))
})

test("rejects removal of the canonical release-runbook reference", () => {
  const documents = loadDocumentation(root).map((document) => document.path === "docs/releases/README.md"
    ? { ...document, content: document.content.replace("../operations/release-runbook.md", "rc-2026-07-20.md") }
    : document)
  assert(validateDocumentationLinks(documents, root).some((failure) => failure === "[canonical-reference] docs/releases/README.md must link to ../operations/release-runbook.md"))
})

test("ignores external links, page anchors, application routes and fenced examples", () => {
  const documents = loadDocumentation(root)
  documents.push({
    path: "docs/link-ignore-fixture.md",
    content: "[web](https://example.com) [section](#section) [route](/api/health)\n```md\n[example](missing.md)\n```\n",
  })
  assert.deepEqual(validateDocumentationLinks(documents, root), [])
})
