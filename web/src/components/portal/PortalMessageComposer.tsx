"use client"

import { FormEvent, useMemo, useState } from "react"
import { Mail, Send } from "lucide-react"

interface PortalMessageComposerProps {
  clientName: string
  clientId: string
}

export function PortalMessageComposer({ clientName, clientId }: PortalMessageComposerProps) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")

  const href = useMemo(() => {
    const cleanSubject = subject.trim() || `Portal message from ${clientName}`
    const cleanBody = [
      `Client workspace: ${clientName}`,
      `Client ID: ${clientId}`,
      "",
      message.trim() || "Hi ScaleSmiths,",
    ].join("\n")

    return `mailto:hello@scalesmiths.io?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(cleanBody)}`
  }, [clientId, clientName, message, subject])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.location.href = href
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-b1 bg-s1 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-b2 bg-s2">
          <Mail size={18} className="text-acc" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-syne text-xl font-bold">Direct project message</h2>
          <p className="mt-1 font-dm text-sm text-t2">Send questions, approvals, content changes, or launch notes.</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <label htmlFor="portal-message-subject" className="mb-1.5 block font-dm text-sm text-t2">
            Subject
          </label>
          <input
            id="portal-message-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Homepage content change, launch question..."
            className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm text-t1 outline-none transition-colors focus:border-acc/50"
          />
        </div>
        <div>
          <label htmlFor="portal-message-body" className="mb-1.5 block font-dm text-sm text-t2">
            Message
          </label>
          <textarea
            id="portal-message-body"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add the detail we need, links, decisions, or anything blocking progress."
            rows={7}
            className="w-full resize-y rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm leading-relaxed text-t1 outline-none transition-colors focus:border-acc/50"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary mt-5 font-dm text-sm">
        Send Message <Send size={15} aria-hidden="true" />
      </button>
    </form>
  )
}
