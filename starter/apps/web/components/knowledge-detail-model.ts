// Pure helpers for the knowledge article detail (UI-05B). No I/O; unit-tested in scripts/tests.
import type { Content } from "./api";
import { sectionTitle, type AttachmentFile } from "./document-detail-model.ts";
import { readState, writeState } from "./knowledge-model.ts";

export type Block =
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "image"; file: AttachmentFile };
export type ArticleSection = {
  title: string;
  caution: boolean;
  blocks: Block[];
};

const ORDER = /^\s*(\d{1,3})\s*[.)\-:]\s*/;
const BULLET = /^[-•*+]\s+/;
const NUMBERED = /^\d{1,3}[.)]\s+/;
const IMAGE_REF = /^(?:ảnh|hình|hình ảnh)\s*:\s*/i;
const CAUTION = /an toàn|lưu ý|cảnh báo/i;

export const isImage = (f: AttachmentFile) =>
  f.mime_type.startsWith("image/") && f.malware_scan_status === "CLEAN";

/**
 * Body is {heading: text}. jsonb does not keep key order, so headings written "1. …" are sorted by
 * that number (prefix hidden); others keep API order after them (same rule as UI-04 parseSections).
 * Lines become paragraphs / bullet lists / numbered lists, kept in their original order. A line that is
 * exactly the filename of a clean image attachment of this version (optionally "Ảnh: <tên tệp>") shows
 * that image in place: the only link between steps and images until sections own attachments (DATA-04).
 */
export function articleSections(
  body: unknown,
  files: AttachmentFile[] = [],
): ArticleSection[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const images = new Map(
    files.filter(isImage).map((f) => [f.filename.trim().toLowerCase(), f]),
  );
  return Object.entries(body as Record<string, unknown>)
    .map(([key, raw], i) => {
      const m = key.match(ORDER);
      return {
        key: m ? key.slice(m[0].length) : key,
        raw,
        rank: m ? Number(m[1]) : Number.MAX_SAFE_INTEGER,
        i,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .flatMap(({ key, raw }) => {
      if (raw === null || raw === undefined) return [];
      const text =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? raw.map((x) => `- ${String(x)}`).join("\n")
            : JSON.stringify(raw);
      const blocks: Block[] = [];
      for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
        const value = line.trim();
        if (!value) continue;
        const image = images.get(
          value.replace(IMAGE_REF, "").trim().toLowerCase(),
        );
        const kind = BULLET.test(value)
          ? "ul"
          : NUMBERED.test(value)
            ? "ol"
            : null;
        const last = blocks[blocks.length - 1];
        if (image) blocks.push({ type: "image", file: image });
        else if (kind && last?.type === kind)
          last.items.push(value.replace(kind === "ul" ? BULLET : NUMBERED, ""));
        else if (kind)
          blocks.push({
            type: kind,
            items: [value.replace(kind === "ul" ? BULLET : NUMBERED, "")],
          });
        else blocks.push({ type: "p", text: value });
      }
      if (!blocks.length) return [];
      const title = sectionTitle(key);
      return [{ title, caution: CAUTION.test(title), blocks }];
    });
}

/** Cover = first clean image not placed in a section; the rest of the unplaced images form the gallery. */
export function splitImages(
  files: AttachmentFile[],
  sections: ArticleSection[],
) {
  const placed = new Set(
    sections.flatMap((s) =>
      s.blocks.flatMap((b) => (b.type === "image" ? [b.file.id] : [])),
    ),
  );
  const loose = files.filter((f) => isImage(f) && !placed.has(f.id));
  return {
    cover: loose[0] || null,
    gallery: loose.slice(1),
    all: files.filter(isImage),
  };
}

/** Workflow-generated codes ("S1-<uuid>") are technical identifiers, not business document numbers. */
export function businessCode(code: string | null | undefined) {
  if (!code) return "";
  return /^S1-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    code,
  )
    ? ""
    : code;
}

export function relatedArticles(items: Content[], currentId: string, max = 3) {
  return items.filter((i) => i.id !== currentId).slice(0, max);
}

// --- Return to the library with the same keyword/filters/page/view (PO decision 8) -----------------------------
// The library URL is the source of truth (UI-05). sessionStorage is per browser tab, so tabs never share it;
// it survives reload of the detail page and is empty when a link is opened directly in a fresh tab.
export const LIBRARY_QUERY_KEY = "jkc.knowledge.query";
export const LIBRARY_FROM_KEY = "jkc.knowledge.from";

/** Only known, validated UI-05 parameters survive (no open redirect, no foreign keys). */
export function libraryHref(saved: string | null | undefined) {
  const query = writeState(readState(new URLSearchParams(saved || "")));
  return query ? `/knowledge?${query}` : "/knowledge";
}

/**
 * Use history.back() only when this tab came to this article from the library (exact restore incl. scroll);
 * otherwise (direct open, new tab, came from a related article) navigate to the saved library URL.
 */
export function shouldGoBack(
  from: string | null,
  currentId: string,
  historyLength: number,
) {
  return from === currentId && historyLength > 1;
}
