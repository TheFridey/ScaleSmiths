import { build } from "esbuild"
import { createServer } from "node:http"
import { readFile, mkdir } from "node:fs/promises"
import { chromium } from "playwright"
import assert from "node:assert/strict"
import path from "node:path"

// Component-only browser proof, not an authenticated production journey.
const bundle = await build({
  stdin: { contents: `import React, { useState } from "react";
    import { createRoot } from "react-dom/client";
    import { AdminSidebar, AdminTopBar, MobileSheet, NAV } from "./src/components/admin-shell/AdminShell";
    import { InstallAppProvider } from "./src/components/command-centre/InstallAppProvider";
    import { ClientsTable } from "./src/components/Clients";
    function Fixture() {
      const [collapsed, setCollapsed] = useState(false), [mobile, setMobile] = useState(false);
      return <InstallAppProvider><div className="admin-shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
        <AdminSidebar collapsed={collapsed} focusMode={false} pathname="/command-centre" navigation={NAV} onCollapse={() => setCollapsed(!collapsed)} onSignOut={() => {}} />
        <AdminTopBar pathname="/command-centre" isForge={false} focusMode={false} onOpenNavigation={() => setMobile(true)} onToggleFocus={() => {}} />
        <main className="admin-main">{location.pathname === "/clients" ? <ClientsTable salesProposals={[]} clients={[
          { id:1, name:"Alpha fixture", contactName:"First contact", contactEmail:"alpha@example.test", tier:null, mrr:0, status:"prospect", progress:0 },
          { id:2, name:"Beta fixture", contactName:"Second contact", contactEmail:"beta@example.test", tier:null, mrr:0, status:"prospect", progress:0 }
        ]} /> : <><h1>Command Centre</h1><p>Component verification fixture</p></>}</main>
        <MobileSheet open={mobile} title="Navigation" onClose={() => setMobile(false)}><AdminSidebar collapsed={false} focusMode={false} pathname="/command-centre" navigation={NAV} onCollapse={() => {}} onSignOut={() => {}} /></MobileSheet>
      </div></InstallAppProvider>
    } createRoot(document.getElementById("root")).render(<Fixture />);`,
    resolveDir: process.cwd(), loader: "tsx",
  }, bundle: true, write: false, platform: "browser", jsx: "automatic",
  alias: { "@": path.resolve("src") }, define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "component-router-adapters", setup(build) {
    build.onResolve({ filter: /^(next\/link|next\/navigation|next-auth\/react)$/ }, ({ path }) => ({ path, namespace: "fixture-router" }))
    build.onLoad({ filter: /.*/, namespace: "fixture-router" }, ({ path: name }) => ({
      contents: name === "next/link" ? 'import React from "react"; export default function Link({children,...props}) { return <a {...props}>{children}</a> }'
        : name === "next/navigation" ? 'export const usePathname = () => "/command-centre";' : 'export async function signOut() {}',
      loader: "jsx", resolveDir: process.cwd(),
    }))
  }}],
})
const css = (await readFile("test-results/admin-shell/globals.css", "utf8")) + "\n" + (await readFile("src/app/globals.css", "utf8"))
const worker = await readFile("public/command-centre-sw.js", "utf8")
let workerVersion = 0
const server = createServer((request, response) => {
  if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(bundle.outputFiles[0].text) }
  else if (request.url === "/command-centre-sw.js") { response.setHeader("Content-Type", "application/javascript"); response.end(worker.replace("command-centre-v2", `fixture-worker-${workerVersion}`)) }
  else if (request.url === "/__fixture-update") { workerVersion++; response.end("Updated fixture worker") }
  else { response.setHeader("Content-Type", "text/html"); response.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n.mobile-sheet .admin-sidebar { display:flex; height:100%; border:0; padding:0; } .mt-auto { margin-top:auto; }</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`) }
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const browser = await chromium.launch({ headless: true, channel: "msedge" })
const directory = path.resolve("test-results/admin-shell")
await mkdir(directory, { recursive: true })
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole("button", { name: "Install app", exact: true }).click()
    await page.getByRole("dialog").waitFor()
    await page.getByText("iPhone or iPad", { exact: true }).waitFor()
    await page.screenshot({ path: path.join(directory, `${name}-install.png`) })
    await page.getByRole("button", { name: "Close install dialog" }).click()
    if (name === "mobile") await page.getByRole("button", { name: "Open navigation" }).click()
    const navigation = name === "mobile" ? page.getByRole("dialog") : page.getByRole("complementary")
    await navigation.getByRole("button", { name: "Client delivery", exact: true }).click()
    await navigation.getByRole("link", { name: "Clients", exact: true }).waitFor()
    assert.equal(await navigation.getByRole("link", { name: "Command Centre", exact: true }).isVisible(), false)
    await page.screenshot({ path: path.join(directory, `${name}-navigation.png`) })
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("button[aria-controls]")].every((button) => document.getElementById(button.getAttribute("aria-controls")))), true)
    if (name === "mobile") await page.getByRole("dialog", { name: "Navigation", exact: true }).getByRole("button", { name: "Close navigation" }).click()
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true })
      window.__installCalls = 0
      event.prompt = async () => { window.__installCalls++ }
      event.userChoice = Promise.resolve({ outcome: "accepted" })
      window.dispatchEvent(event)
    })
    await page.getByRole("button", { name: "Install app", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Install app", exact: true }).click()
    assert.equal(await page.evaluate(() => window.__installCalls), 1)
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")))
    await page.getByRole("button", { name: "App installed", exact: true }).waitFor()
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }))
      await fetch("/__fixture-update")
      await (await navigator.serviceWorker.getRegistration()).update()
    })
    await page.getByRole("button", { name: "Update available" }).waitFor()
    page.once("dialog", (dialog) => dialog.accept())
    await Promise.all([page.waitForNavigation(), page.getByRole("button", { name: "Update available" }).click()])
    await page.goto(`http://127.0.0.1:${server.address().port}/clients`)
    await page.getByRole("searchbox", { name: "Search clients" }).fill("Alpha")
    await page.getByRole("link", { name: "Edit Alpha fixture" }).waitFor()
    assert.equal(await page.getByRole("link", { name: "Edit Beta fixture" }).count(), 0)
    await page.screenshot({ path: path.join(directory, `${name}-clients.png`) })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log("Desktop/mobile real shell components: group navigation, install fallback, dialogs and overflow checks passed.")
} finally { await browser.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
