// CLI for screenshots: creates one approved DEMO article per process via the real workflow.
// UI_DEMO_PASSWORD=... [UI_FIXTURE_AUTHOR=employee] [UI_FIXTURE_APPROVER=head] node scripts/ui-knowledge/fixture.mjs
import { createRequire } from "node:module";
import { createArticles, demoLibrary } from "../../starter/apps/web/knowledge-tests/fixture.ts";

const require = createRequire(new URL("../../starter/apps/web/package.json", import.meta.url));
const { request } = require("@playwright/test");
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
createArticles({
  request,
  password: process.env.UI_DEMO_PASSWORD,
  author: process.env.UI_FIXTURE_AUTHOR || "employee",
  approver: process.env.UI_FIXTURE_APPROVER || "head",
  articles: demoLibrary(stamp),
})
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
