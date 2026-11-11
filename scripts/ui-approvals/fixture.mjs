// UI-09 screenshots: DEMO content submitted for review through the real workflow (employee drafts + submits).
// Prints {token}. UI_DEMO_PASSWORD=... node scripts/ui-approvals/fixture.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { submitForReview } from "../../starter/apps/web/approvals-tests/fixture.ts";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "starter/apps/web/package.json"));
const { request } = require("@playwright/test");
const token = `P${Date.now().toString(36).toUpperCase()}`;
await submitForReview(request, process.env.UI_DEMO_PASSWORD, "employee", [
  { title: `DEMO · Mẹo kiểm giấy khi in offset khổ lớn (${token})` },
  { title: `DEMO · Quy trình kiểm tra file trước in (${token})`, kind: "DOCUMENT" },
  { title: `DEMO · Kinh nghiệm xử lý bong mực trên flexo (${token})`, file: true },
]);
console.log(JSON.stringify({ token }));
