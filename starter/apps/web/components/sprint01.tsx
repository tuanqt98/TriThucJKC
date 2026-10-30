"use client";
import { useEffect, useState } from "react";
import { api, type User } from "./api";

type Attachment = {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  malware_scan_status: string;
};
type Reading = {
  id: string;
  content_id: string;
  title: string;
  version_id: string;
  version_number: number;
  acknowledged_at: string | null;
  is_current: boolean;
};
type Attempt = {
  id: string;
  attempt_no: number;
  score: string | null;
  passed: boolean | null;
  submitted_at: string | null;
  pass_score_snapshot: string | null;
};
type Lesson = {
  id: string;
  title: string;
  body: Record<string, string>;
  completed: boolean;
};
type Question = {
  id: string;
  question: string;
  options: { id: string; answer_text: string }[];
};
type Course = {
  id: string;
  title: string;
  course_version_id: string;
  version_number: number;
  pass_score: string | null;
  max_attempts: number;
  completed_at: string | null;
  lessons: Lesson[];
  questions: Question[];
  attempts: Attempt[];
};

export function AttachmentsPanel({
  user,
  versionId,
  canUpload = false,
}: {
  user: User;
  versionId: string;
  canUpload?: boolean;
}) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<Attachment[]>(`/content-versions/${versionId}/attachments`)
      .then((data) => {
        if (active) setFiles(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [versionId, revision]);
  async function upload() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.set("file", selected);
    try {
      await api(
        `/content-versions/${versionId}/attachments`,
        { method: "POST", body },
        user.csrf_token,
      );
      setSelected(null);
      setRevision((n) => n + 1);
      setNotice("Đã kiểm tra và quét mã độc. Tệp được lưu riêng tư.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-panel" onChange={(e) => e.stopPropagation()}>
      <h3>Tệp đính kèm</h3>
      <p className="subtle">
        Chỉ người được quyền xem phiên bản này mới được tải tệp đã quét an toàn.
      </p>
      {files.length ? (
        <ul className="attachment-list">
          {files.map((file) => (
            <li key={file.id}>
              <div>
                <b>{file.filename}</b>
                <small>
                  {Math.ceil(file.byte_size / 1024)} KB ·{" "}
                  {file.malware_scan_status === "CLEAN"
                    ? "Đã quét an toàn"
                    : "Chưa sẵn sàng"}
                </small>
              </div>
              {file.malware_scan_status === "CLEAN" && (
                <a
                  className="secondary table-action"
                  href={`/api/v1/attachments/${file.id}/download`}
                >
                  Tải xuống
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="subtle">Chưa có tệp đính kèm.</p>
      )}
      {canUpload && (
        <div className="upload-box">
          <label>
            Chọn ảnh hoặc PDF minh họa
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              disabled={busy}
              onChange={(e) => setSelected(e.target.files?.[0] || null)}
            />
          </label>
          <p className="subtle">
            Tối đa 10 MB; PNG, JPEG, PDF tĩnh. Không nhận PDF mã hóa hay nội
            dung chủ động.
          </p>
          <button
            type="button"
            className="secondary"
            disabled={!selected || busy}
            onClick={upload}
          >
            {busy ? "Đang kiểm tra và quét tệp…" : "Tải lên và quét mã độc"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </section>
  );
}

export function ReadingPanel({
  user,
  contentId,
  versionId,
}: {
  user: User;
  contentId: string;
  versionId: string;
}) {
  const [tasks, setTasks] = useState<Reading[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    api<Reading[]>("/my/reading")
      .then((data) => {
        if (active) setTasks(data.filter((t) => t.content_id === contentId));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [contentId, revision]);
  const current = tasks.find((t) => t.version_id === versionId && t.is_current);
  async function acknowledge() {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>(
        `/reading-assignments/${current.id}/acknowledge`,
        { method: "POST", body: JSON.stringify({ version_id: versionId }) },
        user.csrf_token,
      );
      setNotice(result.message);
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-panel">
      <h3>Xác nhận đã đọc</h3>
      {current ? (
        <>
          <p>Phiên bản được giao: v{current.version_number}</p>
          {current.acknowledged_at ? (
            <p className="badge success">
              Đã xác nhận ·{" "}
              {new Date(current.acknowledged_at).toLocaleString("vi-VN")}
            </p>
          ) : (
            <button className="button" disabled={busy} onClick={acknowledge}>
              {busy ? "Đang ghi nhận…" : "Tôi đã đọc phiên bản này"}
            </button>
          )}
        </>
      ) : (
        <p className="subtle">
          Bạn chưa được giao xác nhận phiên bản hiện hành này.
        </p>
      )}
      {tasks
        .filter((t) => t.acknowledged_at && t.version_id !== versionId)
        .map((t) => (
          <p className="subtle" key={t.id}>
            Lịch sử: đã xác nhận v{t.version_number} ·{" "}
            {new Date(t.acknowledged_at!).toLocaleDateString("vi-VN")}
          </p>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}

export function CoursePlayer({
  user,
  assignmentId,
}: {
  user: User;
  assignmentId: string;
}) {
  const [course, setCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    api<Course>(`/my/learning/${assignmentId}`)
      .then((data) => {
        if (active) setCourse(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assignmentId, revision]);
  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Attempt & { message?: string }>(
        path,
        { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) },
        user.csrf_token,
      );
      setNotice(
        result.message ||
          (result.submitted_at
            ? `Đã nộp bài: ${result.score}/100 · ${result.passed ? "Đạt" : "Chưa đạt"}`
            : "Đã mở lần làm bài. Chọn đáp án và nộp bài."),
      );
      if (result.submitted_at) setAnswers({});
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = course?.attempts.find((a) => !a.submitted_at);
  const allLessons = course?.lessons.every((l) => l.completed);
  const used = course?.attempts.length || 0;
  return (
    <div className="course-player">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải khóa học…</p>
      ) : (
        course && (
          <>
            <section className="panel">
              <span className="badge">
                DEMO · Phiên bản {course.version_number}
              </span>
              <h2>{course.title}</h2>
              <p className="subtle">
                Điểm đạt: {course.pass_score ?? "Chưa cấu hình"} · Tối đa{" "}
                {course.max_attempts} lần · Đã dùng {used} lần
              </p>
              {course.completed_at && (
                <p className="badge success">Đã hoàn thành khóa học này</p>
              )}
            </section>
            {course.lessons.map((lesson, i) => (
              <section className="panel" key={lesson.id}>
                <h2>
                  {i + 1}. {lesson.title}
                </h2>
                {Object.entries(lesson.body).map(([k, v]) => (
                  <div key={k}>
                    <h3>{k}</h3>
                    <p className="lesson-text">{v}</p>
                  </div>
                ))}
                <button
                  className="secondary"
                  disabled={busy || lesson.completed}
                  onClick={() =>
                    act(
                      `/my/learning/${assignmentId}/lessons/${lesson.id}/complete`,
                    )
                  }
                >
                  {lesson.completed
                    ? "Đã hoàn thành bài học"
                    : "Tôi đã hoàn thành bài học này"}
                </button>
              </section>
            ))}
            <section className="panel quiz-panel">
              <h2>Kiểm tra cuối khóa</h2>
              {!course.questions.length ? (
                <p className="subtle">
                  Phiên bản khóa học này chưa có bài kiểm tra.
                </p>
              ) : (
                <>
                  {!allLessons && (
                    <p className="notice">
                      Hoàn thành các bài học trước khi bắt đầu kiểm tra.
                    </p>
                  )}
                  {!pending && (
                    <button
                      className="button"
                      disabled={
                        busy ||
                        !allLessons ||
                        used >= course.max_attempts ||
                        !course.pass_score
                      }
                      onClick={() =>
                        act(`/my/learning/${assignmentId}/quiz-attempts`)
                      }
                    >
                      {used >= course.max_attempts
                        ? "Đã hết số lần làm bài"
                        : "Bắt đầu kiểm tra"}
                    </button>
                  )}
                  {pending && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act(`/quiz-attempts/${pending.id}/submit`, {
                          answers: course.questions.map((q) => ({
                            question_id: q.id,
                            option_id: answers[q.id],
                          })),
                        });
                      }}
                    >
                      <p className="badge">
                        Lần {pending.attempt_no} · Điểm được tính bởi hệ thống
                        khi nộp bài
                      </p>
                      {course.questions.map((q, i) => (
                        <fieldset key={q.id} disabled={busy}>
                          <legend>
                            {i + 1}. {q.question}
                          </legend>
                          {q.options.map((option) => (
                            <label className="quiz-option" key={option.id}>
                              <input
                                type="radio"
                                name={q.id}
                                value={option.id}
                                checked={answers[q.id] === option.id}
                                required
                                onChange={() =>
                                  setAnswers((a) => ({
                                    ...a,
                                    [q.id]: option.id,
                                  }))
                                }
                              />
                              {option.answer_text}
                            </label>
                          ))}
                        </fieldset>
                      ))}
                      <button
                        className="button"
                        disabled={
                          busy || course.questions.some((q) => !answers[q.id])
                        }
                      >
                        {busy ? "Đang nộp bài…" : "Nộp bài kiểm tra"}
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
            <section className="panel">
              <h2>Lịch sử làm bài · v{course.version_number}</h2>
              {course.attempts.some((a) => a.submitted_at) ? (
                <div className="history-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Lần</th>
                        <th>Điểm</th>
                        <th>Ngưỡng đạt</th>
                        <th>Kết quả</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.attempts
                        .filter((a) => a.submitted_at)
                        .map((a) => (
                          <tr key={a.id}>
                            <td>{a.attempt_no}</td>
                            <td>{a.score}/100</td>
                            <td>{a.pass_score_snapshot}</td>
                            <td>{a.passed ? "Đạt" : "Chưa đạt"}</td>
                            <td>
                              {new Date(a.submitted_at!).toLocaleString(
                                "vi-VN",
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="subtle">Chưa có lần nộp bài.</p>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
