import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

process.env.VITE_APP_VERSION = Date.now().toString(36).toUpperCase();

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      devOptions: {
        enabled: false,
      },
      manifest: false,
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/~oauth/],
        // Exclude heavy chunks from precache to speed up install
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Cache Supabase storage (comprovantes/boletos) with cache-first
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: "CacheFirst",
            options: {
              cacheName: "storage-assets",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split pdfjs into its own chunk (lazy loaded)
          "pdf-viewer": ["pdfjs-dist"],
        },
      },
    },
  },
});
