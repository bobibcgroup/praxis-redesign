import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import pkg from "./package.json";

/**
 * The on-device colour reader's engine (MediaPipe, Apache 2.0) is served from /mediapipe/: copied from
 * node_modules into the build, and served from there by the dev server. Only the SIMD and no-SIMD
 * builds are needed. Fetched only when a customer asks for their colours from their own photo.
 */
const MEDIAPIPE = ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"];
const mediapipeFile = (name: string) => path.resolve(__dirname, "node_modules/@mediapipe/tasks-vision/wasm", name);
function mediapipe(): Plugin {
  return {
    name: "praxis-mediapipe",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.startsWith("/mediapipe/") ? req.url.slice(11).split("?")[0] : null;
        if (!name || !MEDIAPIPE.includes(name)) return next();
        res.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        res.end(readFileSync(mediapipeFile(name)));
      });
    },
    generateBundle() {
      for (const name of MEDIAPIPE) this.emitFile({ type: "asset", fileName: `mediapipe/${name}`, source: readFileSync(mediapipeFile(name)) });
    },
  };
}

export default defineConfig({
  plugins: [react(), mediapipe()],
  /* Stamped on every analytics event, so a figure can be traced to the build that produced it. */
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
