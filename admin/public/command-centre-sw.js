/* Network-only: private documents, sessions and APIs never enter Cache Storage. */
const VERSION = "command-centre-v3";
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
self.addEventListener("push", event => {
  // Private prospect/message details never appear on the lock screen.
  event.waitUntil(self.registration.showNotification("ScaleSmiths approval needed", {
    body: "Open Megaton to review pending work.",
    icon: "/app-icon/192",
    tag: "megaton-review",
    data: { url: "/megaton?tab=inbox" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL("/megaton?tab=inbox", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
