import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + SSE to the Node backend on :8080.
// In production the backend serves web/dist directly (same origin), so the
// relative /api paths used by the client work without any proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
