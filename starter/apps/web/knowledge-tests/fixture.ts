// UI-05 DEMO fixture: knowledge articles through the real Sprint 1 workflow APIs
// (author draft -> submit -> department head approves). Never writes the database directly.
// Synthetic content only; titles/bodies say DEMO and contain no operating parameters.
// Used by knowledge.spec.ts and scripts/ui-knowledge/fixture.mjs (Node >= 22.18 strips types).
import type { APIRequest } from "@playwright/test";

const BASE = process.env.UI_BASE_URL || "https://localhost:18444";
type Result = { id: string; version_id: string; revision: number };

export async function session(
  request: APIRequest,
  username: string,
  password: string,
) {
  const ctx = await request.newContext({
    baseURL: BASE,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Origin: BASE },
  });
  const login = await ctx.post("/api/v1/auth/login", {
    data: { username, password },
  });
  if (!login.ok())
    throw new Error(`Đăng nhập ${username} thất bại: ${login.status()}`);
  const me = await (await ctx.get("/api/v1/auth/me")).json();
  const call = async (
    method: string,
    url: string,
    body?: unknown,
  ): Promise<Result> => {
    const res = await ctx.fetch(`/api/v1${url}`, {
      method,
      headers: { "X-CSRF-Token": me.csrf_token },
      ...(body !== undefined ? { data: body } : {}),
    });
    if (!res.ok())
      throw new Error(
        `${method} ${url} -> ${res.status()} ${await res.text()}`,
      );
    return res.json();
  };
  return { ctx, me, call, close: () => ctx.dispose() };
}

export type ArticleSpec = {
  title: string;
  body: Record<string, string>;
  processCode: "PREPRESS" | "OFFSET" | "DIGITAL" | "FLEXO" | "FINISHING";
  /** "draft" keeps it unsubmitted, "pending" submits without approval, "approved" publishes. */
  state?: "draft" | "pending" | "approved";
};

/** Creates articles as `author`; `approver` (department head in scope) approves the published ones. */
export async function createArticles(o: {
  request: APIRequest;
  password: string;
  author: string;
  approver: string;
  articles: ArticleSpec[];
}) {
  const author = await session(o.request, o.author, o.password);
  const approver = await session(o.request, o.approver, o.password);
  try {
    const processes: { id: string; code: string }[] = await (
      await author.ctx.get("/api/v1/processes")
    ).json();
    const created: { id: string; title: string; state: string }[] = [];
    for (const a of o.articles) {
      const process = processes.find((p) => p.code === a.processCode);
      if (!process) throw new Error(`Thiếu công đoạn ${a.processCode}`);
      let v = await author.call("POST", "/workspace/contents", {
        kind: "ARTICLE",
        title: a.title,
        body: a.body,
        visibility: "DEPARTMENT",
        process_id: process.id,
      });
      const state = a.state || "approved";
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
      created.push({ id: v.id, title: a.title, state });
    }
    return created;
  } finally {
    await Promise.all([author.close(), approver.close()]);
  }
}

/** Demo library for screenshots: one approved article per process, generic DEMO text. */
export function demoLibrary(stamp: string): ArticleSpec[] {
  const note =
    "DEMO · Nội dung minh họa để thử giao diện. Thông số vận hành phải lấy từ tài liệu chính thức của JKC.";
  return [
    {
      processCode: "OFFSET",
      title: `DEMO · Ghi nhận lệch màu giữa các ca in offset (${stamp})`,
      body: {
        "Hiện tượng":
          "Màu tờ in giữa hai ca không đồng nhất khi so với tờ mẫu đã duyệt.",
        "Cách ghi nhận":
          "- Chụp ảnh tờ mẫu và tờ lỗi\n- Ghi số lệnh sản xuất\n- Báo trưởng ca",
        "Lưu ý": note,
      },
    },
    {
      processCode: "PREPRESS",
      title: `DEMO · Danh mục tự kiểm tra file trước khi ra bản (${stamp})`,
      body: {
        "Mục đích":
          "Giảm lỗi phát hiện muộn bằng cách tự kiểm tra theo danh mục trước khi chuyển file.",
        "Danh mục":
          "- Font đã nhúng\n- Ảnh đủ độ phân giải theo yêu cầu đơn hàng\n- Kích thước và tràn lề",
        "Lưu ý": note,
      },
    },
    {
      processCode: "FLEXO",
      title: `DEMO · Bài học từ lỗi bám mực trên màng bao bì (${stamp})`,
      body: {
        "Bối cảnh":
          "Một lô bao bì bị bong mực sau khi gia công, phát hiện ở khâu kiểm tra cuối.",
        "Bài học":
          "Ghi nhận đầy đủ vật liệu, điều kiện và người phụ trách để tra cứu lần sau.",
        "Lưu ý": note,
      },
    },
    {
      processCode: "DIGITAL",
      title: `DEMO · Quy ước lưu hồ sơ màu cho in kỹ thuật số (${stamp})`,
      body: {
        "Mục đích":
          "Thống nhất nơi lưu và cách đặt tên hồ sơ màu để tra cứu nhanh.",
        "Quy ước": "- Đặt tên theo khách hàng và vật liệu\n- Ghi ngày cập nhật",
        "Lưu ý": note,
      },
    },
    {
      processCode: "FINISHING",
      title: `DEMO · Kinh nghiệm kiểm tra đường bế hộp mẫu (${stamp})`,
      body: {
        "Kinh nghiệm":
          "So sánh hộp mẫu với bản vẽ trước khi chạy hàng loạt và lưu ảnh đối chiếu.",
        "Lưu ý": note,
      },
    },
  ];
}
