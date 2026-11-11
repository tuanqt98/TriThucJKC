// Pure helpers for the document detail screen (UI-04). No I/O; unit-tested in scripts/tests.
import type { ReadingTask } from "./documents-model";

export type Section = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};
export type AttachmentFile = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  malware_scan_status: string;
  created_at?: string;
};
export type ReadingStatus =
  "ACKNOWLEDGED" | "PENDING" | "OVERDUE" | "NOT_ASSIGNED" | "UNKNOWN";
export type ReadingSummary = {
  status: ReadingStatus;
  /** Assignment for the version being displayed, if the API says it is current. */
  current: ReadingTask | null;
  /** Older versions of this document assigned to me (history, never rewritten). */
  history: ReadingTask[];
  /** I was assigned/acknowledged an older version and the current one needs a separate ACK. */
  newVersionPending: boolean;
};

const BULLET = /^\s*(?:[-•*+]|\d+[.)])\s+/;
/** Generic body keys from the authoring form are shown as "Nội dung". */
const GENERIC_KEYS = new Set(["text", "body", "content", "noi_dung"]);

export function sectionTitle(key: string) {
  return GENERIC_KEYS.has(key.trim().toLowerCase()) ? "Nội dung" : key.trim();
}

const ORDER = /^\s*(\d{1,3})\s*[.)\-:]\s*/;
/**
 * Body is a JSON object of {heading: text}; each entry becomes one numbered section.
 * PostgreSQL jsonb does not keep key order, so headings written as "1. Mục đích"
 * are sorted by that number (and the prefix is hidden). Others keep API order after them.
 */
export function parseSections(body: unknown): Section[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const sections: Section[] = [];
  const entries = Object.entries(body as Record<string, unknown>)
    .map(([key, raw], i) => {
      const m = key.match(ORDER);
      return {
        key: m ? key.slice(m[0].length) : key,
        raw,
        rank: m ? Number(m[1]) : Number.MAX_SAFE_INTEGER,
        i,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.i - b.i);
  for (const { key, raw } of entries) {
    if (raw === null || raw === undefined) continue;
    const text =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map((x) => `- ${String(x)}`).join("\n")
          : JSON.stringify(raw);
    const paragraphs: string[] = [],
      bullets: string[] = [];
    for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
      const value = line.trim();
      if (!value) continue;
      if (BULLET.test(value)) bullets.push(value.replace(BULLET, "").trim());
      else paragraphs.push(value);
    }
    if (!paragraphs.length && !bullets.length) continue;
    sections.push({ title: sectionTitle(key), paragraphs, bullets });
  }
  return sections;
}

export function readingSummary(
  tasks: ReadingTask[] | null,
  contentId: string,
  versionId: string,
  now: number,
): ReadingSummary {
  if (tasks === null)
    return {
      status: "UNKNOWN",
      current: null,
      history: [],
      newVersionPending: false,
    };
  const mine = tasks.filter((t) => t.content_id === contentId);
  const current =
    mine.find((t) => t.version_id === versionId && t.is_current) || null;
  const history = mine
    .filter((t) => t.version_id !== versionId)
    .sort((a, b) => b.version_number - a.version_number);
  const status: ReadingStatus = !current
    ? "NOT_ASSIGNED"
    : current.acknowledged_at
      ? "ACKNOWLEDGED"
      : current.due_at && Date.parse(current.due_at) < now
        ? "OVERDUE"
        : "PENDING";
  return {
    status,
    current,
    history,
    newVersionPending:
      !!current && !current.acknowledged_at && history.length > 0,
  };
}

export const readingText: Record<ReadingStatus, string> = {
  ACKNOWLEDGED: "Đã xác nhận",
  PENDING: "Chưa xác nhận",
  OVERDUE: "Quá hạn xác nhận",
  NOT_ASSIGNED: "Không được giao đọc",
  UNKNOWN: "Chưa tải trạng thái",
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function fileKind(file: Pick<AttachmentFile, "mime_type" | "filename">) {
  const name = file.filename.toLowerCase();
  if (file.mime_type === "application/pdf" || name.endsWith(".pdf"))
    return "pdf";
  if (file.mime_type.startsWith("image/")) return "image";
  if (/\.(xlsx?|csv)$/.test(name)) return "sheet";
  return "file";
}

export type AckError =
  "CONFLICT" | "NOT_FOUND" | "SESSION" | "FORBIDDEN" | "OTHER";
/** Map API status codes from POST /reading-assignments/{id}/acknowledge to UI handling. */
export function ackError(status: number): AckError {
  if (status === 409) return "CONFLICT";
  if (status === 404) return "NOT_FOUND";
  if (status === 401) return "SESSION";
  if (status === 403) return "FORBIDDEN";
  return "OTHER";
}
