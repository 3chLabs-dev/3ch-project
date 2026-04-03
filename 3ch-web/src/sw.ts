/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

// vite-plugin-pwa가 빌드 시 주입하는 precache manifest
precacheAndRoute(self.__WB_MANIFEST);

// ── Push 이벤트 핸들러 ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "알림", body: event.data.text() };
  }

  const title = data.title ?? "우리리그";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    data: { url: data.url ?? "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification 클릭 핸들러 ─────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url: string = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
