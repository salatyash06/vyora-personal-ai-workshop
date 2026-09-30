import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:8080", browserName: "chromium", headless: true },
  webServer: { command: "npm run dev", url: "http://localhost:8080", reuseExistingServer: true },
});
