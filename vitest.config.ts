import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    server: { deps: { inline: [/@testing-library/, "react", "react-dom"] } },
  },
});
