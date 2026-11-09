// Pure helpers for the incident solution guide detail (UI-06). No I/O; unit-tested in scripts/tests.
// Content comes from GET /incidents/{id} (approved INCIDENT_GUIDE, ACL-checked). Section roles are derived
// from the approved headings only; nothing here claims a field verification that the API does not return.
import type { ArticleSection } from "./knowledge-detail-model.ts";

export type SectionKind =
  | "symptom"
  | "condition"
  | "cause"
  | "check"
  | "result"
  | "solution"
  | "prevention"
  | "safety"
  | "other";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

// Order matters: "Kết quả sau xử lý" is a result, "Lưu ý phòng ngừa" is prevention.
const RULES: [SectionKind, RegExp][] = [
  ["symptom", /hien tuong|mo ta (su co|van de|loi)/],
  ["condition", /dieu kien/],
  ["cause", /nguyen nhan/],
  ["result", /ket qua/],
  ["check", /kiem tra|chan doan/],
  ["prevention", /phong ngua|ngan ngua/],
  ["safety", /an toan|canh bao|^luu y$/],
  ["solution", /giai phap|xu ly|khac phuc|cach lam/],
];

export function sectionKind(title: string): SectionKind {
  const t = fold(title);
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "other";
}

/** A cause written as a hypothesis ("nghi ngờ", "giả thuyết", "dự kiến") is labelled as not verified. */
export function isHypothesis(title: string) {
  return /nghi ngo|gia thuyet|du kien|co the/.test(fold(title));
}

/** Mobile: symptom, cause and solution are open first (PO priority); everything is open on desktop. */
export function defaultOpen(sections: ArticleSection[]) {
  const open = new Set<number>();
  sections.forEach((s, i) => {
    if (["symptom", "cause", "solution"].includes(sectionKind(s.title)))
      open.add(i);
  });
  if (!open.size && sections.length) open.add(0);
  return open;
}

export const kindLabel: Record<SectionKind, string> = {
  symptom: "Hiện tượng",
  condition: "Điều kiện",
  cause: "Nguyên nhân",
  check: "Kiểm tra",
  result: "Kết quả",
  solution: "Giải pháp",
  prevention: "Phòng ngừa",
  safety: "An toàn",
  other: "Nội dung",
};
