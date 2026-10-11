"use client"
import { useEffect, useState } from "react"
import { Download, RefreshCw } from "lucide-react"
type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: string }>
}
export function PwaLifecycle() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [install, setInstall] = useState<InstallPrompt | null>(null),
    [offline, setOffline] = useState(false)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    let mounted = true,
      registration: ServiceWorkerRegistration | undefined,
      reloading = false
    const installEvent = (event: Event) => {
      event.preventDefault()
      setInstall(event as InstallPrompt)
    }
    const connection = () => setOffline(!navigator.onLine)
    const update = () => {
      if (!document.hidden) void registration?.update().catch(() => undefined)
    }
    const change = () => {
      if (!reloading && navigator.serviceWorker.controller) {
        reloading = true
        location.reload()
      }
    }
    navigator.serviceWorker
      .register("/command-centre-sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (!mounted) return
        registration = reg
        if (reg.waiting) setWaiting(reg.waiting)
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing
          worker?.addEventListener("statechange", () => {
            if (
              mounted &&
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              setWaiting(worker)
          })
        })
        void reg.update().catch(() => undefined)
      })
      .catch(() => undefined)
    window.addEventListener("beforeinstallprompt", installEvent)
    window.addEventListener("online", connection)
    window.addEventListener("offline", connection)
    document.addEventListener("visibilitychange", update)
    navigator.serviceWorker.addEventListener("controllerchange", change)
    connection()
    return () => {
      mounted = false
      window.removeEventListener("beforeinstallprompt", installEvent)
      window.removeEventListener("online", connection)
      window.removeEventListener("offline", connection)
      document.removeEventListener("visibilitychange", update)
      navigator.serviceWorker.removeEventListener("controllerchange", change)
    }
  }, [])
  return (
    <div
      className="cc-pwa-status"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 60,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        maxWidth: "calc(100vw - 100px)",
      }}
    >
      {offline && (
        <span
          role="status"
          style={{ padding: 10, background: "#442429", color: "#ffc2c2" }}
        >
          Offline. Private records require a connection.
        </span>
      )}
      {install && (
        <button
          style={{
            padding: 10,
            background: "#d1b266",
            color: "#181818",
            display: "flex",
            gap: 8,
          }}
          onClick={async () => {
            await install.prompt()
            await install.userChoice
            setInstall(null)
          }}
        >
          <Download size={18} /> Install Command Centre
        </button>
      )}
      {waiting && (
        <button
          style={{
            padding: 10,
            background: "#d1b266",
            color: "#181818",
            display: "flex",
            gap: 8,
          }}
          onClick={() => {
            if (
              window.confirm(
                "Save or close any open entry before updating. Reload the Command Centre now?",
              )
            )
              waiting.postMessage("ACTIVATE_UPDATE")
          }}
        >
          <RefreshCw size={18} /> Update available
        </button>
      )}
    </div>
  )
}
