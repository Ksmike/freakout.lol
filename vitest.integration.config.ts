import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration test config — runs against the real database.
 * Requires DATABASE_URL to be set.
 *
 * Usage: yarn test:integration
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["packages/tests/integration/**/*.{test,spec}.ts"],
    // Run integration tests sequentially to avoid transaction conflicts
    pool: "forks",
    maxWorkers: 1,
    // Longer timeout for DB operations
    testTimeout: 30_000,
  },
});
