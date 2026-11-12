"use client";
import { useEffect, useState } from "react";
import { api, type User } from "./api";
type Person = {
  id: string;
  full_name: string;
  department_id: string;
  department_name: string;
};
type Task = {
  id: string;
  full_name: string;
  title: string;
  version_number: number;
  due_at: string | null;
  acknowledged_at: string | null;
  is_current: boolean;
  status: string;
};
type Document = {
  id: string;
  title: string;
  version_id: string;
  version_number: number;
};
const labels: Record<string, string> = {
  READ: "Đã đọc",
  UNREAD: "Chưa đọc",
  OVERDUE: "Quá hạn",
};
export function ReadingManager({ user }: { user: User }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Person[]>("/workspace/people"),
      api<{ items: Document[] }>("/documents?pageSize=100"),
      api<Task[]>("/workspace/reading"),
    ])
      .then(([p, d, t]) => {
        if (active) {
          setPeople(p);
          setDocuments(d.items);
          setTasks(t);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const departments = [
    ...new Map(
      people.map((p) => [p.department_id, p.department_name]),
    ).entries(),
  ];
  return (
    <section className="panel">
      <h2>Giao và theo dõi đọc nội quy</h2>
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
      {!people.length ? (
        <p>Chưa có phạm vi giao đọc được cấp cho tài khoản này.</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setNotice("");
            const f = new FormData(e.currentTarget);
            const doc = documents.find((d) => d.id === f.get("document"));
            const target = String(f.get("target"));
            if (!doc) {
              setBusy(false);
              return;
            }
            try {
              await api(
                "/workspace/reading",
                {
                  method: "POST",
                  body: JSON.stringify({
                    content_id: doc.id,
                    version_id: doc.version_id,
                    ...(target.startsWith("dept:")
                      ? { department_id: target.slice(5) }
                      : { user_id: target }),
                    due_at: f.get("due")
                      ? new Date(String(f.get("due"))).toISOString()
                      : null,
                  }),
                },
                user.csrf_token,
              );
              setNotice("Đã giao đọc đúng phiên bản, giữ nguyên lịch sử cũ.");
              setRevision((n) => n + 1);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nội quy đã ban hành
            <select name="document" required>
              <option value="">Chọn nội quy</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} · v{d.version_number}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nhân viên hoặc bộ phận
            <select name="target" required>
              <option value="">Chọn người nhận</option>
              <optgroup label="Bộ phận">
                {departments.map(([id, name]) => (
                  <option key={id} value={`dept:${id}`}>
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
            Hạn đọc
            <input name="due" type="datetime-local" />
          </label>
          <button className="button" disabled={busy}>
            Giao đọc bắt buộc
          </button>
        </form>
      )}
      <label>
        Lọc tiến độ đọc
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!tasks.filter((t) => !filter || t.status === filter).length && (
        <p>Chưa có nhiệm vụ trong bộ lọc này.</p>
      )}
      {tasks
        .filter((t) => !filter || t.status === filter)
        .map((t) => (
          <article key={t.id} className="version-choice">
            <strong>
              {t.full_name} — {t.title} · v{t.version_number}
            </strong>
            <span>
              {labels[t.status]} ·{" "}
              {t.is_current ? "Bản hiện hành" : "Bản cũ, giữ lịch sử"} · Hạn{" "}
              {t.due_at
                ? new Date(t.due_at).toLocaleString("vi-VN")
                : "không đặt"}
            </span>
            {t.acknowledged_at && (
              <span>
                Xác nhận: {new Date(t.acknowledged_at).toLocaleString("vi-VN")}
              </span>
            )}
          </article>
        ))}
    </section>
  );
}
