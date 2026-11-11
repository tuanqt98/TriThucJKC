// Pure helpers for "Tạo bài chia sẻ kinh nghiệm" (UI-07). No I/O; unit-tested in scripts/tests.
// Body is stored as {"1. Heading": text, ...}: jsonb loses key order, the numeric prefix keeps it
// (UI-04/05B readers sort by it), so sections never swap places after save + reload.

export type SectionDef = {
  n: number;
  title: string;
  hint: string;
  required?: boolean;
};

/** Mockup 06 structure + the PO list for UI-07 (cause added). Numbers are part of the stored key. */
export const SECTIONS: SectionDef[] = [
  {
    n: 1,
    title: "Mô tả vấn đề / kinh nghiệm",
    hint: "Nêu rõ hiện tượng, mức độ ảnh hưởng.",
    required: true,
  },
  {
    n: 2,
    title: "Điều kiện phát sinh",
    hint: "Máy, vật tư, ca làm việc, môi trường khi xảy ra.",
  },
  {
    n: 3,
    title: "Nguyên nhân",
    hint: "Ghi rõ đâu là giả thuyết, đâu là đã xác minh.",
  },
  { n: 4, title: "Các bước kiểm tra", hint: "Liệt kê những gì đã kiểm tra." },
  {
    n: 5,
    title: "Giải pháp / quy trình thao tác",
    hint: "Trình bày cách làm; thông số lấy từ tài liệu chính thức.",
  },
  { n: 6, title: "Kết quả đạt được", hint: "Kết quả sau khi áp dụng." },
  {
    n: 7,
    title: "Lưu ý an toàn và phạm vi áp dụng",
    hint: "Điểm cần chú ý, trường hợp áp dụng.",
  },
];

export const LIMITS = {
  titleMin: 5,
  titleMax: 200,
  section: 5000,
  /** Server default MAX_UPLOAD_BYTES (10 MiB); the server stays authoritative. */
  fileBytes: 10 * 1024 * 1024,
};

export type FormValues = {
  title: string;
  processId: string;
  sections: Record<number, string>;
  /** Keys this form does not know (e.g. written in "Biên soạn"); kept as-is so saving never drops them. */
  extra: Record<string, string>;
};

export const emptyValues = (): FormValues => ({
  title: "",
  processId: "",
  sections: {},
  extra: {},
});

const ORDER = /^\s*(\d{1,3})\s*[.)\-:]\s*/;
/** Headings used by the previous form and mockup 06, so older drafts open in the right fields. */
const ALIASES: Record<number, string[]> = {
  1: ["mô tả vấn đề"],
  4: ["các bước đã kiểm tra"],
  5: ["giải pháp đề xuất", "cách xử lý / giải pháp"],
  6: ["kết quả"],
  7: ["lưu ý an toàn", "lưu ý an toàn và phạm vi áp dụng"],
};

export function composeBody(v: FormValues): Record<string, string> {
  const body: Record<string, string> = {};
  for (const s of SECTIONS) {
    const text = (v.sections[s.n] || "").trim();
    if (text) body[`${s.n}. ${s.title}`] = text;
  }
  for (const [k, text] of Object.entries(v.extra))
    if (text.trim()) body[k] = text;
  return body;
}

/** Inverse of composeBody; tolerant of older drafts (unnumbered or legacy headings). */
export function readBody(
  body: unknown,
): Pick<FormValues, "sections" | "extra"> {
  const sections: Record<number, string> = {};
  const extra: Record<string, string> = {};
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { sections, extra };
  for (const [key, raw] of Object.entries(body as Record<string, unknown>)) {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const m = key.match(ORDER);
    const title = (m ? key.slice(m[0].length) : key).trim().toLowerCase();
    const def = SECTIONS.find(
      (s) =>
        s.title.toLowerCase() === title || (ALIASES[s.n] || []).includes(title),
    );
    if (def && !sections[def.n]) sections[def.n] = text;
    else extra[key] = text;
  }
  return { sections, extra };
}

export type Errors = Partial<Record<string, string>>;

/** "save" only needs a usable title; "submit" also needs the process (server rule) and the description. */
export function validate(v: FormValues, mode: "save" | "submit"): Errors {
  const e: Errors = {};
  const title = v.title.trim();
  if (!title) e.title = "Nhập tiêu đề bài chia sẻ.";
  else if (title.length < LIMITS.titleMin)
    e.title = `Tiêu đề cần ít nhất ${LIMITS.titleMin} ký tự.`;
  else if (title.length > LIMITS.titleMax)
    e.title = `Tiêu đề tối đa ${LIMITS.titleMax} ký tự.`;
  for (const s of SECTIONS)
    if ((v.sections[s.n] || "").length > LIMITS.section)
      e[`s${s.n}`] = `Tối đa ${LIMITS.section.toLocaleString("vi-VN")} ký tự.`;
  if (mode === "submit") {
    if (!v.processId) e.processId = "Chọn công đoạn trước khi gửi duyệt.";
    for (const s of SECTIONS)
      if (s.required && !(v.sections[s.n] || "").trim())
        e[`s${s.n}`] = `Nhập "${s.title}" trước khi gửi duyệt.`;
  }
  return e;
}

export const snapshot = (v: FormValues) =>
  JSON.stringify([v.title.trim(), v.processId, composeBody(v)]);

const ACCEPT = /\.(png|jpe?g|pdf)$/i;
const MIMES = new Set(["image/png", "image/jpeg", "application/pdf"]);

/** Client pre-check only (fast feedback); the API re-checks type, size and scans every file. */
export function checkFile(file: { name: string; size: number; type: string }) {
  if (!ACCEPT.test(file.name) || (file.type && !MIMES.has(file.type)))
    return "Chỉ hỗ trợ ảnh PNG, JPEG và tệp PDF.";
  if (file.size > LIMITS.fileBytes)
    return `Tệp vượt ${LIMITS.fileBytes / 1024 / 1024} MB.`;
  if (file.size === 0) return "Tệp rỗng.";
  return "";
}

export function actionError(status: number, message: string) {
  if (status === 0)
    return "Mất kết nối tới máy chủ. Thao tác chưa được ghi nhận, vui lòng thử lại.";
  if (status === 401)
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 409)
    return "Bài đã thay đổi ở nơi khác hoặc đã chuyển trạng thái. Tải lại trang trước khi tiếp tục.";
  if (status === 413) return "Tệp vượt giới hạn dung lượng của hệ thống.";
  return message || "Không thực hiện được. Vui lòng thử lại.";
}

export const statusText: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Đang chờ duyệt",
  APPROVED: "Đã duyệt",
  CHANGES_REQUESTED: "Cần chỉnh sửa",
  REJECTED: "Bị từ chối",
};
