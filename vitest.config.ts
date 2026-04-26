import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    isolate: true,
    pool: "forks",
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // V8 coverage instrumentation slows tests measurably; bump default
    // timeout to compensate without making non-coverage runs slower.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/app/**/{layout,loading,error,not-found}.tsx",
      ],
      thresholds: {
        lines: 99,
        branches: 93,
        functions: 91,
        statements: 97,
      },
    },
  },
});
