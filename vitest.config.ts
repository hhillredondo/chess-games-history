import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Pin the timezone here as well as in the npm script: computeTimeOfDayStats
    // buckets on local time by design, so fixtures are only deterministic under a
    // fixed TZ. Setting it here keeps a bare `npx vitest` (or an IDE runner) green.
    env: { TZ: "UTC" },
    reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
  },
});
