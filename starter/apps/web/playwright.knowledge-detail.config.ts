import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./knowledge-detail-tests",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.UI_BASE_URL || "https://localhost:18444",
    ignoreHTTPSErrors: process.env.UI_TEST_LOCAL_CA === "true",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "off",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    {
      name: "mobile390",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile375",
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  reporter: [
    ["list"],
    ["json", { outputFile: "../../../docs/reports/ui-05b/test-results.json" }],
  ],
});
