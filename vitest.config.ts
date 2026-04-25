import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Tests run in Node — File / Blob / fetch are all globals as of Node 18+.
// The Vite plugins from vite.config.ts (tanstackStart, react, tailwind, cloudflare)
// aren't needed here; we only test pure modules in lib/ for now.
export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
