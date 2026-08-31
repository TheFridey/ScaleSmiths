"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { AdminClientRequestRow, AdminMonthlyReport, AdminTimelineEvent } from "../ClientRequestsQueue"

interface ReportDraft { title: string; summary: string; htmlContent: string }

export function useRequestMonthlyReports({
  selected,
  setRequests,
  setBusyAction,
  setActionError,
}: {
  selected: AdminClientRequestRow | null
  setRequests: Dispatch<SetStateAction<AdminClientRequestRow[]>>
  setBusyAction: Dispatch<SetStateAction<string | null>>
  setActionError: Dispatch<SetStateAction<string | null>>
}) {
  const now = new Date()
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1)
  const [reportYear, setReportYear] = useState(now.getFullYear())
  const [monthlyReports, setMonthlyReports] = useState<AdminMonthlyReport[]>([])
  const [activeReport, setActiveReport] = useState<AdminMonthlyReport | null>(null)
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null)
  const selectedClientId = selected?.clientId ?? null
  const selectedRequestId = selected?.id ?? null

  useEffect(() => {
    setMonthlyReports([])
    setActiveReport(null)
    setReportDraft(null)
    if (!selectedClientId) return
    const clientId = selectedClientId
    const controller = new AbortController()

    async function loadReports() {
      try {
        const response = await fetch(`/api/monthly-reports?clientId=${encodeURIComponent(clientId)}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.ok || controller.signal.aborted) return
        const reports = Array.isArray(json.reports) ? json.reports as AdminMonthlyReport[] : []
        setMonthlyReports(reports)
        selectReport(reports[0] ?? null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        // Report loading is non-critical for request triage.
      }
    }

    void loadReports()
    return () => controller.abort()
  }, [selectedClientId])

  function selectReport(report: AdminMonthlyReport | null) {
    setActiveReport(report)
    setReportDraft(report ? draftFrom(report) : null)
  }

  async function generateMonthlyReport() {
    if (!selectedClientId) return
    return runReportAction("generate-report", "Unable to generate monthly report.", async () => {
      const report = await reportRequest("/api/monthly-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId, month: reportMonth, year: reportYear }),
      }, "Unable to generate monthly report.")
      setMonthlyReports((current) => [report, ...current.filter((item) => item.id !== report.id)])
      selectReport(report)
    })
  }

  async function saveReport() {
    if (!activeReport || !reportDraft) return
    return runReportAction("save-report", "Unable to save monthly report.", async () => {
      const report = await reportRequest(`/api/monthly-reports/${activeReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...reportDraft }),
      }, "Unable to save monthly report.")
      selectReport(report)
      setMonthlyReports((current) => current.map((item) => item.id === report.id ? report : item))
    })
  }

  async function publishReport() {
    if (!activeReport) return
    return runReportAction("publish-report", "Unable to publish monthly report.", async () => {
      const { report, timelineEvent } = await reportRequestWithTimeline(`/api/monthly-reports/${activeReport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      }, "Unable to publish monthly report.")
      selectReport(report)
      setMonthlyReports((current) => current.map((item) => item.id === report.id ? report : item))
      if (timelineEvent) setRequests((current) => current.map((request) => request.clientId === report.clientId
        ? { ...request, timelineEvents: request.id === selectedRequestId ? [...request.timelineEvents, timelineEvent] : request.timelineEvents }
        : request))
    })
  }

  async function reviewReport() {
    if (!activeReport) return
    return runReportAction("review-report", "Unable to mark monthly report as reviewed.", async () => {
      const report = await reportRequest(`/api/monthly-reports/${activeReport.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review" }),
      }, "Unable to mark monthly report as reviewed.")
      selectReport(report)
      setMonthlyReports((current) => current.map((item) => item.id === report.id ? report : item))
    })
  }

  async function runReportAction(action: string, fallback: string, operation: () => Promise<void>) {
    setBusyAction(action)
    setActionError(null)
    try { await operation() }
    catch (error) { setActionError(error instanceof Error ? error.message : fallback) }
    finally { setBusyAction(null) }
  }

  return {
    reportMonth, setReportMonth, reportYear, setReportYear,
    monthlyReports, activeReport, reportDraft, setReportDraft, selectReport,
    generateMonthlyReport, saveReport, reviewReport, publishReport,
  }
}

async function reportRequest(url: string, init: RequestInit, fallback: string): Promise<AdminMonthlyReport> {
  return (await reportRequestWithTimeline(url, init, fallback)).report
}

async function reportRequestWithTimeline(url: string, init: RequestInit, fallback: string): Promise<{ report: AdminMonthlyReport; timelineEvent: AdminTimelineEvent | null }> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.ok || !json.report) throw new Error(json?.error ?? fallback)
  return { report: json.report as AdminMonthlyReport, timelineEvent: json.timelineEvent as AdminTimelineEvent | null ?? null }
}

function draftFrom(report: AdminMonthlyReport): ReportDraft {
  return { title: report.title, summary: report.summary, htmlContent: report.htmlContent }
}
