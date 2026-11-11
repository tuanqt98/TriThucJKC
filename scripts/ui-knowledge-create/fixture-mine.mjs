// DATA-33 screenshots: six DEMO articles of "employee", one per workflow state, created through the real
// authoring API (head requests changes / rejects / approves). Prints {token}. Generic DEMO text only.
// UI_DEMO_PASSWORD=... node scripts/ui-knowledge-create/fixture-mine.mjs
import { createRequire } from "node:module";
import path from "node:path";
import { session } from "../../starter/apps/web/knowledge-tests/fixture.ts";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "starter/apps/web/package.json"));
const { request } = require("@playwright/test");
const password = process.env.UI_DEMO_PASSWORD;
const token = `M${Date.now().toString(36).toUpperCase()}`;
const author = await session(request, "employee", password);
const head = await session(request, "head", password);
try {
  const processes = await (await author.ctx.get("/api/v1/processes")).json();
  const pid = (code) => processes.find((p) => p.code === code).id;
  const make = (title, code) =>
    author.call("POST", "/workspace/contents", {
      kind: "ARTICLE",
      title: `DEMO · ${title} (${token})`,
      body: { "1. Mô tả vấn đề / kinh nghiệm": "DEMO · Nội dung minh họa, không phải hướng dẫn vận hành." },
      visibility: "DEPARTMENT",
      process_id: pid(code),
    });
  const ver = (r) => ({ content_id: r.id, version_id: r.version_id, revision: r.revision });
  const submit = (r) => author.call("POST", "/workspace/contents/submit", { ...ver(r), remark: "" });
  const decide = (a, r, remark = "") => head.call("POST", `/workspace/contents/${a}`, { ...ver(r), remark });
  const live = await decide("approve", await submit(await make("Quy ước lưu hồ sơ màu cho in kỹ thuật số", "DIGITAL")));
  await author.call("POST", "/workspace/contents/fork", { ...ver(live), remark: "" });
  await decide("approve", await submit(await make("Kinh nghiệm kiểm tra đường bế hộp mẫu", "FINISHING")));
  await decide("reject", await submit(await make("Ghi chú vệ sinh máy cuối ca", "OFFSET")), "DEMO · Trùng nội dung với bài đã có, đề nghị bổ sung vào bài cũ.");
  await decide("request-changes", await submit(await make("Bám mực không đều trên bao bì màng", "FLEXO")), "DEMO · Bổ sung ảnh hiện tượng và ghi rõ nguyên nhân đã xác minh hay giả thuyết.");
  await submit(await make("Danh mục tự kiểm tra file trước khi ra bản", "PREPRESS"));
  await make("Lệch màu giữa các ca in offset", "OFFSET");
  console.log(JSON.stringify({ token }));
} finally {
  await Promise.all([author.close(), head.close()]);
}
