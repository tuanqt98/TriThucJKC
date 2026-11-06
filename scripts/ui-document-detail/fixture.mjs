// CLI for screenshots: prints {contentId, title, versions, readerId}.
// UI_DEMO_PASSWORD=... [UI_UAT_FIXTURES=.local/uat01.json] [UI_FIXTURE_READER=employee] node scripts/ui-document-detail/fixture.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createDocumentFixture } from "../../starter/apps/web/document-detail-tests/fixture.ts";

const require = createRequire(new URL("../../starter/apps/web/package.json", import.meta.url));
const { request } = require("@playwright/test");
const uat = JSON.parse(readFileSync(process.env.UI_UAT_FIXTURES || ".local/uat01.json", "utf8"));
createDocumentFixture({
  request,
  password: process.env.UI_DEMO_PASSWORD,
  author: process.env.UI_FIXTURE_AUTHOR || uat.desktop.username,
  approver: uat.hr.username,
  reader: process.env.UI_FIXTURE_READER || "employee",
  ackV1: process.env.UI_FIXTURE_ACK_V1 !== "false",
  v2: process.env.UI_FIXTURE_V2 !== "false",
})
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
