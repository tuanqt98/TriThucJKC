"use client";
// UI-08 · Học khóa học (/learning/[id]). No dedicated mockup: built on the approved UI-02..07 design system,
// keeping the existing CoursePlayer behaviour. Lessons/questions come from GET /my/learning/{id} (scoped to
// the account, questions without answer keys); completion and grading happen only on the server.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, type User } from "./api";
import { AppFrame } from "./app-frame";
import { articleSections } from "./knowledge-detail-model";
import {
  day,
  labelOf,
  progress,
  quizGate,
  score,
  submission,
  type Attempt,
  type CourseDetail as Course,
  type LearningItem,
} from "./learning-model";
import styles from "./course-detail.module.css";

const expired = "/login?reason=session-expired";

function Glyph({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
const glyphs = {
  back: "M20 12H4m6-6-6 6 6 6",
  course: "m2 8 10-5 10 5-10 5ZM6 10v7q6 5 12 0v-7M22 8v9",
  check: "m5 12 4 4L19 6",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  quiz: "M9 3h6v3H9ZM8 4H5v18h14V4h-3M8 12h8M8 16h5",
};

export function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [course, setCourse] = useState<Course | null>(null),
    [item, setItem] = useState<LearningItem | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<{
      missing: boolean;
      message: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [problem, setProblem] = useState(""),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [revision, setRevision] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) return router.replace("/account");
        const [detail, list] = await Promise.all([
          api<Course>(`/my/learning/${encodeURIComponent(id)}`),
          api<LearningItem[]>("/my/learning").catch(() => [] as LearningItem[]),
        ]);
        if (!active) return;
        setCourse(detail);
        setItem(list.find((i) => i.id === id) || null);
      } catch (e) {
        if (!active) return;
        setCourse(null);
        if (e instanceof ApiError && e.status === 401)
          return router.replace(expired);
        const status = e instanceof ApiError ? e.status : 0;
        setLoadError({
          missing: status === 404 || status === 422,
          message:
            status === 404 || status === 422
              ? "Khóa học không tồn tại, chưa được duyệt hoặc không được giao cho bạn."
              : e instanceof Error && status
                ? e.message
                : "Mất kết nối tới máy chủ. Vui lòng thử lại.",
        });
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id, router, revision]);

  /** POST with a re-entry lock; messages only after the server answers. */
  async function act(
    path: string,
    body: unknown,
    done: (r: Attempt & { message?: string }) => string,
  ) {
    if (lock.current || !user) return;
    lock.current = true;
    setBusy(true);
    setProblem("");
    setNotice("");
    try {
      const r = await api<Attempt & { message?: string }>(
        path,
        { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) },
        user.csrf_token,
      );
      setNotice(done(r));
      setRevision((n) => n + 1);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        return router.replace(expired);
      setProblem(
        e instanceof ApiError
          ? e.message
          : "Mất kết nối tới máy chủ. Thao tác chưa được ghi nhận, vui lòng thử lại.",
      );
      if (e instanceof ApiError && e.status === 409) setRevision((n) => n + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const gate = course ? quizGate(course) : null;
  const p = course
    ? progress({
        completed_lessons: course.lessons.filter((l) => l.completed).length,
        total_lessons: course.lessons.length,
      })
    : null;
  const submitted = course?.attempts.filter((a) => a.submitted_at) || [];
  const payload = course ? submission(course, answers) : null;

  return (
    <AppFrame
      user={user}
      path="/learning"
      title="Học khóa học"
      onSearch={(e) => {
        e.preventDefault();
        router.push(
          `/knowledge?q=${encodeURIComponent(new FormData(e.currentTarget).get("q")?.toString() || "")}`,
        );
      }}
    >
      <main id="main" className={styles.main}>
        <nav className={styles.crumbs} aria-label="Đường dẫn">
          <Link href="/learning">
            <Glyph d={glyphs.back} />
            Khóa học của tôi
          </Link>
          {course && <span>{course.title}</span>}
        </nav>

        {loading && !course ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải khóa học"
          >
            <div />
            <div />
            Đang tải khóa học…
          </div>
        ) : loadError ? (
          <section className={styles.state} role="alert">
            <Glyph d={loadError.missing ? glyphs.lock : glyphs.alert} />
            <h1>
              {loadError.missing
                ? "Không tìm thấy khóa học"
                : "Không thể tải khóa học"}
            </h1>
            <p>{loadError.message}</p>
            <div>
              {!loadError.missing && (
                <button type="button" onClick={() => setRevision((n) => n + 1)}>
                  Thử lại
                </button>
              )}
              <Link href="/learning">Về Khóa học của tôi</Link>
            </div>
          </section>
        ) : course ? (
          <div className={styles.layout}>
            <div className={styles.column}>
              <header className={`${styles.card} ${styles.head}`}>
                <div className={styles.top}>
                  <span className={styles.icon}>
                    <Glyph d={glyphs.course} />
                  </span>
                  <div className={styles.headText}>
                    <h1>{course.title}</h1>
                    <div className={styles.chips}>
                      {item && (
                        <span
                          className={`${styles.chip} ${styles[item.status] || ""}`}
                        >
                          {labelOf(item.status)}
                        </span>
                      )}
                      <span className={styles.chipVersion}>
                        Phiên bản v{course.version_number}
                      </span>
                    </div>
                  </div>
                </div>
                <dl className={styles.meta}>
                  {item?.due_at && (
                    <div>
                      <dt>Hạn hoàn thành</dt>
                      <dd
                        className={item.status === "OVERDUE" ? styles.late : ""}
                      >
                        {day(item.due_at)}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Điểm đạt</dt>
                    <dd>
                      {course.pass_score === null
                        ? "Chưa cấu hình"
                        : `${score(course.pass_score)}/100`}
                    </dd>
                  </div>
                  <div>
                    <dt>Lần làm bài</dt>
                    <dd>
                      {submitted.length}/{course.max_attempts} đã nộp
                    </dd>
                  </div>
                  <div>
                    <dt>Bài học</dt>
                    <dd>
                      {p
                        ? `${p.done}/${p.total} hoàn thành`
                        : "Chưa có bài học"}
                    </dd>
                  </div>
                </dl>
                {p && (
                  <div
                    className={styles.bar}
                    role="progressbar"
                    aria-label="Tiến độ bài học"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={p.percent}
                  >
                    <span style={{ width: `${p.percent}%` }} />
                  </div>
                )}
                {course.completed_at && (
                  <p className={styles.completed}>
                    <Glyph d={glyphs.check} />
                    Đã hoàn thành khóa học này · {day(course.completed_at)}
                  </p>
                )}
              </header>

              {(notice || problem) && (
                <div className={styles.messages}>
                  {problem && (
                    <p className={styles.error} role="alert">
                      {problem}
                    </p>
                  )}
                  {notice && (
                    <p className={styles.notice} role="status">
                      {notice}
                    </p>
                  )}
                </div>
              )}

              <section
                aria-labelledby="lessons-title"
                className={styles.lessons}
              >
                <h2 id="lessons-title" className={styles.sectionTitle}>
                  Bài học ({course.lessons.length})
                </h2>
                {course.lessons.map((lesson, i) => (
                  <article
                    key={lesson.id}
                    className={`${styles.card} ${styles.lesson}`}
                    data-done={lesson.completed}
                    aria-labelledby={`lesson-${lesson.id}`}
                  >
                    <h3 id={`lesson-${lesson.id}`}>
                      <span className={styles.num}>
                        {lesson.completed ? <Glyph d={glyphs.check} /> : i + 1}
                      </span>
                      {lesson.title}
                    </h3>
                    {articleSections(lesson.body).map((s, j) => (
                      <div key={j} className={styles.lessonBody}>
                        {s.title !== "Nội dung" && <h4>{s.title}</h4>}
                        {s.blocks.map((b, k) =>
                          b.type === "p" ? (
                            <p key={k}>{b.text}</p>
                          ) : b.type === "ul" ? (
                            <ul key={k}>
                              {b.items.map((t, x) => (
                                <li key={x}>{t}</li>
                              ))}
                            </ul>
                          ) : b.type === "ol" ? (
                            <ol key={k}>
                              {b.items.map((t, x) => (
                                <li key={x}>{t}</li>
                              ))}
                            </ol>
                          ) : null,
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className={
                        lesson.completed ? styles.doneButton : styles.secondary
                      }
                      disabled={busy || lesson.completed}
                      onClick={() =>
                        act(
                          `/my/learning/${id}/lessons/${lesson.id}/complete`,
                          null,
                          (r) => r.message || "Đã ghi nhận hoàn thành bài học.",
                        )
                      }
                    >
                      {lesson.completed
                        ? "Đã hoàn thành bài học"
                        : "Tôi đã hoàn thành bài học này"}
                    </button>
                  </article>
                ))}
              </section>

              <section
                className={`${styles.card} ${styles.quiz}`}
                aria-labelledby="quiz-title"
              >
                <h2 id="quiz-title">
                  <Glyph d={glyphs.quiz} />
                  Kiểm tra cuối khóa
                </h2>
                {gate!.pending ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (payload)
                        void act(
                          `/quiz-attempts/${gate!.pending!.id}/submit`,
                          payload,
                          (r) => {
                            setAnswers({});
                            return `Đã nộp bài: ${score(r.score)}/100 · ${r.passed ? "Đạt" : "Chưa đạt"} (lần ${r.attempt_no}). Điểm do hệ thống chấm.`;
                          },
                        );
                    }}
                  >
                    <p className={styles.hint}>
                      Lần {gate!.pending.attempt_no}/{course.max_attempts} ·
                      Chọn một đáp án cho mỗi câu. Điểm được hệ thống tính khi
                      nộp bài.
                    </p>
                    {course.questions.map((q, i) => (
                      <fieldset
                        key={q.id}
                        disabled={busy}
                        className={styles.question}
                      >
                        <legend>
                          {i + 1}. {q.question}
                        </legend>
                        {q.options.map((o) => (
                          <label
                            key={o.id}
                            className={styles.option}
                            data-checked={answers[q.id] === o.id}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={o.id}
                              checked={answers[q.id] === o.id}
                              required
                              onChange={() =>
                                setAnswers((a) => ({ ...a, [q.id]: o.id }))
                              }
                            />
                            {o.answer_text}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                    <button
                      className={styles.primary}
                      disabled={busy || !payload}
                    >
                      {busy ? "Đang nộp bài…" : "Nộp bài kiểm tra"}
                    </button>
                  </form>
                ) : (
                  <>
                    {gate!.blocked ? (
                      <p className={styles.hint}>{gate!.blocked}</p>
                    ) : (
                      <p className={styles.hint}>
                        {course.questions.length} câu hỏi · Điểm đạt{" "}
                        {score(course.pass_score)}/100 · Còn{" "}
                        {course.max_attempts - gate!.used} lần làm bài.
                      </p>
                    )}
                    {course.questions.length > 0 &&
                      !gate!.passed &&
                      !course.completed_at && (
                        <button
                          type="button"
                          className={styles.primary}
                          disabled={busy || !!gate!.blocked}
                          onClick={() =>
                            act(
                              `/my/learning/${id}/quiz-attempts`,
                              null,
                              () =>
                                "Đã mở lần làm bài. Chọn đáp án và nộp bài.",
                            )
                          }
                        >
                          {gate!.used >= course.max_attempts
                            ? "Đã hết số lần làm bài"
                            : "Bắt đầu kiểm tra"}
                        </button>
                      )}
                  </>
                )}
              </section>
            </div>

            <aside className={styles.side} aria-label="Kết quả kiểm tra">
              <section className={styles.card} aria-labelledby="history-title">
                <h2 id="history-title">
                  Lịch sử làm bài · v{course.version_number}
                </h2>
                {submitted.length ? (
                  <div className={styles.tableWrap}>
                    <table aria-label="Lịch sử làm bài">
                      <thead>
                        <tr>
                          <th scope="col">Lần</th>
                          <th scope="col">Điểm</th>
                          <th scope="col">Ngưỡng</th>
                          <th scope="col">Kết quả</th>
                          <th scope="col">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submitted.map((a) => (
                          <tr key={a.id}>
                            <td>{a.attempt_no}</td>
                            <td>
                              <b>{score(a.score)}</b>/100
                            </td>
                            <td>{score(a.pass_score_snapshot)}</td>
                            <td
                              className={a.passed ? styles.pass : styles.fail}
                            >
                              {a.passed ? "Đạt" : "Chưa đạt"}
                            </td>
                            <td>
                              {new Date(a.submitted_at!).toLocaleString(
                                "vi-VN",
                                {
                                  timeZone: "Asia/Ho_Chi_Minh",
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={styles.muted}>Chưa có lần nộp bài.</p>
                )}
                <p className={styles.muted}>
                  Điểm và kết quả do máy chủ chấm theo đáp án được bảo vệ; không
                  sửa được từ giao diện.
                </p>
              </section>
            </aside>
          </div>
        ) : null}
      </main>
    </AppFrame>
  );
}
