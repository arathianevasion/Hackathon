import { defineConfig } from "vitest/config";

// 30s so a heavily loaded machine doesn't fail a correct merge (default is 5s).
export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
