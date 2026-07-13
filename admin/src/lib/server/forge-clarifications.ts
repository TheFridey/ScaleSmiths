import "server-only"

import { and, eq, isNull } from "drizzle-orm"
import {
  buildApprovedFactFromClarification,
  buildForgeClarificationQueue,
  type ForgeClarificationSignal,
} from "@/lib/forge-clarifications"
import { db } from "@/lib/db"
import {
  forgeActivityLogs,
  forgeArtifacts,
  forgeClarificationQuestions,
  forgeMemories,
  forgeProjectFacts,
  forgeTasks,
} from "@/lib/schema"

export async function buildPersistedForgeClarificationQueue(projectId: number) {
  const [tasks, artifacts, memories, facts, existingQuestions] = await Promise.all([
    db.select({ id: forgeTasks.id, inputJson: forgeTasks.inputJson, outputJson: forgeTasks.outputJson, validationResult: forgeTasks.validationResult }).from(forgeTasks).where(eq(forgeTasks.projectId, projectId)),
    db.select({ id: forgeArtifacts.id, type: forgeArtifacts.type, metadataJson: forgeArtifacts.metadataJson, content: forgeArtifacts.content }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), isNull(forgeArtifacts.supersededAt))),
    db.select({ key: forgeMemories.key, value: forgeMemories.value }).from(forgeMemories).where(eq(forgeMemories.projectId, projectId)),
    db.select({ key: forgeProjectFacts.key, value: forgeProjectFacts.value, category: forgeProjectFacts.category, approvedAt: forgeProjectFacts.approvedAt, expiresAt: forgeProjectFacts.expiresAt, revalidateAfter: forgeProjectFacts.revalidateAfter }).from(forgeProjectFacts).where(and(eq(forgeProjectFacts.projectId, projectId), isNull(forgeProjectFacts.supersededAt))),
    db.select({ id: forgeClarificationQuestions.id, factKey: forgeClarificationQuestions.factKey, status: forgeClarificationQuestions.status, taskId: forgeClarificationQuestions.taskId, question: forgeClarificationQuestions.question, category: forgeClarificationQuestions.category, urgency: forgeClarificationQuestions.urgency, assignee: forgeClarificationQuestions.assignee, groupKey: forgeClarificationQuestions.groupKey, evidenceJson: forgeClarificationQuestions.evidenceJson, answer: forgeClarificationQuestions.answer, approvedAt: forgeClarificationQuestions.approvedAt }).from(forgeClarificationQuestions).where(eq(forgeClarificationQuestions.projectId, projectId)),
  ])

  const artifactSignals = artifacts.flatMap((artifact): ForgeClarificationSignal[] => {
    const metadata = artifact.metadataJson ?? {}
    return [
      ...signalsFromMetadata(metadata, ["missingFacts", "clarificationQuestions"], "artifact", `${artifact.type}:${artifact.id}`, null, artifact.id),
      ...signalsFromMetadata(metadata, ["contradictions", "knownContradictions"], "artifact", `${artifact.type}:${artifact.id}`, null, artifact.id),
      ...signalsFromMetadata(metadata, ["unsupportedClaims", "highRiskClaims"], "artifact", `${artifact.type}:${artifact.id}`, null, artifact.id),
    ]
  })
  const taskSignals = tasks.flatMap((task): ForgeClarificationSignal[] => [
    ...signalsFromMetadata(task.inputJson ?? {}, ["missingFacts", "clarificationQuestions", "contradictions"], "task", `task:${task.id}`, task.id, null),
    ...signalsFromMetadata(task.outputJson ?? {}, ["missingFacts", "clarificationQuestions", "contradictions"], "task", `task:${task.id}`, task.id, null),
    ...signalsFromMetadata(task.validationResult ?? {}, ["missingFacts", "clarificationQuestions", "contradictions"], "task", `task:${task.id}`, task.id, null),
  ])
  const memoryFacts = memories.map((memory) => ({ key: memory.key, value: memory.value, category: "memory" }))
  const drafts = buildForgeClarificationQueue({
    missingFacts: [...artifactSignals, ...taskSignals],
    approvedFacts: [...facts, ...memoryFacts],
    existingQuestions,
  })

  for (const draft of drafts) {
    await db.insert(forgeClarificationQuestions).values({
      projectId,
      taskId: draft.taskId,
      artifactId: draft.artifactId,
      factKey: draft.factKey,
      question: draft.question,
      category: draft.category,
      urgency: draft.urgency,
      assignee: draft.assignee,
      groupKey: draft.groupKey,
      duplicateKey: draft.duplicateKey,
      evidenceJson: draft.evidence,
      sourceType: draft.sourceType,
      sourceDetail: draft.sourceDetail,
      expiresAt: draft.expiresAt,
      revalidateAfter: draft.revalidateAfter,
      metadataJson: { clarificationVersion: "2026-07-12.1" },
    }).onConflictDoNothing()
  }

  const refreshedQuestions = await db.select().from(forgeClarificationQuestions).where(eq(forgeClarificationQuestions.projectId, projectId))
  return { questions: refreshedQuestions, facts, generated: drafts.length }
}

