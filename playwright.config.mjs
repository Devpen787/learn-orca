import { defineConfig } from "@playwright/test";
const remoteURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: remoteURL || "http://127.0.0.1:8974",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true },
    },
  ],
  webServer: remoteURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://127.0.0.1:8974",
        reuseExistingServer: false,
      },
});
