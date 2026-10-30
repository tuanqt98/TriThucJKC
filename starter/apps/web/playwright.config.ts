import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.UI_BASE_URL || "http://localhost:3100",
    trace: "retain-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    // Only automated local-CA fixtures. TLS chain is verified separately by probe.py/curl.
    ignoreHTTPSErrors: process.env.UI_TEST_LOCAL_CA === "true",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
