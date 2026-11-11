// Pure helpers for the knowledge library (UI-05). No I/O; unit-tested in scripts/tests.
import type { Content, ContentPage } from "./api";

export type KnowledgeKind = "ARTICLE" | "INCIDENT_GUIDE";
export type Sort = "newest" | "oldest" | "title";
export type View = "list" | "grid";
export type KnowledgeState = {
  q: string;
  process: string;
  type: "" | KnowledgeKind;
  department: string;
  sort: Sort;
  page: number;
  view: View;
};
export const defaultState: KnowledgeState = {
  q: "",
  process: "",
  type: "",
  department: "",
  sort: "newest",
  page: 1,
  view: "list",
};
export const PAGE_SIZE = 8;
export const kindLabels: Record<KnowledgeKind, string> = {
  ARTICLE: "Bài tri thức",
  INCIDENT_GUIDE: "Giải pháp sự cố",
};
export const sortLabels: Record<Sort, string> = {
  newest: "Mới duyệt nhất",
  oldest: "Cũ nhất",
  title: "Tên A–Z",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Read state from URL search params; anything invalid falls back to the default. */
export function readState(params: URLSearchParams): KnowledgeState {
  const type = params.get("type");
  const sort = params.get("sort");
  const view = params.get("view");
  const page = Number(params.get("page"));
  const process = params.get("processId") || "";
  const department = params.get("department") || "";
  return {
    q: (params.get("q") || "").slice(0, 200),
    process: UUID.test(process) ? process : "",
    type: type === "ARTICLE" || type === "INCIDENT_GUIDE" ? type : "",
    department:
      department === "unknown" || UUID.test(department) ? department : "",
    sort: sort === "oldest" || sort === "title" ? sort : "newest",
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
    view: view === "grid" ? "grid" : "list",
  };
}

/** Serialize only non-default values so shared links stay short. */
export function writeState(state: KnowledgeState): string {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.process) p.set("processId", state.process);
  if (state.type) p.set("type", state.type);
  if (state.department) p.set("department", state.department);
  if (state.sort !== "newest") p.set("sort", state.sort);
  if (state.page > 1) p.set("page", String(state.page));
  if (state.view !== "list") p.set("view", state.view);
  return p.toString();
}

/** Server filters (q, process) decide what is fetched; the rest is applied client-side on the full snapshot. */
export function applyFilters(items: Content[], state: KnowledgeState) {
  const filtered = items.filter(
    (i) =>
      (!state.type || i.kind === state.type) &&
      (!state.department ||
        (i.owner_department_id || "unknown") === state.department),
  );
  const time = (i: Content) => Date.parse(i.approved_at || i.created_at) || 0;
  const sorted = [...filtered].sort((a, b) =>
    state.sort === "title"
      ? a.title.localeCompare(b.title, "vi")
      : state.sort === "oldest"
        ? time(a) - time(b) || a.id.localeCompare(b.id)
        : time(b) - time(a) || a.id.localeCompare(b.id),
  );
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, state.page), pages);
  return {
    total: sorted.length,
    pages,
    page,
    items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  };
}

export function activeFilterCount(state: KnowledgeState) {
  return [state.process, state.type, state.department].filter(Boolean).length;
}

/** Plain-text preview from the body object ({heading: text}). */
export function excerpt(body: unknown, max = 180) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const text = Object.values(body as Record<string, unknown>)
    .filter((v) => typeof v === "string")
    .join(" ")
    .replace(/^\s*(?:[-•*+]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** DEMO illustration per process code (UI-02 assets). Never a content attachment. */
export function thumbnail(processCode: string | undefined, kind: string) {
  const known = ["PREPRESS", "OFFSET", "DIGITAL", "FLEXO", "FINISHING"];
  if (processCode && known.includes(processCode))
    return `/images/dashboard-demo/${processCode === "PREPRESS" ? "prepress" : processCode.toLowerCase()}.webp`;
  return kind === "INCIDENT_GUIDE"
    ? "/images/dashboard-demo/quality.webp"
    : "/images/dashboard-demo/offset.webp";
}

export function detailHref(item: Pick<Content, "id" | "kind">) {
  return `${item.kind === "INCIDENT_GUIDE" ? "/incidents" : "/knowledge"}/${item.id}`;
}

/**
 * Read every page of one ACL-protected listing. Filters run on the whole snapshot,
 * so refuse oversized or changing snapshots instead of showing wrong counts.
 */
export async function loadAll(
  readPage: (page: number) => Promise<ContentPage>,
  limit = 2000,
): Promise<Content[]> {
  const first = await readPage(1);
  if (first.total > limit)
    throw new Error(
      `Kết quả vượt ${limit.toLocaleString("vi-VN")} bài. Hãy thêm từ khóa hoặc chọn công đoạn để thu hẹp.`,
    );
  if (first.pageSize < 1) throw new Error("Phân trang không hợp lệ.");
  const items = [...first.items];
  for (let p = 2; p <= Math.ceil(first.total / first.pageSize); p++) {
    const next = await readPage(p);
    if (next.total !== first.total || next.page !== p)
      throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
    items.push(...next.items);
  }
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
  return items;
}
