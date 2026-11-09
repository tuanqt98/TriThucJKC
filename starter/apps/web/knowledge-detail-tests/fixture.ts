// UI-05B DEMO fixture: one knowledge article with attachments through the real workflow APIs
// (author draft + uploads -> submit -> head approves). Never writes the database directly.
// Synthetic text only; no operating parameters.
import type { APIRequest } from "@playwright/test";
import { session } from "../knowledge-tests/fixture";
import { demoPdf, demoPng } from "../document-detail-tests/fixture";

export type ArticleWithFiles = {
  id: string;
  version_id: string;
  title: string;
};

/** Keys are deliberately written out of order: the page must sort by the numeric prefix. */
export const BODY = (token: string) => ({
  "6. Lưu ý an toàn": `- Dừng máy trước khi vệ sinh\n- DEMO ${token}: thông số lấy từ tài liệu chính thức`,
  "2. Điều kiện phát sinh": `Ghi nhận DEMO ${token}.\nẢnh: DEMO-buoc-2.png\n- Sau khi đổi lô vật tư\n- Vùng màu đậm`,
  "1. Mô tả vấn đề": `Mô tả DEMO ${token}.`,
  "10. Phụ lục": "Phụ lục DEMO.",
  "3. Các bước đã kiểm tra": "1. So sánh với mẫu\n2. Kiểm tra nhãn lô",
});

export async function createArticleWithFiles(o: {
  request: APIRequest;
  password: string;
  token: string;
  state?: "draft" | "pending" | "approved";
  author?: string;
  approver?: string;
}): Promise<ArticleWithFiles> {
  const author = await session(o.request, o.author || "employee", o.password);
  const approver = await session(o.request, o.approver || "head", o.password);
  try {
    const processes: { id: string; code: string }[] = await (
      await author.ctx.get("/api/v1/processes")
    ).json();
    const title = `DEMO · Chi tiết tri thức ${o.token} ${o.state || "approved"}`;
    let v = await author.call("POST", "/workspace/contents", {
      kind: "ARTICLE",
      title,
      body: BODY(o.token),
      visibility: "DEPARTMENT",
      process_id: processes.find((p) => p.code === "FLEXO")!.id,
    });
    for (const [name, mimeType, buffer] of [
      ["DEMO-anh-dai-dien.png", "image/png", demoPng(160, 90)],
      ["DEMO-buoc-2.png", "image/png", demoPng(120, 90)],
      ["DEMO-phieu.pdf", "application/pdf", demoPdf()],
    ] as const) {
      const res = await author.ctx.post(
        `/api/v1/content-versions/${v.version_id}/attachments`,
        {
          headers: { "X-CSRF-Token": author.me.csrf_token },
          multipart: { file: { name, mimeType, buffer } },
        },
      );
      if (!res.ok()) throw new Error(`Upload ${name}: ${res.status()}`);
    }
    const state = o.state || "approved";
    if (state !== "draft") {
      v = await author.call("POST", "/workspace/contents/submit", {
        content_id: v.id,
        version_id: v.version_id,
        revision: v.revision,
      });
      if (state === "approved")
        await approver.call("POST", "/workspace/contents/approve", {
          content_id: v.id,
          version_id: v.version_id,
          revision: v.revision,
          remark: "",
        });
    }
    return { id: v.id, version_id: v.version_id, title };
  } finally {
    await Promise.all([author.close(), approver.close()]);
  }
}
