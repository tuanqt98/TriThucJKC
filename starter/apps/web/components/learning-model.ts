// Pure helpers for "Đào tạo / Khóa học của tôi" (UI-08). No I/O; unit-tested in scripts/tests.
// Data: GET /my/learning (status computed by jkc_training_status; lesson counts) and GET /my/learning/{id}
// (lessons, questions WITHOUT answer keys, attempts). Grading and completion are server-side only.

export type LearningStatus =
  "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "OVERDUE";
export type LearningItem = {
  id: string;
  title: string;
  version_number: number;
  due_at: string | null;
  completed_at: string | null;
  status: LearningStatus | string;
  completed_lessons: number;
  total_lessons: number;
};
export type Attempt = {
  id: string;
  attempt_no: number;
  score: string | number | null;
  passed: boolean | null;
  correct_count: number | null;
  question_count: number | null;
  submitted_at: string | null;
  pass_score_snapshot: string | number | null;
};
export type CourseDetail = {
  id: string;
  title: string;
  course_version_id: string;
  version_number: number;
  pass_score: string | number | null;
  max_attempts: number;
  completed_at: string | null;
  lessons: {
    id: string;
    title: string;
    body: Record<string, unknown>;
    completed: boolean;
  }[];
  questions: {
    id: string;
    question: string;
    options: { id: string; answer_text: string }[];
  }[];
  attempts: Attempt[];
};

export const STATUS_ORDER: LearningStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "OVERDUE",
  "FAILED",
];
export const statusLabel: Record<LearningStatus, string> = {
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang học",
  COMPLETED: "Hoàn thành",
  OVERDUE: "Quá hạn",
  FAILED: "Không đạt",
};
export const isStatus = (s: string): s is LearningStatus =>
  (STATUS_ORDER as string[]).includes(s);
export const labelOf = (s: string) => (isStatus(s) ? statusLabel[s] : s);

export function counts(items: LearningItem[]) {
  const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    LearningStatus,
    number
  >;
  for (const i of items) if (isStatus(i.status)) c[i.status]++;
  return c;
}

/** Lesson-based progress straight from the backend counts; null when the course has no lessons. */
export function progress(
  i: Pick<LearningItem, "completed_lessons" | "total_lessons">,
) {
  if (!i.total_lessons || i.total_lessons < 0) return null;
  const done = Math.min(Math.max(i.completed_lessons, 0), i.total_lessons);
  return {
    done,
    total: i.total_lessons,
    percent: Math.round((done / i.total_lessons) * 100),
  };
}

export function ctaLabel(i: LearningItem) {
  if (i.status === "COMPLETED") return "Xem lại khóa học";
  if (i.status === "FAILED") return "Xem kết quả";
  return i.completed_lessons > 0 ? "Tiếp tục học" : "Bắt đầu học";
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function filterCourses(
  items: LearningItem[],
  status: "" | LearningStatus,
  q: string,
) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return items.filter(
    (i) =>
      (!status || i.status === status) &&
      words.every((w) => fold(i.title).includes(w)),
  );
}

/** Not completed and with a due date, nearest first (the "nhắc việc" panel uses real due dates only). */
export function upcoming(items: LearningItem[], max = 5) {
  return items
    .filter((i) => i.status !== "COMPLETED" && i.due_at)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
    .slice(0, max);
}

/**
 * Courses whose details are read for "Kết quả kiểm tra gần đây" (no recent-attempts endpoint, DATA-34).
 * NOT_STARTED has no attempt by the backend rule. Half the budget goes to completed courses (newest completion
 * first), half to the other states (latest due date first, i.e. newer assignments); at most `max` requests.
 */
export function resultCandidates(items: LearningItem[], max = 30) {
  const time = (v: string | null) => (v ? Date.parse(v) : 0);
  const done = items
    .filter((i) => i.status === "COMPLETED")
    .sort((a, b) => time(b.completed_at) - time(a.completed_at));
  const rest = items
    .filter((i) => i.status !== "COMPLETED" && i.status !== "NOT_STARTED")
    .sort((a, b) => time(b.due_at) - time(a.due_at));
  const half = Math.ceil(max / 2);
  const picked = [
    ...done.slice(0, half),
    ...rest.slice(0, max - Math.min(done.length, half)),
  ];
  return picked.length < max
    ? [...picked, ...done.slice(half)].slice(0, max)
    : picked;
}

export type RecentResult = Attempt & { assignmentId: string; title: string };
export function recentResults(
  details: { id: string; detail: CourseDetail }[],
  max = 5,
): RecentResult[] {
  return details
    .flatMap(({ id, detail }) =>
      detail.attempts
        .filter((a) => a.submitted_at)
        .map((a) => ({ ...a, assignmentId: id, title: detail.title })),
    )
    .sort((a, b) => Date.parse(b.submitted_at!) - Date.parse(a.submitted_at!))
    .slice(0, max);
}

/** Same checks the API enforces before starting an attempt; the server stays authoritative. */
export function quizGate(d: CourseDetail) {
  const pending = d.attempts.find((a) => !a.submitted_at) || null;
  const submitted = d.attempts.filter((a) => a.submitted_at).length;
  const passed = d.attempts.some((a) => a.passed);
  let blocked = "";
  if (!d.questions.length || d.pass_score === null)
    blocked = "Phiên bản khóa học này chưa có bài kiểm tra hợp lệ.";
  else if (passed || d.completed_at)
    blocked = "Bạn đã đạt bài kiểm tra của khóa học này.";
  else if (!pending && d.attempts.length >= d.max_attempts)
    blocked = "Bạn đã dùng hết số lần làm bài cho phiên bản này.";
  else if (d.lessons.some((l) => !l.completed))
    blocked = "Hoàn thành các bài học trước khi bắt đầu kiểm tra.";
  return { pending, submitted, used: d.attempts.length, passed, blocked };
}

/** Builds the payload only when every question has exactly one chosen option. */
export function submission(d: CourseDetail, answers: Record<string, string>) {
  const out = d.questions.map((q) => ({
    question_id: q.id,
    option_id: answers[q.id],
  }));
  return out.every((a, i) =>
    d.questions[i].options.some((o) => o.id === a.option_id),
  )
    ? { answers: out }
    : null;
}

export const score = (v: string | number | null) =>
  v === null || v === undefined ? "—" : String(Number(v)).replace(".", ",");

const TZ = "Asia/Ho_Chi_Minh";
export const day = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("vi-VN", { timeZone: TZ }) : "";
