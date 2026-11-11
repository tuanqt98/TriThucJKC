// Pure helpers for "Bài viết của tôi" (UI-07 / DATA-33). No I/O; unit-tested in scripts/tests.
// Source: GET /workspace/contents (author's own contents, every version, plus pending items the user may
// review). Only the user's own ARTICLE contents are listed; nothing here changes permissions or workflow.

export type WorkspaceItem = {
  id: string;
  version_id: string;
  version_number: number;
  revision: number;
  status: string;
  title: string;
  kind: string;
  creator_id: string;
  process_id: string | null;
  created_at: string;
  can_edit: boolean;
  remark: string | null;
};

export type MineStatus =
  "DRAFT" | "PENDING" | "CHANGES_REQUESTED" | "REJECTED" | "APPROVED";
export const STATUSES: MineStatus[] = [
  "DRAFT",
  "PENDING",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
];
export const statusLabel: Record<MineStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  CHANGES_REQUESTED: "Cần chỉnh sửa",
  REJECTED: "Bị từ chối",
  APPROVED: "Đã duyệt",
};

export type MineRow = {
  id: string;
  title: string;
  status: MineStatus;
  versionNumber: number;
  createdAt: string;
  processId: string | null;
  remark: string | null;
  /** An earlier version is approved and still shown in the library while this newer one is in progress. */
  publishedVersion: number | null;
};

/** One row per own article = its latest version (the one the workflow acts on). */
export function groupMine(items: WorkspaceItem[], userId: string): MineRow[] {
  const byId = new Map<string, WorkspaceItem[]>();
  for (const it of items) {
    if (it.kind !== "ARTICLE" || it.creator_id !== userId) continue;
    byId.set(it.id, [...(byId.get(it.id) || []), it]);
  }
  const rows: MineRow[] = [];
  for (const versions of byId.values()) {
    versions.sort((a, b) => b.version_number - a.version_number);
    const latest = versions[0];
    if (!STATUSES.includes(latest.status as MineStatus)) continue;
    const published =
      latest.status === "APPROVED"
        ? null
        : (versions.find((v) => v.status === "APPROVED")?.version_number ??
          null);
    rows.push({
      id: latest.id,
      title: latest.title,
      status: latest.status as MineStatus,
      versionNumber: latest.version_number,
      createdAt: latest.created_at,
      processId: latest.process_id,
      remark: latest.remark,
      publishedVersion: published,
    });
  }
  return rows.sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export type MineAction = { label: string; href: string; primary?: boolean };

/** Only actions the workflow accepts for the status; editing always happens in the UI-07 form. */
export function actionsFor(row: MineRow): MineAction[] {
  const form = `/knowledge/new?id=${row.id}`;
  const live = `/knowledge/${row.id}`;
  const actions: MineAction[] =
    row.status === "DRAFT"
      ? [{ label: "Tiếp tục soạn", href: form, primary: true }]
      : row.status === "PENDING"
        ? [{ label: "Xem bài đang chờ duyệt", href: form }]
        : row.status === "APPROVED"
          ? [
              { label: "Xem trong Kho tri thức", href: live, primary: true },
              { label: "Tạo bản sửa mới", href: form },
            ]
          : [{ label: "Xem ý kiến và tạo bản sửa", href: form, primary: true }];
  if (row.publishedVersion)
    actions.push({
      label: `Xem bản v${row.publishedVersion} đang hiển thị`,
      href: live,
    });
  return actions;
}

export function counts(rows: MineRow[]) {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    MineStatus,
    number
  >;
  for (const r of rows) c[r.status]++;
  return c;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export const MINE_PAGE_SIZE = 10;

export function filterMine(
  rows: MineRow[],
  opts: { status: "" | MineStatus; q: string; page: number },
) {
  const words = fold(opts.q).split(/\s+/).filter(Boolean);
  const filtered = rows.filter(
    (r) =>
      (!opts.status || r.status === opts.status) &&
      words.every((w) => fold(r.title).includes(w)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / MINE_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);
  return {
    total: filtered.length,
    pages,
    page,
    items: filtered.slice((page - 1) * MINE_PAGE_SIZE, page * MINE_PAGE_SIZE),
  };
}

export function readMineState(params: URLSearchParams) {
  const status = params.get("status") || "";
  const page = Number(params.get("page"));
  return {
    status: (STATUSES.includes(status as MineStatus) ? status : "") as
      "" | MineStatus,
    q: (params.get("q") || "").slice(0, 200),
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

export function writeMineState(s: { status: string; q: string; page: number }) {
  const p = new URLSearchParams();
  if (s.status) p.set("status", s.status);
  if (s.q.trim()) p.set("q", s.q.trim());
  if (s.page > 1) p.set("page", String(s.page));
  return p.toString();
}
