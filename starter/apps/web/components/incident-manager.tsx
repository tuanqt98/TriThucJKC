"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "./api";
import { useManagement } from "./use-management";
type Solution = {
  proposed_by: string;
  id: string;
  cause_hypothesis: string;
  steps: string[];
  outcome: string;
  status: string;
  revision: number;
  verified_cause: string | null;
};
type Incident = {
  id: string;
  title: string;
  process_id: string;
  severity: string;
  symptoms: string;
  conditions: Record<string, unknown>;
  revision: number;
  can_edit: boolean;
  can_verify: boolean;
  solutions: Solution[];
  occurrences: {
    id: string;
    note: string;
    outcome: string;
    occurred_at: string;
  }[];
};
export function IncidentManager() {
  const m = useManagement<Incident>("/workspace/incidents");
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [processError, setProcessError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const item = m.rows.find((r) => r.id === selected);
  useEffect(() => {
    api<{ id: string; name: string }[]>("/processes")
      .then(setProcesses)
      .catch((e) => setProcessError(e.message));
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>, edit?: Incident) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await m.mutate(
      "/workspace/incidents",
      {
        ...(edit ? { incident_id: edit.id, revision: edit.revision } : {}),
        title: f.get("title"),
        process_id: f.get("process"),
        severity: f.get("severity"),
        symptoms: f.get("symptoms"),
        conditions: { text: f.get("conditions") },
      },
      edit ? "PUT" : "POST",
    );
  }
  function fields(edit?: Incident) {
    return (
      <>
        <label>
          Tiêu đề sự cố
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={edit?.title}
          />
        </label>
        <label>
          Công đoạn
          <select name="process" required defaultValue={edit?.process_id}>
            <option value="">Chọn công đoạn</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mức độ
          <select name="severity" defaultValue={edit?.severity || "LOW"}>
            <option value="LOW">Thấp</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="HIGH">Cao</option>
            <option value="CRITICAL">Nghiêm trọng</option>
          </select>
        </label>
        <label>
          Hiện tượng
          <textarea
            name="symptoms"
            required
            rows={3}
            defaultValue={edit?.symptoms}
          />
        </label>
        <label>
          Điều kiện phát sinh
          <textarea
            name="conditions"
            required
            rows={3}
            defaultValue={
              edit
                ? String(
                    edit.conditions.text || JSON.stringify(edit.conditions),
                  )
                : ""
            }
          />
        </label>
      </>
    );
  }
  return (
    <main className="authoring-page">
      <nav>
        <Link href="/">← Dashboard</Link>
        <Link href="/incidents">Hướng dẫn đã duyệt</Link>
        <Link href="/workspace">Biên soạn</Link>
        <Link href="/learning/manage">Quản lý đào tạo</Link>
      </nav>
      <h1>Hồ sơ sự cố và tái diễn</h1>
      <p className="subtle">
        Dữ liệu DEMO. Phương án đề xuất cần người có thẩm quyền xác minh, chưa
        phải quy trình vận hành chính thức.
      </p>
      {m.loading && <p aria-busy="true">Đang tải…</p>}
      {(m.error || processError) && (
        <p role="alert" className="error">
          {m.error || processError}
        </p>
      )}
      {m.notice && (
        <p role="status" className="notice">
          {m.notice}
        </p>
      )}
      <section className="panel">
        <h2>Ghi nhận sự cố</h2>
        <form onSubmit={(e) => save(e)}>
          {fields()}
          <button className="button" disabled={m.busy}>
            Lưu hồ sơ sự cố
          </button>
        </form>
      </section>
      <label>
        Tìm hồ sơ
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tiêu đề / hiện tượng"
        />
      </label>
      <div className="authoring-grid">
        <section className="panel">
          <h2>Hồ sơ trong phạm vi</h2>
          {!m.rows.length && !m.loading && <p>Chưa có hồ sơ được quyền xem.</p>}
          {m.rows
            .filter((i) =>
              (i.title + " " + i.symptoms)
                .toLocaleLowerCase("vi")
                .includes(query.toLocaleLowerCase("vi")),
            )
            .map((i) => (
              <button
                key={i.id}
                className="version-choice"
                onClick={() => setSelected(i.id)}
                aria-pressed={i.id === selected}
              >
                <strong>{i.title}</strong>
                <span>
                  {i.solutions.some((s) => s.status === "VERIFIED")
                    ? "Có phương án đã xác minh"
                    : "Chưa xác minh"}{" "}
                  · {i.occurrences.length} lần tái diễn
                </span>
              </button>
            ))}
        </section>
        {item && (
          <section className="panel" key={item.id + ":" + item.revision}>
            <h2>{item.title}</h2>
            <p>{item.symptoms}</p>
            <p>
              Điều kiện:{" "}
              {String(item.conditions.text || JSON.stringify(item.conditions))}
            </p>
            {item.can_edit &&
              !item.solutions.some((s) => s.status === "VERIFIED") && (
                <details>
                  <summary>Sửa hồ sơ</summary>
                  <form onSubmit={(e) => save(e, item)}>
                    {fields(item)}
                    <button disabled={m.busy} className="button">
                      Lưu chỉnh sửa hồ sơ
                    </button>
                  </form>
                </details>
              )}
            <h3>Nguyên nhân, phương án và kết quả</h3>
            {!item.solutions.length && <p>Chưa có phương án.</p>}
            {item.solutions.map((s) => (
              <article className="version-choice" key={s.id}>
                <strong>
                  {s.status === "VERIFIED"
                    ? "Đã xác minh"
                    : "Đề xuất — chưa xác minh"}
                </strong>
                <p>Nguyên nhân giả thuyết: {s.cause_hypothesis}</p>
                <ol>
                  {s.steps.map((step, k) => (
                    <li key={k}>{step}</li>
                  ))}
                </ol>
                <p>Kết quả: {s.outcome}</p>
                {s.verified_cause && (
                  <p>Nguyên nhân đã xác minh: {s.verified_cause}</p>
                )}
                {item.can_verify &&
                  s.proposed_by !== m.user?.id &&
                  s.status === "PROPOSED" && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await m.mutate("/workspace/incidents/verify", {
                          incident_id: item.id,
                          solution_id: s.id,
                          incident_revision: item.revision,
                          revision: s.revision,
                          verified_cause: f.get("verified_cause"),
                        });
                      }}
                    >
                      <label>
                        Kết luận xác minh
                        <textarea name="verified_cause" required />
                      </label>
                      <button className="button" disabled={m.busy}>
                        Xác minh phương án
                      </button>
                    </form>
                  )}
              </article>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await m.mutate("/workspace/incidents/solutions", {
                  incident_id: item.id,
                  cause: f.get("cause"),
                  steps: String(f.get("steps"))
                    .split("\n")
                    .filter((s) => s.trim()),
                  outcome: f.get("outcome"),
                });
              }}
            >
              <h3>Đề xuất phương án</h3>
              <label>
                Nguyên nhân giả thuyết
                <textarea name="cause" required />
              </label>
              <label>
                Các bước đề xuất (mỗi dòng một bước)
                <textarea name="steps" required />
              </label>
              <label>
                Kết quả thực hiện
                <textarea name="outcome" required />
              </label>
              <button disabled={m.busy} className="button">
                Lưu phương án đề xuất
              </button>
            </form>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const form = e.currentTarget;
                const key = form.dataset.requestKey || crypto.randomUUID();
                form.dataset.requestKey = key;
                const result = await m.mutate(
                  "/workspace/incidents/occurrences",
                  {
                    incident_id: item.id,
                    request_key: key,
                    note: f.get("note"),
                    outcome: f.get("outcome"),
                  },
                );
                if (result) {
                  form.dataset.requestKey = "";
                  form.reset();
                }
              }}
            >
              <h3>Tôi cũng gặp lỗi này</h3>
              <label>
                Ghi nhận tái diễn
                <textarea name="note" required />
              </label>
              <label>
                Kết quả khi tái diễn
                <textarea name="outcome" />
              </label>
              <button className="button" disabled={m.busy}>
                Ghi nhận tái diễn
              </button>
            </form>
            {item.occurrences.map((o) => (
              <article key={o.id} className="version-choice">
                <span>{new Date(o.occurred_at).toLocaleString("vi-VN")}</span>
                <p>{o.note}</p>
                <p>{o.outcome}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
