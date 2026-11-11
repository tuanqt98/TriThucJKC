// UI-05B design proposal only: publishes ONE DEMO knowledge article through the real workflow
// (employee drafts + uploads -> submits -> head approves). Never writes the database directly.
// Body headings follow approved mockup 06; text is generic DEMO with no operating parameters.
// Section 5 references an attached image by filename (UI-05B per-step image rule, interim until DATA-04).
// Images are the UI-02 DEMO illustrations re-encoded to JPEG (the API only accepts PNG/JPEG/PDF).
// UI_DEMO_PASSWORD=... node scripts/ui-knowledge-detail/fixture.mjs  -> prints {id, version_id}
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { session } from "../../starter/apps/web/knowledge-tests/fixture.ts";
import { demoPdf } from "../../starter/apps/web/document-detail-tests/fixture.ts";

const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "starter/apps/web/package.json"));
const { request } = require("@playwright/test");
const password = process.env.UI_DEMO_PASSWORD;
if (!password) throw new Error("Cần UI_DEMO_PASSWORD");

function jpeg(name) {
  const src = path.join(root, "starter/apps/web/public/images/dashboard-demo", `${name}.webp`);
  const code = "import sys,io;from PIL import Image;b=io.BytesIO();Image.open(sys.argv[1]).convert('RGB').save(b,'JPEG',quality=85);sys.stdout.buffer.write(b.getvalue())";
  return execFileSync(path.join(root, ".venv/bin/python"), ["-c", code, src], { maxBuffer: 16 << 20 });
}

const note = "DEMO · Nội dung minh họa để duyệt thiết kế. Thông số vận hành phải lấy từ tài liệu chính thức của JKC.";
const body = {
  "1. Mô tả vấn đề": "Trên một lô bao bì màng DEMO, mực bám không đều ở vùng nền đặc và có vết lem khi chồng sản phẩm.",
  "2. Điều kiện phát sinh": "- Xuất hiện sau khi đổi lô vật tư\n- Tập trung ở vùng màu đậm\n- Ca đêm ghi nhận nhiều hơn ca ngày",
  "3. Các bước đã kiểm tra": "1. So sánh tờ in với mẫu đã duyệt\n2. Kiểm tra nhãn lô vật tư và hạn sử dụng\n3. Kiểm tra vệ sinh trục và khay mực\n4. Ghi ảnh hiện tượng vào hồ sơ ca",
  "4. Cách xử lý / giải pháp": "Báo trưởng ca, tách lô nghi ngờ và áp dụng hướng dẫn xử lý trong tài liệu kỹ thuật chính thức của bộ phận.",
  "5. Kết quả đạt được": "Lô in lại đạt so với mẫu đã duyệt; không phát sinh khiếu nại trong đợt giao hàng DEMO.\nẢnh: DEMO-anh-sau-xu-ly.jpg",
  "6. Lưu ý an toàn và phạm vi áp dụng": `- Dừng máy trước khi vệ sinh trục\n- Chỉ áp dụng cho bao bì màng trong phạm vi DEMO\n- ${note}`,
};

const author = await session(request, "employee", password);
const head = await session(request, "head", password);
try {
  const processes = await (await author.ctx.get("/api/v1/processes")).json();
  const flexo = processes.find((p) => p.code === "FLEXO");
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  let v = await author.call("POST", "/workspace/contents", {
    kind: "ARTICLE",
    title: `DEMO · Bài học từ lỗi bám mực trên bao bì màng (${stamp})`,
    body,
    visibility: "DEPARTMENT",
    process_id: flexo.id,
  });
  const files = [
    ["DEMO-anh-hien-tuong.jpg", "image/jpeg", jpeg("flexo")],
    ["DEMO-anh-sau-xu-ly.jpg", "image/jpeg", jpeg("quality")],
    ["DEMO-phieu-ghi-nhan.pdf", "application/pdf", demoPdf("DEMO JKC - phieu ghi nhan minh hoa, khong dung de van hanh")],
  ];
  for (const [name, mimeType, buffer] of files) {
    const res = await author.ctx.post(`/api/v1/content-versions/${v.version_id}/attachments`, {
      headers: { "X-CSRF-Token": author.me.csrf_token },
      multipart: { file: { name, mimeType, buffer } },
    });
    if (!res.ok()) throw new Error(`Upload ${name} -> ${res.status()} ${await res.text()}`);
  }
  v = await author.call("POST", "/workspace/contents/submit", { content_id: v.id, version_id: v.version_id, revision: v.revision });
  await head.call("POST", "/workspace/contents/approve", { content_id: v.id, version_id: v.version_id, revision: v.revision, remark: "" });
  console.log(JSON.stringify({ id: v.id, version_id: v.version_id }));
} finally {
  await Promise.all([author.close(), head.close()]);
}
