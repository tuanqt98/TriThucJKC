// UI-04 DEMO fixture: builds a document through the real Sprint 1 workflow APIs
// (author draft + attachments -> HR approve -> assign -> optional ACK -> fork v2 -> approve -> assign).
// Never touches the database directly. Synthetic content only; not an operating instruction.
// Used by document-detail.spec.ts and scripts/ui-document-detail/fixture.mjs (Node >= 22.18 strips types).
import zlib from "node:zlib";
import type { APIRequest } from "@playwright/test";

const BASE = process.env.UI_BASE_URL || "https://localhost:18444";

function crc32(buf: Buffer) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Small valid RGB PNG (two colour bands) so the API can re-encode it. */
export function demoPng(w = 96, h = 64) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const [r, g, b] = y < h / 2 ? [8, 123, 234] : [255, 204, 0];
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
/** Static one-page PDF (no JS/actions/encryption) with a correct xref table. */
export function demoPdf(
  text = "DEMO JKC - tai lieu minh hoa, khong dung de van hanh",
) {
  const stream = `BT /F1 14 Tf 40 760 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets)
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function session(
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
  type Upload = { file: { name: string; mimeType: string; buffer: Buffer } };
  type Result = { id: string; version_id: string; revision: number };
  const call = async (
    method: string,
    url: string,
    body?: unknown,
    multipart?: Upload,
  ): Promise<Result> => {
    const res = await ctx.fetch(`/api/v1${url}`, {
      method,
      headers: { "X-CSRF-Token": me.csrf_token },
      ...(multipart ? { multipart } : body !== undefined ? { data: body } : {}),
    });
    if (!res.ok())
      throw new Error(
        `${method} ${url} -> ${res.status()} ${await res.text()}`,
      );
    return res.json();
  };
  return { ctx, me, call, close: () => ctx.dispose() };
}

const BODY_V1 = {
  "1. Mục đích":
    "DEMO · Minh họa cách trình bày một nội quy an toàn khu vực xưởng. Nội dung tổng hợp để kiểm thử giao diện, không phải quy định vận hành của JKC.",
  "2. Phạm vi áp dụng":
    "Áp dụng cho tài khoản DEMO thuộc bộ phận Sản xuất (DEMO) trong môi trường kiểm thử.",
  "3. Quy định bắt buộc":
    "- Đọc hướng dẫn được giao trước khi vào khu vực làm việc.\n- Sử dụng trang bị bảo hộ theo hướng dẫn của người phụ trách.\n- Báo cho người phụ trách khi phát hiện bất thường.\n- Giữ lối đi thông thoáng.",
  "4. Lưu ý an toàn":
    "Mọi thông số kỹ thuật phải lấy từ tài liệu chính thức đã được JKC ban hành, không lấy từ nội dung DEMO này.",
};
const BODY_V2 = {
  ...BODY_V1,
  "3. Quy định bắt buộc":
    BODY_V1["3. Quy định bắt buộc"] +
    "\n- (v2 · DEMO) Xác nhận đã đọc lại khi có phiên bản mới được giao.",
};

export type FixtureOptions = {
  request: APIRequest;
  /** DEMO password from env, never committed. */
  password: string;
  /** Creates/forks the document; must have a department. */
  author: string;
  /** HR or department head in scope. */
  approver: string;
  /** Receives reading assignments. */
  reader: string;
  /** Reader acknowledges v1 before v2 is published. */
  ackV1?: boolean;
  /** Publish and assign v2. */
  v2?: boolean;
  title?: string;
};
export type DocumentFixture = {
  contentId: string;
  title: string;
  versions: string[];
  readerId: string;
};
export async function createDocumentFixture(
  o: FixtureOptions,
): Promise<DocumentFixture> {
  const { request, password } = o;
  const author = await session(request, o.author, password);
  const approver = await session(request, o.approver, password);
  const reader = await session(request, o.reader, password);
  try {
    const title =
      o.title || `DEMO · Nội quy an toàn khu vực xưởng (UI-04 ${Date.now()})`;
    let v = await author.call("POST", "/workspace/contents", {
      kind: "DOCUMENT",
      title,
      body: BODY_V1,
      visibility: "DEPARTMENT",
    });
    const contentId = v.id;
    const versions: string[] = [];
    const upload = async (versionId: string) => {
      await author.call(
        "POST",
        `/content-versions/${versionId}/attachments`,
        undefined,
        {
          file: {
            name: "DEMO-noi-quy-minh-hoa.pdf",
            mimeType: "application/pdf",
            buffer: demoPdf(),
          },
        },
      );
      await author.call(
        "POST",
        `/content-versions/${versionId}/attachments`,
        undefined,
        {
          file: {
            name: "DEMO-so-do-khu-vuc.png",
            mimeType: "image/png",
            buffer: demoPng(),
          },
        },
      );
    };
    const publish = async (version: {
      version_id: string;
      revision: number;
    }) => {
      const submitted = await author.call(
        "POST",
        "/workspace/contents/submit",
        {
          content_id: contentId,
          version_id: version.version_id,
          revision: version.revision,
        },
      );
      return approver.call("POST", "/workspace/contents/approve", {
        content_id: contentId,
        version_id: submitted.version_id,
        revision: submitted.revision,
        remark: "",
      });
    };
    const assign = (versionId: string) =>
      approver.call("POST", "/workspace/reading", {
        content_id: contentId,
        version_id: versionId,
        user_id: reader.me.id,
        due_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      });
    await upload(v.version_id);
    v = await publish(v);
    versions.push(v.version_id);
    await assign(v.version_id);
    if (o.ackV1) {
      const task = (
        await (await reader.ctx.get("/api/v1/my/reading")).json()
      ).find((t: { version_id: string }) => t.version_id === v.version_id);
      await reader.call("POST", `/reading-assignments/${task.id}/acknowledge`, {
        version_id: v.version_id,
      });
    }
    if (o.v2) {
      let f = await author.call("POST", "/workspace/contents/fork", {
        content_id: contentId,
        version_id: v.version_id,
        revision: v.revision,
        remark: "",
      });
      f = await author.call("PUT", "/workspace/contents", {
        content_id: contentId,
        version_id: f.version_id,
        revision: f.revision,
        body: BODY_V2,
      });
      await upload(f.version_id);
      f = await publish(f);
      versions.push(f.version_id);
      await assign(f.version_id);
    }
    return { contentId, title, versions, readerId: reader.me.id };
  } finally {
    await Promise.all([author.close(), approver.close(), reader.close()]);
  }
}
