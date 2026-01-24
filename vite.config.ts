import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "node:async_hooks": new URL("./src/shims/async_hooks", import.meta.url)
        .pathname,
      "node:path": new URL("./src/shims/path", import.meta.url).pathname,
      path: new URL("./src/shims/path", import.meta.url).pathname,
      "node:child_process": new URL(
        "./src/shims/child_process",
        import.meta.url
      ).pathname,
      "node:os": new URL("./src/shims/os", import.meta.url).pathname,
      os: new URL("./src/shims/os", import.meta.url).pathname,
      "path-browserify": new URL("./src/shims/path", import.meta.url).pathname,
      "path/posix": new URL("./src/shims/path", import.meta.url).pathname,
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
