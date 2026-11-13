// UI-07 DEMO draft for screenshots: one ARTICLE draft (not submitted) with a photo and a PDF, created
// through the real authoring + upload APIs as "employee". Prints {id}. Generic DEMO text only.
// UI_DEMO_PASSWORD=... node scripts/ui-knowledge-create/fixture.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { session } from "../../starter/apps/web/knowledge-tests/fixture.ts";
import { demoPdf } from "../../starter/apps/web/document-detail-tests/fixture.ts";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "starter/apps/web/package.json"));
const { request } = require("@playwright/test");
const jpeg = (name) =>
  execFileSync(path.join(root, ".venv/bin/python"), ["-c", "import sys,io;from PIL import Image;b=io.BytesIO();Image.open(sys.argv[1]).convert('RGB').save(b,'JPEG',quality=85);sys.stdout.buffer.write(b.getvalue())", path.join(root, "starter/apps/web/public/images/dashboard-demo", `${name}.webp`)], { maxBuffer: 16 << 20 });
const author = await session(request, "employee", process.env.UI_DEMO_PASSWORD);
try {
  const processes = await (await author.ctx.get("/api/v1/processes")).json();
  const v = await author.call("POST", "/workspace/contents", {
    kind: "ARTICLE",
    title: "DEMO · Bám mực không đều trên bao bì màng khi chạy nhanh",
    body: {
      "1. Mô tả vấn đề / kinh nghiệm": "Trên lô bao bì màng DEMO, mực bám không đều ở vùng nền đặc khi tăng tốc máy.\nẢnh: DEMO-hien-tuong.jpg",
      "2. Điều kiện phát sinh": "- Sau khi đổi lô vật tư\n- Chủ yếu ở màu đậm",
      "4. Các bước kiểm tra": "1. So sánh với mẫu đã duyệt\n2. Kiểm tra nhãn lô vật tư",
      "5. Giải pháp / quy trình thao tác": "Báo trưởng ca và áp dụng hướng dẫn kỹ thuật chính thức của bộ phận.",
    },
    visibility: "DEPARTMENT",
    process_id: processes.find((p) => p.code === "FLEXO").id,
  });
  for (const [name, mimeType, buffer] of [
    ["DEMO-hien-tuong.jpg", "image/jpeg", jpeg("flexo")],
    ["DEMO-phieu-ghi-nhan.pdf", "application/pdf", demoPdf()],
  ]) {
    const res = await author.ctx.post(`/api/v1/content-versions/${v.version_id}/attachments`, {
      headers: { "X-CSRF-Token": author.me.csrf_token },
      multipart: { file: { name, mimeType, buffer } },
    });
    if (!res.ok()) throw new Error(`Upload ${name} -> ${res.status()}`);
  }
  console.log(JSON.stringify({ id: v.id }));
} finally {
  await author.close();
}
