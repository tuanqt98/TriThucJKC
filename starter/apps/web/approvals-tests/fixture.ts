// UI-09 DEMO fixture: content submitted for review through the real workflow API (author drafts + submits).
// Articles go to the department head; documents to HR. Never writes the database directly. Generic DEMO text.
import type { APIRequest } from "@playwright/test";
import { session } from "../knowledge-tests/fixture.ts";
import { demoPdf } from "../document-detail-tests/fixture.ts";

type V = { id: string; version_id: string; revision: number };
export async function submitForReview(
  request: APIRequest,
  password: string,
  author: string,
  specs: { title: string; kind?: "ARTICLE" | "DOCUMENT"; file?: boolean }[],
) {
  const s = await session(request, author, password);
  const out: Record<string, V> = {};
  try {
    const processes: { id: string; code: string }[] = await (
      await s.ctx.get("/api/v1/processes")
    ).json();
    for (const spec of specs) {
      const kind = spec.kind || "ARTICLE";
      let v = (await s.call("POST", "/workspace/contents", {
        kind,
        title: spec.title,
        body: {
          "1. Mô tả vấn đề / kinh nghiệm": `DEMO · Nội dung cần duyệt (${spec.title}).`,
          "2. Giải pháp / quy trình thao tác":
            "- Báo trưởng ca\n- Làm theo tài liệu chính thức",
        },
        visibility: "DEPARTMENT",
        process_id:
          kind === "ARTICLE"
            ? processes.find((p) => p.code === "FLEXO")!.id
            : null,
      })) as V;
      if (spec.file) {
        const res = await s.ctx.post(
          `/api/v1/content-versions/${v.version_id}/attachments`,
          {
            headers: { "X-CSRF-Token": s.me.csrf_token },
            multipart: {
              file: {
                name: "DEMO-phieu-duyet.pdf",
                mimeType: "application/pdf",
                buffer: demoPdf(),
              },
            },
          },
        );
        if (!res.ok()) throw new Error(`upload ${res.status()}`);
      }
      v = (await s.call("POST", "/workspace/contents/submit", {
        content_id: v.id,
        version_id: v.version_id,
        revision: v.revision,
        remark: "",
      })) as V;
      out[spec.title] = v;
    }
  } finally {
    await s.close();
  }
  return out;
}
