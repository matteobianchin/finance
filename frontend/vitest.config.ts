import { defineConfig } from "vitest/config";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import react from "@vitejs/plugin-react";

export default defineConfig({
  // cast needed due to vite version mismatch between vitest and @vitejs/plugin-react
  plugins: [react() as any],
  test: {
    environment: "jsdom",
    setupFiles: ["__tests__/setup.ts"],
    globals: true,
  },
});
