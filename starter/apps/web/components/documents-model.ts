import type { Content, ContentPage } from "./api";

export type DocumentRecord = Content & { owner_department_id: string | null };
export type ReadingTask = {
  id: string;
  content_id: string;
  title: string;
  version_id: string;
  version_number: number;
  due_at: string | null;
  acknowledged_at: string | null;
  is_current: boolean;
};
export type ReadingState =
  "PENDING" | "ACKNOWLEDGED" | "OVERDUE" | "NOT_ASSIGNED" | "UNKNOWN";
export type DocumentRow = {
  document: DocumentRecord;
  task: ReadingTask | null;
  readingState: ReadingState;
};
export type Filters = {
  query: string;
  department: string;
  version: string;
  reading: string;
  required: string;
  publication: string;
};
export const emptyFilters: Filters = {
  query: "",
  department: "",
  version: "",
  reading: "",
  required: "",
  publication: "",
};
export const readingLabels: Record<ReadingState, string> = {
  PENDING: "Chờ xác nhận",
  ACKNOWLEDGED: "Đã xác nhận",
  OVERDUE: "Quá hạn",
  NOT_ASSIGNED: "Không được giao",
  UNKNOWN: "Chưa tải trạng thái",
};
export function documentRows(
  documents: DocumentRecord[],
  reading: ReadingTask[] | null,
  now: number,
): DocumentRow[] {
  const tasks = new Map(
    reading
      ?.filter((t) => t.is_current)
      .map((t) => [`${t.content_id}:${t.version_id}`, t]),
  );
  return documents.map((document) => {
    const task = tasks.get(`${document.id}:${document.version_id}`) || null;
    const readingState: ReadingState =
      reading === null
        ? "UNKNOWN"
        : !task
          ? "NOT_ASSIGNED"
          : task.acknowledged_at
            ? "ACKNOWLEDGED"
            : task.due_at && Date.parse(task.due_at) < now
              ? "OVERDUE"
              : "PENDING";
    return { document, task, readingState };
  });
}
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}
export function filterDocuments(rows: DocumentRow[], filters: Filters) {
  const query = normalize(filters.query);
  return rows.filter(
    ({ document: d, readingState, task }) =>
      (!query || normalize(`${d.title} ${d.code}`).includes(query)) &&
      (!filters.department ||
        (d.owner_department_id || "unknown") === filters.department) &&
      (!filters.version || String(d.version_number) === filters.version) &&
      (!filters.reading || readingState === filters.reading) &&
      (!filters.publication || d.status === filters.publication) &&
      (!filters.required ||
        (readingState !== "UNKNOWN" &&
          (filters.required === "yes" ? !!task : !task))),
  );
}
// Client-side filters must run over the full ACL-protected snapshot, not one API page.
// Reject oversized/changing snapshots rather than displaying incomplete counts.
export async function loadDocumentSnapshot(
  readPage: (page: number) => Promise<ContentPage>,
): Promise<DocumentRecord[]> {
  const first = await readPage(1);
  if (first.total > 2000)
    throw new Error(
      "Danh sách vượt 2.000 tài liệu. Cần bộ lọc phía API trước khi hiển thị đầy đủ; vui lòng liên hệ IT.",
    );
  const items = [...first.items];
  if (first.pageSize < 1) throw new Error("Phân trang tài liệu không hợp lệ.");
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    const next = await readPage(page);
    if (
      next.total !== first.total ||
      next.pageSize !== first.pageSize ||
      next.page !== page
    )
      throw new Error("Danh sách tài liệu vừa thay đổi. Vui lòng tải lại.");
    items.push(...next.items);
  }
  if (
    items.length !== first.total ||
    new Set(items.map((i) => i.id)).size !== items.length
  )
    throw new Error("Danh sách tài liệu vừa thay đổi. Vui lòng tải lại.");
  return items as DocumentRecord[];
}
