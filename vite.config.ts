import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react()],
  /* Stamped on every analytics event, so a figure can be traced to the build that produced it. */
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
