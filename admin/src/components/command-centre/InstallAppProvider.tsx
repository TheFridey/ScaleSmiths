"use client"

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { Check, Download, RefreshCw, X } from "lucide-react"

type InstallPrompt = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: string }>
}
const InstallContext = createContext<{
  prompt: InstallPrompt | null
  installed: boolean
  unavailable: boolean
  clearPrompt(): void
}>({ prompt: null, installed: false, unavailable: false, clearPrompt: () => undefined })

export function InstallAppProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [offline, setOffline] = useState(false)
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  useEffect(() => {
    let mounted = true,
      reloading = false
    let registration: ServiceWorkerRegistration | undefined
    const hadController = Boolean(navigator.serviceWorker?.controller)
    const standalone = matchMedia("(display-mode: standalone)")
    const checkInstalled = () =>
      setInstalled(
        standalone.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      )
    const install = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const installedEvent = () => {
      setPrompt(null)
      setInstalled(true)
    }
    const connection = () => setOffline(!navigator.onLine)
    const update = () => {
      if (!document.hidden) void registration?.update().catch(() => undefined)
    }
    const controllerChange = () => {
      if (hadController && !reloading) {
        reloading = true
        location.reload()
      }
    }
    const workerChange = () => {
      const worker = registration?.installing
      worker?.addEventListener("statechange", () => {
        if (
          mounted &&
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        )
          setWaiting(worker)
      })
    }
    window.addEventListener("beforeinstallprompt", install)
    window.addEventListener("appinstalled", installedEvent)
    window.addEventListener("online", connection)
    window.addEventListener("offline", connection)
    standalone.addEventListener("change", checkInstalled)
    document.addEventListener("visibilitychange", update)
    checkInstalled()
    connection()
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        controllerChange,
      )
      void navigator.serviceWorker
        .register("/command-centre-sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .then((reg) => {
          if (!mounted) return
          registration = reg
          setWaiting(reg.waiting)
          reg.addEventListener("updatefound", workerChange)
        })
        .catch(() => {
          if (mounted) setUnavailable(true)
        })
    } else setUnavailable(true)
    return () => {
      mounted = false
      window.removeEventListener("beforeinstallprompt", install)
      window.removeEventListener("appinstalled", installedEvent)
      window.removeEventListener("online", connection)
      window.removeEventListener("offline", connection)
      standalone.removeEventListener("change", checkInstalled)
      document.removeEventListener("visibilitychange", update)
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controllerChange,
      )
      registration?.removeEventListener("updatefound", workerChange)
    }
  }, [])
  return (
    <InstallContext.Provider value={{ prompt, installed, unavailable, clearPrompt: () => setPrompt(null) }}>
      {children}
      {(offline || waiting) && (
        <div className="admin-app-status" role="status">
          {offline && (
            <span>Offline. Private records require a connection.</span>
          )}
          {waiting && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Save or close open entries before updating. Reload now?",
                  )
                )
                  waiting.postMessage("ACTIVATE_UPDATE")
              }}
            >
              <RefreshCw size={16} /> Update available
            </button>
          )}
        </div>
      )}
    </InstallContext.Provider>
  )
}

export function InstallAppControl() {
  const { prompt, installed, unavailable, clearPrompt } = useContext(InstallContext)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="admin-icon-button"
        aria-label={installed ? "App installed" : "Install app"}
        title={installed ? "App installed" : "Install app"}
        onClick={() => dialog.current?.showModal()}
      >
        {installed ? <Check size={18} /> : <Download size={18} />}
      </button>
      <dialog
        ref={dialog}
        className="admin-install-dialog"
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
      >
        <header>
          <h2 id={titleId}>ScaleSmiths app</h2>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Close install dialog"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        {installed ? (
          <p>This window is already running as an installed app.</p>
        ) : prompt ? (
          <>
            <p>Add ScaleSmiths to this device.</p>
            <button
              type="button"
              className="admin-install-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError("")
                try {
                  await prompt.prompt()
                  await prompt.userChoice
                  dialog.current?.close()
                } catch {
                  setError(
                    "The browser could not open installation. Use its Install app or Add to Home Screen menu.",
                  )
                } finally {
                  clearPrompt()
                  setBusy(false)
                }
              }}
            >
              <Download size={18} /> Install app
            </button>
          </>
        ) : (
          <>
            {unavailable && (
              <p role="status">
                Automatic installation is unavailable in this browser.
              </p>
            )}
            <dl>
              <dt>iPhone or iPad</dt>
              <dd>Open in Safari, tap Share, then Add to Home Screen.</dd>
              <dt>Android</dt>
              <dd>
                Open in Chrome, then choose Install app or Add to Home screen
                from the browser menu.
              </dd>
              <dt>Desktop</dt>
              <dd>
                Use Chrome or Edge and choose Install app from the browser menu
                or address bar.
              </dd>
            </dl>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </dialog>
    </>
  )
}