export async function answerForgeClarificationQuestion({
  projectId,
  questionId,
  answer,
  actor,
  approve,
  expiresAt,
  revalidateAfter,
}: {
  projectId: number
  questionId: number
  answer: string
  actor: string
  approve: boolean
  expiresAt?: Date | null
  revalidateAfter?: Date | null
}) {
  const trimmed = answer.trim()
  if (trimmed.length < 2) throw new Error("A meaningful answer is required.")
  return db.transaction(async (tx) => {
    const [question] = await tx.select().from(forgeClarificationQuestions).where(and(eq(forgeClarificationQuestions.projectId, projectId), eq(forgeClarificationQuestions.id, questionId))).limit(1)
    if (!question) throw new Error("Clarification question not found.")
    const now = new Date()
    const status = approve ? "approved" : "answered"
    await tx.update(forgeClarificationQuestions).set({
      answer: trimmed,
      status,
      answeredBy: actor,
      answeredAt: now,
      approvedBy: approve ? actor : null,
      approvedAt: approve ? now : null,
      expiresAt: expiresAt ?? question.expiresAt,
      revalidateAfter: revalidateAfter ?? question.revalidateAfter,
      updatedAt: now,
    }).where(eq(forgeClarificationQuestions.id, question.id))

    if (approve) {
      const fact = buildApprovedFactFromClarification({
        factKey: question.factKey,
        answer: trimmed,
        category: question.category,
        questionId: question.id,
        taskId: question.taskId,
        artifactId: question.artifactId,
        answeredBy: actor,
        approvedBy: actor,
        approvedAt: now,
        expiresAt: expiresAt ?? question.expiresAt,
        revalidateAfter: revalidateAfter ?? question.revalidateAfter,
      })
      const [existingFact] = await tx.select({ id: forgeProjectFacts.id }).from(forgeProjectFacts).where(and(eq(forgeProjectFacts.projectId, projectId), eq(forgeProjectFacts.key, fact.key))).limit(1)
      if (existingFact) {
        await tx.update(forgeProjectFacts).set({ ...fact, updatedAt: now }).where(eq(forgeProjectFacts.id, existingFact.id))
      } else {
        await tx.insert(forgeProjectFacts).values({ projectId, ...fact })
      }
    }

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: approve ? "clarification_answer_approved" : "clarification_answer_recorded",
      message: approve ? `Approved clarification answer for ${question.factKey}.` : `Recorded clarification answer for ${question.factKey}.`,
      metadataJson: { questionId: question.id, factKey: question.factKey, taskId: question.taskId, approved: approve },
    })
    return { ok: true, status }
  })
}

function signalsFromMetadata(metadata: Record<string, unknown>, keys: string[], sourceType: ForgeClarificationSignal["sourceType"], sourceDetail: string, taskId: number | null, artifactId: number | null) {
  return keys.flatMap((key) => toSignalArray(metadata[key], sourceType, sourceDetail, taskId, artifactId))
}

function toSignalArray(value: unknown, sourceType: ForgeClarificationSignal["sourceType"], sourceDetail: string, taskId: number | null, artifactId: number | null): ForgeClarificationSignal[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): ForgeClarificationSignal[] => {
    if (typeof item === "string" && item.trim()) return [{ text: item, sourceType, sourceDetail, taskId, artifactId }]
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>
      const text = typeof record.question === "string" ? record.question : typeof record.text === "string" ? record.text : typeof record.fact === "string" ? record.fact : ""
      if (!text.trim()) return []
      return [{
        factKey: typeof record.factKey === "string" ? record.factKey : undefined,
        text,
        sourceType,
        sourceDetail,
        taskId,
        artifactId,
        urgency: record.urgency === "critical" || record.urgency === "high" || record.urgency === "medium" || record.urgency === "low" ? record.urgency : undefined,
      }]
    }
    return []
  })
}
