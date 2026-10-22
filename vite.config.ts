import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

const APP_VERSION: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(),
    {
      // Lets running tabs detect a newer deployment (see useUpdatePrompt).
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
