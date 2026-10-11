/* Network-only: private documents, sessions and APIs never enter Cache Storage. */
const VERSION = "command-centre-v1";
self.addEventListener("install", () => {});
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("message", event => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
  if (event.data === "VERSION") event.source?.postMessage({ type: "VERSION", version: VERSION });
});
self.addEventListener("fetch", event => {
  if (new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
  }
});
