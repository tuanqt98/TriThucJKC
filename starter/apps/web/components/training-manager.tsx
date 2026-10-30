"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./api";
import { useManagement } from "./use-management";
type Lesson = { title: string; body: Record<string, unknown> };
type Question = {
  question: string;
  options: { answer_text: string; is_correct: boolean }[];
};
type Course = {
  id: string;
  title: string;
  version_id: string;
  version_number: number;
  revision: number;
  status: string;
  pass_score: number;
  max_attempts: number;
  lessons: Lesson[];
  questions: Question[];
  can_edit: boolean;
  can_review: boolean;
};
type Person = {
  id: string;
  full_name: string;
  department_id: string;
  department_name: string;
};
type Progress = {
  id: string;
  title: string;
  full_name: string;
  version_number: number;
  status: string;
  due_at: string | null;
};
export const trainingLabels: Record<string, string> = {
  NOT_STARTED: "Chưa học",
  IN_PROGRESS: "Đang học",
  COMPLETED: "Hoàn thành",
  FAILED: "Không đạt",
  OVERDUE: "Quá hạn",
};
const blankQuestion = (): Question => ({
  question: "",
  options: [
    { answer_text: "", is_correct: true },
    { answer_text: "", is_correct: false },
  ],
});
type Mutate = (
  path: string,
  body: unknown,
  method?: string,
) => Promise<Record<string, unknown> | null>;
function CourseEditor({
  v,
  people,
  busy,
  mutate,
  select,
}: {
  v: Course;
  people: Person[];
  busy: boolean;
  mutate: Mutate;
  select: (id: string) => void;
}) {
  const [lessons, setLessons] = useState<Lesson[]>(
    v.lessons.length ? v.lessons : [{ title: "", body: { text: "" } }],
  );
  const [questions, setQuestions] = useState<Question[]>(
    v.questions.length ? v.questions : [blankQuestion()],
  );
  const identity = {
    course_id: v.id,
    version_id: v.version_id,
    revision: v.revision,
  };
  const editable = v.can_edit && v.status === "DRAFT";
  const departments = [
    ...new Map(
      people.map((p) => [p.department_id, p.department_name]),
    ).entries(),
  ];
  async function act(action: string) {
    const r = await mutate(`/workspace/courses/${action}`, identity);
    if (r?.version_id) select(String(r.version_id));
  }
  return (
    <section className="panel">
      <h2>
        {v.title} · v{v.version_number}
      </h2>
      <p>
        {v.status === "APPROVED"
          ? "Đã ban hành"
          : v.status === "PENDING"
            ? "Chờ duyệt"
            : "Bản nháp"}{" "}
        · Lần sửa {v.revision}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await mutate(
            "/workspace/courses",
            {
              ...identity,
              pass_score: Number(f.get("pass_score")),
              max_attempts: Number(f.get("max_attempts")),
              lessons: lessons.map((l) => ({ title: l.title, body: l.body })),
              questions,
            },
            "PUT",
          );
        }}
      >
        <fieldset disabled={!editable || busy}>
          <legend>Nội dung khóa học và quiz</legend>
          <label>
            Điểm đạt (%)
            <input
              name="pass_score"
              type="number"
              min={1}
              max={100}
              defaultValue={v.pass_score || 70}
              required
            />
          </label>
          <label>
            Số lượt làm tối đa
            <input
              name="max_attempts"
              type="number"
              min={1}
              max={10}
              defaultValue={v.max_attempts}
              required
            />
          </label>
          {lessons.map((l, k) => (
            <div className="version-choice" key={k}>
              <label>
                Tên bài học {k + 1}
                <input
                  required
                  maxLength={200}
                  value={l.title}
                  onChange={(e) =>
                    setLessons(
                      lessons.map((x, n) =>
                        n === k ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Nội dung bài {k + 1}
                <textarea
                  required
                  rows={4}
                  value={String(l.body.text || "")}
                  onChange={(e) =>
                    setLessons(
                      lessons.map((x, n) =>
                        n === k
                          ? { ...x, body: { ...x.body, text: e.target.value } }
                          : x,
                      ),
                    )
                  }
                />
              </label>
              {lessons.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLessons(lessons.filter((_, n) => n !== k))}
                >
                  Xóa bài {k + 1}
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button
              type="button"
              onClick={() =>
                setLessons([...lessons, { title: "", body: { text: "" } }])
              }
            >
              Thêm bài học
            </button>
          )}
          {(editable || v.status === "PENDING") &&
            questions.map((q, k) => (
              <div className="version-choice" key={k}>
                <label>
                  Câu hỏi {k + 1}
                  <textarea
                    required
                    value={q.question}
                    onChange={(e) =>
                      setQuestions(
                        questions.map((x, n) =>
                          n === k ? { ...x, question: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                {q.options.map((o, j) => (
                  <label key={j}>
                    Đáp án {k + 1}.{j + 1}
                    <input
                      required
                      maxLength={2000}
                      value={o.answer_text}
                      onChange={(e) =>
                        setQuestions(
                          questions.map((x, n) =>
                            n === k
                              ? {
                                  ...x,
                                  options: x.options.map((a, b) =>
                                    b === j
                                      ? { ...a, answer_text: e.target.value }
                                      : a,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <label>
                  Đáp án đúng của câu {k + 1}
                  <select
                    value={q.options.findIndex((o) => o.is_correct)}
                    onChange={(e) =>
                      setQuestions(
                        questions.map((x, n) =>
                          n === k
                            ? {
                                ...x,
                                options: x.options.map((o, j) => ({
                                  ...o,
                                  is_correct: j === Number(e.target.value),
                                })),
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    {q.options.map((_, j) => (
                      <option value={j} key={j}>
                        Đáp án {j + 1}
                      </option>
                    ))}
                  </select>
                </label>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions(questions.filter((_, n) => n !== k))
                    }
                  >
                    Xóa câu {k + 1}
                  </button>
                )}
              </div>
            ))}
          {editable && (
            <>
              <button
                type="button"
                onClick={() => setQuestions([...questions, blankQuestion()])}
              >
                Thêm câu hỏi
              </button>
              <button className="button" disabled={busy}>
                Lưu khóa học
              </button>
            </>
          )}
        </fieldset>
      </form>
      {v.can_edit && v.status === "DRAFT" && (
        <button
          className="button"
          disabled={busy}
          onClick={() => act("submit")}
        >
          Gửi duyệt khóa đã lưu
        </button>
      )}
      {v.can_edit && v.status === "APPROVED" && (
        <button className="button" disabled={busy} onClick={() => act("fork")}>
          Tạo phiên bản khóa mới
        </button>
      )}
      {v.can_review && v.status === "PENDING" && (
        <button
          className="button"
          disabled={busy}
          onClick={() => act("approve")}
        >
          Phê duyệt khóa học
        </button>
      )}
      {v.status === "APPROVED" && people.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const target = String(f.get("target"));
            await mutate("/workspace/courses/assign", {
              ...identity,
              ...(target.startsWith("dept:")
                ? { department_id: target.slice(5) }
                : { user_id: target }),
              due_at: f.get("due")
                ? new Date(String(f.get("due"))).toISOString()
                : null,
            });
          }}
        >
          <h3>Giao khóa học</h3>
          <label>
            Người học hoặc bộ phận
            <select name="target" required>
              <option value="">Chọn người nhận</option>
              <optgroup label="Bộ phận">
                {departments.map(([id, name]) => (
                  <option value={`dept:${id}`} key={id}>
                    {name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Nhân viên">
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} · {p.department_name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label>
            Hạn hoàn thành
            <input name="due" type="datetime-local" />
          </label>
          <button className="button" disabled={busy}>
            Giao khóa đã ban hành
          </button>
        </form>
      )}
    </section>
  );
}
export function TrainingManager() {
  const m = useManagement<Course>("/workspace/courses");
  const [selected, setSelected] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    Promise.all([
      api<Person[]>("/workspace/people"),
      api<Progress[]>("/workspace/courses/progress"),
    ])
      .then(([p, s]) => {
        setPeople(p);
        setProgress(s);
      })
      .catch((e) => setError(e.message));
  }, [m.rows]);
  const v = m.rows.find((c) => c.version_id === selected);
  return (
    <main className="authoring-page">
      <nav>
        <Link href="/">← Dashboard</Link>
        <Link href="/learning">Khóa học của tôi</Link>
        <Link href="/workspace">Nội quy / Tri thức</Link>
        <Link href="/incidents/manage">Hồ sơ sự cố</Link>
      </nav>
      <h1>Biên soạn và giao đào tạo</h1>
      <p className="subtle">
        Chỉ dữ liệu DEMO. Trưởng bộ phận duyệt đúng phạm vi và giao khóa đã ban
        hành; không tự duyệt. Quiz chấm tại server, lịch sử giữ theo phiên bản.
      </p>
      {m.loading && <p aria-busy="true">Đang tải…</p>}
      {(m.error || error) && (
        <p role="alert" className="error">
          {m.error || error}
        </p>
      )}
      {m.notice && (
        <p role="status" className="notice">
          {m.notice}
        </p>
      )}
      <section className="panel">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await m.mutate("/workspace/courses", {
              title: f.get("title"),
            });
            if (r?.version_id) setSelected(String(r.version_id));
          }}
        >
          <h2>Tạo khóa học</h2>
          <label>
            Tên khóa học
            <input name="title" required maxLength={200} />
          </label>
          <button className="button" disabled={m.busy}>
            Tạo khóa nháp
          </button>
        </form>
      </section>
      <div className="authoring-grid">
        <section className="panel">
          <h2>Khóa thuộc quyền biên soạn / quản lý</h2>
          {!m.rows.length && !m.loading && (
            <p>Chưa có khóa được quyền quản lý.</p>
          )}
          {m.rows.map((c) => (
            <button
              className="version-choice"
              key={c.version_id}
              aria-pressed={selected === c.version_id}
              onClick={() => setSelected(c.version_id)}
            >
              <strong>
                {c.title} · v{c.version_number}
              </strong>
              <span>
                {c.status === "APPROVED"
                  ? "Đã ban hành"
                  : c.status === "PENDING"
                    ? "Chờ duyệt"
                    : "Bản nháp"}
              </span>
            </button>
          ))}
        </section>
        {v && (
          <CourseEditor
            key={v.version_id + ":" + v.revision}
            v={v}
            people={people}
            busy={m.busy}
            mutate={m.mutate}
            select={setSelected}
          />
        )}
      </div>
      <section className="panel">
        <h2>Tiến độ đào tạo trong phạm vi</h2>
        <label>
          Lọc trạng thái học
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(trainingLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {!progress.filter((p) => !filter || p.status === filter).length && (
          <p>Chưa có kết quả trong bộ lọc này.</p>
        )}
        {progress
          .filter((p) => !filter || p.status === filter)
          .map((p) => (
            <article key={p.id} className="version-choice">
              <strong>
                {p.full_name} — {p.title} · v{p.version_number}
              </strong>
              <span>
                {trainingLabels[p.status]} · Hạn{" "}
                {p.due_at
                  ? new Date(p.due_at).toLocaleString("vi-VN")
                  : "không đặt"}
              </span>
            </article>
          ))}
      </section>
    </main>
  );
}
