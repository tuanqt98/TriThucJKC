"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type User } from "./api";
import { AttachmentsPanel } from "./sprint01";
import { ReadingManager } from "./reading-manager";

type Version = {
  id: string;
  title: string;
  kind: string;
  version_id: string;
  version_number: number;
  revision: number;
  status: string;
  body: Record<string, unknown>;
  process_id: string | null;
  can_edit: boolean;
  can_review: boolean;
  remark: string | null;
};
const states: Record<string, string> = {
  DRAFT: "Bản nháp",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã ban hành",
  CHANGES_REQUESTED: "Yêu cầu chỉnh sửa",
  REJECTED: "Từ chối",
};

export function Authoring() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Version | null>(null);
  const [processes, setProcesses] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [process, setProcess] = useState("");
  const [remark, setRemark] = useState("");
  const load = useCallback(async () => {
    const [me, items, stages] = await Promise.all([
      api<User>("/auth/me"),
      api<Version[]>("/workspace/contents"),
      api<{ id: string; name: string }[]>("/processes"),
    ]);
    setUser(me);
    setRows(items);
    setProcesses(stages);
  }, []);
  useEffect(() => {
    Promise.resolve()
      .then(load)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [load, router]);
  function choose(v: Version) {
    setSelected(v);
    setTitle(v.title);
    setText(
      typeof v.body.text === "string"
        ? v.body.text
        : JSON.stringify(v.body, null, 2),
    );
    setProcess(v.process_id || "");
    setRemark("");
    setError("");
    setNotice("");
  }
  async function act(action: string) {
    if (!selected || !user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        content_id: selected.id,
        version_id: selected.version_id,
        revision: selected.revision,
      };
      const result = await api<{ version_id: string }>(
        action === "save"
          ? "/workspace/contents"
          : `/workspace/contents/${action}`,
        {
          method: action === "save" ? "PUT" : "POST",
          body: JSON.stringify(
            action === "save"
              ? {
                  ...payload,
                  title,
                  body: { ...selected.body, text },
                  process_id: process || null,
                }
              : { ...payload, remark },
          ),
        },
        user.csrf_token,
      );
      await load();
      const items = await api<Version[]>("/workspace/contents");
      const updated = items.find((v) => v.version_id === result.version_id);
      if (updated) choose(updated);
      else setSelected(null);
      setNotice(
        "Đã lưu thay đổi và nhật ký. Lịch sử phiên bản cũ được giữ nguyên.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="authoring-page">
      <nav aria-label="Điều hướng">
        <Link href="/">← Dashboard</Link>
        <Link href="/documents">Nội quy</Link>
        <Link href="/knowledge">Kho tri thức</Link>
        <Link href="/incidents/manage">Hồ sơ sự cố</Link>
        <Link href="/learning/manage">Quản lý đào tạo</Link>
      </nav>
      <h1>Biên soạn và phê duyệt</h1>
      <p className="subtle">
        Nội quy do HR ban hành. Bài chuyên môn do trưởng bộ phận đúng phạm vi
        duyệt. Không tự duyệt. Nội dung DEMO cần xác minh trước khi áp dụng.
      </p>
      {loading && (
        <p aria-busy="true" role="status">
          Đang tải…
        </p>
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
      {user && (
        <section className="panel">
          <h2>Tạo tài liệu / bài viết</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                await api(
                  "/workspace/contents",
                  {
                    method: "POST",
                    body: JSON.stringify({
                      kind: f.get("kind"),
                      title: f.get("title"),
                      body: { text: f.get("text") },
                      visibility: f.get("visibility"),
                    }),
                  },
                  user.csrf_token,
                );
                await load();
                setNotice(
                  "Đã tạo bản nháp. Chọn bản nháp để sửa và gửi duyệt.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Loại nội dung
              <select name="kind">
                <option value="DOCUMENT">Nội quy</option>
                <option value="ARTICLE">Bài tri thức</option>
              </select>
            </label>
            <label>
              Phạm vi
              <select name="visibility">
                <option value="DEPARTMENT">Bộ phận của tôi</option>
                <option value="COMPANY">
                  Toàn công ty (chỉ HR được cấp phạm vi)
                </option>
              </select>
            </label>
            <label>
              Tiêu đề
              <input name="title" required maxLength={200} />
            </label>
            <label>
              Nội dung
              <textarea name="text" required rows={4} />
            </label>
            <button className="button" disabled={busy}>
              Tạo bản nháp
            </button>
          </form>
        </section>
      )}
      {user && <ReadingManager user={user} />}
      <div className="authoring-grid">
        <section className="panel">
          <h2>Bản nháp, chờ duyệt và lịch sử</h2>
          {!loading && !rows.length && (
            <p>
              Chưa có tài liệu thuộc quyền biên soạn hoặc phê duyệt của bạn.
            </p>
          )}
          {rows.map((v) => (
            <button
              className="version-choice"
              key={v.version_id}
              onClick={() => choose(v)}
              aria-pressed={selected?.version_id === v.version_id}
            >
              <strong>{v.title}</strong>
              <span>
                {v.kind === "DOCUMENT" ? "Nội quy" : "Tri thức"} · v
                {v.version_number} · {states[v.status] || v.status}
              </span>
            </button>
          ))}
        </section>
        {selected && user && (
          <section className="panel">
            <h2>
              {selected.title} · v{selected.version_number}
            </h2>
            <p>
              {states[selected.status]} · Lần sửa {selected.revision}
            </p>
            {selected.remark && (
              <p className="notice">Phản hồi: {selected.remark}</p>
            )}
            <label>
              Tiêu đề phiên bản
              <input
                value={title}
                maxLength={200}
                disabled={
                  !selected.can_edit || selected.status !== "DRAFT" || busy
                }
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Nội dung phiên bản
              <textarea
                rows={10}
                value={text}
                disabled={
                  !selected.can_edit || selected.status !== "DRAFT" || busy
                }
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label>
              Công đoạn
              <select
                value={process}
                disabled={
                  !selected.can_edit || selected.status !== "DRAFT" || busy
                }
                onChange={(e) => setProcess(e.target.value)}
              >
                <option value="">Chọn công đoạn</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <AttachmentsPanel
              versionId={selected.version_id}
              user={user}
              canUpload={selected.can_edit && selected.status === "DRAFT"}
            />
            {selected.can_edit && selected.status === "DRAFT" && (
              <div className="action-row">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => act("save")}
                >
                  Lưu chỉnh sửa
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => act("submit")}
                >
                  Gửi duyệt bản đã lưu
                </button>
              </div>
            )}
            {selected.can_edit &&
              ["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(
                selected.status,
              ) && (
                <>
                  <p>
                    Bản đã gửi/ban hành giữ nguyên. Phiên bản mới sao chép nội
                    dung; tệp đính kèm cần tải lên riêng cho bản mới.
                  </p>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => act("fork")}
                  >
                    Tạo phiên bản mới để chỉnh sửa
                  </button>
                </>
              )}
            {selected.can_review && selected.status === "PENDING" && (
              <>
                <label>
                  Lý do / phản hồi
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    maxLength={4000}
                  />
                </label>
                <div className="action-row">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => act("approve")}
                  >
                    Phê duyệt và ban hành
                  </button>
                  <button
                    disabled={busy || !remark.trim()}
                    onClick={() => act("request-changes")}
                  >
                    Yêu cầu chỉnh sửa
                  </button>
                  <button
                    disabled={busy || !remark.trim()}
                    onClick={() => act("reject")}
                  >
                    Từ chối
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
