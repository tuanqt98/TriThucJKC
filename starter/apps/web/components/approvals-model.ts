// Pure helpers for "Phê duyệt nội dung" (UI-09). No I/O; unit-tested in scripts/tests.
// Queue + decisions use the versioned workflow API (GET /workspace/contents, POST /workspace/contents/{action}):
// the server decides who may review (department head for articles, HR for documents) and forbids self-approval.
import type { User } from "./api";

export type QueueSource = {
  id: string;
  version_id: string;
  version_number: number;
  revision: number;
  status: string;
  title: string;
  kind: string;
  creator_id: string;
  owner_department_id: string;
  body: Record<string, unknown>;
  process_id: string | null;
  created_at: string;
  can_edit: boolean;
  can_review: boolean;
  remark: string | null;
};
export type Person = {
  id: string;
  full_name: string;
  department_id: string;
  department_name: string;
};
export type HistoryRow = {
  id: string;
  title: string;
  author: string;
  version_number: number;
  status: string;
  requested_at: string;
};
export type Kind = "ARTICLE" | "DOCUMENT";
export type Decision = "approve" | "request-changes" | "reject";

export const kindLabel: Record<string, string> = {
  ARTICLE: "Tri thức",
  DOCUMENT: "Tài liệu",
};
export const decisionLabel: Record<Decision, string> = {
  approve: "Phê duyệt",
  "request-changes": "Yêu cầu chỉnh sửa",
  reject: "Từ chối",
};
export const REMARK_MAX = 4000; // server limit (ReviewContent.remark)
export const PAGE_SIZE = 10;

/** Reviewer roles as the server defines them (jkc_review): scoped department head or HR. */
export function reviewerRoles(user: Pick<User, "roles"> | null) {
  const roles = user?.roles || [];
  return {
    head: roles.some(
      (r) => r.code === "DEPARTMENT_HEAD" && r.scope_department_id,
    ),
    hr: roles.some((r) => r.code === "HR"),
  };
}

export type QueueItem = QueueSource & {
  author: string | null;
  department: string | null;
};

/** Only what the server marks reviewable for this user and still pending; never the user's own items. */
export function buildQueue(
  items: QueueSource[],
  people: Person[],
  userId: string,
): QueueItem[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const dept = new Map(people.map((p) => [p.department_id, p.department_name]));
  return (
    items
      .filter(
        (i) =>
          i.can_review && i.status === "PENDING" && i.creator_id !== userId,
      )
      .map((i) => ({
        ...i,
        author: byId.get(i.creator_id)?.full_name ?? null,
        department: dept.get(i.owner_department_id) ?? null,
      }))
      // Newest first, like mockup 08.
      .sort(
        (a, b) =>
          Date.parse(b.created_at) - Date.parse(a.created_at) ||
          a.id.localeCompare(b.id),
      )
  );
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function filterQueue(
  items: QueueItem[],
  f: { kind: "" | Kind; department: string; q: string; page: number },
) {
  const words = fold(f.q).split(/\s+/).filter(Boolean);
  const filtered = items.filter(
    (i) =>
      (!f.kind || i.kind === f.kind) &&
      (!f.department || i.owner_department_id === f.department) &&
      words.every((w) => fold(`${i.title} ${i.author || ""}`).includes(w)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, f.page), pages);
  return {
    total: filtered.length,
    pages,
    page,
    items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}

export function departments(items: QueueItem[]) {
  const m = new Map<string, string>();
  for (const i of items)
    m.set(i.owner_department_id, i.department || "Bộ phận khác");
  return [...m.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/** Same rule as the server: approve may be silent; request changes / reject need a reason. */
export function remarkError(decision: Decision, remark: string) {
  if (remark.length > REMARK_MAX)
    return `Nhận xét tối đa ${REMARK_MAX.toLocaleString("vi-VN")} ký tự.`;
  if (decision !== "approve" && !remark.trim())
    return `Nhập lý do trước khi chọn "${decisionLabel[decision]}".`;
  return "";
}

export function resultMessage(
  decision: Decision,
  title: string,
  version: number,
) {
  return decision === "approve"
    ? `Đã phê duyệt “${title}” v${version}. Bài được công bố trong phạm vi.`
    : decision === "request-changes"
      ? `Đã gửi yêu cầu chỉnh sửa “${title}” v${version} cho tác giả.`
      : `Đã từ chối “${title}” v${version}.`;
}

export function approvedHistory(rows: HistoryRow[], max = 50) {
  return rows
    .filter((r) => r.status === "APPROVED")
    .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))
    .slice(0, max);
}
