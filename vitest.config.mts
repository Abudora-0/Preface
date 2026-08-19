import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // The suite covers pure logic in src/lib, so no DOM environment is needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
