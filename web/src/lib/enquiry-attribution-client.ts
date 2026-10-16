"use client"

import {
  ENQUIRY_ATTRIBUTION_STORAGE_KEY,
  EMPTY_ENQUIRY_ATTRIBUTION,
  attributionFromLocation,
  mergeEnquiryAttribution,
  sanitizeEnquiryAttribution,
  type EnquiryAttribution,
} from "./enquiry-attribution"

/**
 * Reads the page the visitor is on now, plus the first page in this tab.
 * The tab memory exists so the enquiry records where the visit started.
 * Google Analytics still receives nothing unless analytics consent is given.
 */
export function readEnquiryAttribution(): EnquiryAttribution {
  if (typeof window === "undefined") return { ...EMPTY_ENQUIRY_ATTRIBUTION }
  const current = attributionFromLocation(window.location.href, document.referrer, window.location.hostname)
  return mergeEnquiryAttribution(readStoredAttribution(), current, window.location.hostname)
}

export function captureEnquiryAttribution() {
  if (typeof window === "undefined") return
  try {
    if (window.sessionStorage.getItem(ENQUIRY_ATTRIBUTION_STORAGE_KEY)) return
    const current = attributionFromLocation(window.location.href, document.referrer, window.location.hostname)
    const firstTouch = sanitizeEnquiryAttribution({
      ...current,
      landingPath: current.submissionPath,
    }, window.location.hostname)
    window.sessionStorage.setItem(ENQUIRY_ATTRIBUTION_STORAGE_KEY, JSON.stringify(firstTouch))
  } catch {
    // Session storage can be blocked. The enquiry still keeps the current page and referrer.
  }
}

function readStoredAttribution(): EnquiryAttribution | null {
  try {
    const raw = window.sessionStorage.getItem(ENQUIRY_ATTRIBUTION_STORAGE_KEY)
    if (!raw) return null
    return sanitizeEnquiryAttribution(JSON.parse(raw), window.location.hostname)
  } catch {
    return null
  }
}
