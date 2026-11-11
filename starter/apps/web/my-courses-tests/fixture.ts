// UI-08 DEMO fixture: courses through the real training workflow (author drafts -> department head approves
// and assigns to "employee" with a due date), then learner actions through the learner API to reach each
// status. Never writes the database directly. Generic DEMO text; answer keys stay on the server.
import type { APIRequest } from "@playwright/test";
import { session } from "../knowledge-tests/fixture.ts";

type V = { id: string; version_id: string; revision: number };
export type CourseSpec = {
  name: string;
  dueDays: number | null;
  /** what the learner does after assignment */
  learner: "none" | "one-lesson" | "pass" | "fail";
  maxAttempts?: number;
};
export const QUESTIONS = [
  {
    question:
      "DEMO · Khi phát hiện bất thường trên tờ in, bước đầu tiên là gì?",
    correct: "Báo trưởng ca và ghi nhận bằng chứng",
    wrong: "Tự chỉnh thông số máy",
  },
  {
    question: "DEMO · Thông số vận hành chính thức lấy ở đâu?",
    correct: "Tài liệu kỹ thuật đã ban hành",
    wrong: "Ghi chú cá nhân",
  },
];

export async function createCourses(
  request: APIRequest,
  password: string,
  token: string,
  specs: CourseSpec[],
) {
  const author = await session(request, "employee", password);
  const head = await session(request, "head", password);
  const out: Record<string, { assignment: string; title: string }> = {};
  try {
    const ver = (r: V) => ({
      course_id: r.id,
      version_id: r.version_id,
      revision: r.revision,
    });
    for (const s of specs) {
      const title = `DEMO · ${s.name} ${token}`;
      let v = (await author.call("POST", "/workspace/courses", { title })) as V;
      v = (await author.call("PUT", "/workspace/courses", {
        ...ver(v),
        pass_score: 70,
        max_attempts: s.maxAttempts ?? 3,
        lessons: [
          {
            title: "DEMO · Nhận biết hiện tượng",
            body: {
              "1. Mục tiêu": "Nhận biết hiện tượng bất thường.",
              "2. Nội dung": "- Quan sát tờ in\n- So với mẫu đã duyệt",
            },
          },
          {
            title: "DEMO · Báo cáo và xử lý",
            body: {
              text: "Báo trưởng ca, ghi nhận bằng chứng, áp dụng tài liệu chính thức.",
            },
          },
        ],
        questions: QUESTIONS.map((q) => ({
          question: q.question,
          options: [
            { answer_text: q.wrong, is_correct: false },
            { answer_text: q.correct, is_correct: true },
          ],
        })),
      })) as V;
      v = (await author.call("POST", "/workspace/courses/submit", ver(v))) as V;
      v = (await head.call("POST", "/workspace/courses/approve", ver(v))) as V;
      const due =
        s.dueDays === null
          ? null
          : new Date(Date.now() + s.dueDays * 86400000).toISOString();
      await head.call("POST", "/workspace/courses/assign", {
        ...ver(v),
        user_id: author.me.id,
        due_at: due,
      });
      const mine: { id: string; title: string }[] = await (
        await author.ctx.get("/api/v1/my/learning")
      ).json();
      const assignment = mine.find((m) => m.title === title)!.id;
      out[s.name] = { assignment, title };
      if (s.learner === "none") continue;
      const detail = await (
        await author.ctx.get(`/api/v1/my/learning/${assignment}`)
      ).json();
      const lessons: { id: string }[] = detail.lessons;
      for (const l of s.learner === "one-lesson"
        ? lessons.slice(0, 1)
        : lessons)
        await author.call(
          "POST",
          `/my/learning/${assignment}/lessons/${l.id}/complete`,
        );
      if (s.learner === "one-lesson") continue;
      const attempt = (await author.call(
        "POST",
        `/my/learning/${assignment}/quiz-attempts`,
      )) as V;
      const answers = detail.questions.map(
        (q: {
          id: string;
          question: string;
          options: { id: string; answer_text: string }[];
        }) => {
          const spec = QUESTIONS.find((x) => x.question === q.question)!;
          const want = s.learner === "pass" ? spec.correct : spec.wrong;
          return {
            question_id: q.id,
            option_id: q.options.find((o) => o.answer_text === want)!.id,
          };
        },
      );
      await author.call("POST", `/quiz-attempts/${attempt.id}/submit`, {
        answers,
      });
    }
  } finally {
    await Promise.all([author.close(), head.close()]);
  }
  return out;
}
