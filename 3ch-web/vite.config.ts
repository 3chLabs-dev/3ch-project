import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "우리리그",
        short_name: "우리리그",
        description: "생활체육 리그/경기 관리",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // pwa 제외 요청
      workbox: {
        // SPA fallback에서 제외 (서버에서 직접 처리하는 경로)
        navigateFallbackDenylist: [/^\/api\//, /^\/swagger/],

        // /api, /swagger 요청은 무조건 서버로 (캐시 안 함)
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/") || url.pathname.startsWith("/swagger"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
