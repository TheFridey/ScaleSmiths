import { describe, expect, it } from "vitest"
import {
  buildApprovedFactFromClarification,
  buildForgeClarificationQueue,
  taskCanResumeAfterClarifications,
} from "./forge-clarifications"

describe("Forge clarification queue", () => {
  it("asks minimal grouped questions for missing and contradictory facts", () => {
    const questions = buildForgeClarificationQueue({
      missingFacts: [
        { text: "Which postcode areas do you serve?", sourceType: "artifact", sourceDetail: "copy:1", taskId: 10 },
        { text: "service area missing from homepage copy", sourceType: "artifact", sourceDetail: "copy:2", taskId: 10 },
        { text: "Which phone number is authoritative?", sourceType: "intake", sourceDetail: "intake", taskId: 10 },
      ],
    })

    expect(questions).toHaveLength(2)
    expect(questions.map((item) => item.factKey)).toEqual(["authoritative_phone_number", "service_areas"])
    expect(questions[0]).toMatchObject({ urgency: "critical", assignee: "client", category: "contact" })
    expect(questions[1]?.evidence).toHaveLength(2)
  })

  it("does not ask questions already answered by approved facts, memory, or open questions", () => {
    const questions = buildForgeClarificationQueue({
      missingFacts: [
        { text: "Which postcode areas do you serve?", sourceType: "artifact" },
        { text: "Which phone number is authoritative?", sourceType: "artifact" },
        { text: "Are these prices public or quote-only?", sourceType: "artifact" },
      ],
      approvedFacts: [{ key: "service_areas", value: "NG15, NG16 and nearby Nottinghamshire areas" }],
      existingQuestions: [{ factKey: "authoritative_phone_number", status: "open" }],
    })

    expect(questions).toHaveLength(1)
    expect(questions[0]?.factKey).toBe("public_pricing_policy")
  })

  it("re-asks time-sensitive facts when revalidation has expired", () => {
    const now = new Date("2026-07-12T12:00:00Z")
    const questions = buildForgeClarificationQueue({
      now,
      missingFacts: [{ text: "Is this accreditation current?", sourceType: "artifact" }],
      approvedFacts: [{
        key: "current_accreditations",
        value: "Federation membership active",
        revalidateAfter: "2026-07-01T00:00:00Z",
      }],
    })

    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatchObject({ factKey: "current_accreditations", category: "credential" })
  })

  it("requires relevant approved facts before resuming a blocked task", () => {
    const questions = [{ factKey: "service_areas", status: "approved", taskId: 42 }]
    expect(taskCanResumeAfterClarifications({ blockedTaskId: 42, questions, approvedFacts: [] })).toBe(false)
    expect(taskCanResumeAfterClarifications({
      blockedTaskId: 42,
      questions,
      approvedFacts: [{ key: "service_areas", value: "NG15 and NG16", approvedAt: new Date() }],
    })).toBe(true)
  })

  it("builds approved project facts with answer provenance", () => {
    const approvedAt = new Date("2026-07-12T12:00:00Z")
    const fact = buildApprovedFactFromClarification({
      factKey: "Authoritative Phone Number",
      answer: "0115 123 4567",
      category: "contact",
      questionId: 7,
      taskId: 3,
      answeredBy: "client@example.com",
      approvedBy: "owner@example.com",
      approvedAt,
    })

    expect(fact).toMatchObject({
      key: "authoritative_phone_number",
      value: "0115 123 4567",
      sourceType: "clarification_answer",
      sourceQuestionId: 7,
      sourceTaskId: 3,
      answeredBy: "client@example.com",
      approvedBy: "owner@example.com",
    })
    expect(fact.provenanceJson).toMatchObject({ questionId: 7, approvedAt: approvedAt.toISOString() })
  })
})
