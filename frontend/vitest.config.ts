import { defineConfig } from "vitest/config";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // cast needed due to vite version mismatch between vitest and @vitejs/plugin-react
  plugins: [react() as any],
  resolve: {
    alias: { "@": __dirname },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["__tests__/setup.ts"],
    globals: true,
  },
});
