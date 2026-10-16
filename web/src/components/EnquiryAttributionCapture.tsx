"use client"

import { useEffect } from "react"
import { captureEnquiryAttribution } from "@/lib/enquiry-attribution-client"

/** Records the first page in this tab so a later enquiry still knows where the visit started. */
export function EnquiryAttributionCapture() {
  useEffect(() => {
    captureEnquiryAttribution()
  }, [])
  return null
}
