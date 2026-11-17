import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 10_000,
  use: {
    baseURL: "http://127.0.0.1:8770",
    trace: "on-first-retry"
  },
  webServer: {
    command: "python -m http.server 8770",
    url: "http://127.0.0.1:8770/index.html",
    reuseExistingServer: true
  }
});
