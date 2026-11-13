"use client";
// UI-07 / DATA-33 · Bài viết của tôi (/knowledge/mine). Lists the author's own articles from
// GET /workspace/contents (no new API, no permission change) and offers only status-valid actions.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type User } from "./api";
import { AppFrame } from "./app-frame";
import {
  actionsFor,
  counts,
  filterMine,
  groupMine,
  readMineState,
  STATUSES,
  statusLabel,
  writeMineState,
  type MineRow,
  type MineStatus,
  type WorkspaceItem,
} from "./knowledge-mine-model";
import styles from "./knowledge-mine.module.css";

type Process = { id: string; name: string };
const TZ = "Asia/Ho_Chi_Minh";
const day = (v: string) =>
  new Date(v).toLocaleDateString("vi-VN", { timeZone: TZ });

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
  doc: "M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
};

export function KnowledgeMine() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState(() => readMineState(params));
  const [user, setUser] = useState<User | null>(null),
    [rows, setRows] = useState<MineRow[] | null>(null),
    [processes, setProcesses] = useState<Process[]>([]),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setError("");
      setRows(null);
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) return router.replace("/account");
        const [items, list] = await Promise.all([
          api<WorkspaceItem[]>("/workspace/contents"),
          api<Process[]>("/processes").catch(() => []),
        ]);
        if (!active) return;
        setProcesses(list);
        setRows(groupMine(items, me.id));
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401)
          return router.replace("/login");
        setError(
          e instanceof ApiError
            ? e.message
            : "Mất kết nối tới máy chủ. Vui lòng thử lại.",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [router, revision]);

  // Filter state lives in the URL (shareable, Back-safe), like the UI-05 library.
  useEffect(() => {
    const qs = writeMineState(state);
    const next = `/knowledge/mine${qs ? `?${qs}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== next)
      window.history.replaceState(window.history.state, "", next);
  }, [state]);

  const all = rows || [];
  const c = counts(all);
  const result = filterMine(all, state);
  const processName = (id: string | null) =>
    processes.find((p) => p.id === id)?.name;
  const set = (patch: Partial<typeof state>) =>
    setState((s) => ({ ...s, page: 1, ...patch }));

  return (
    <AppFrame
      user={user}
      path="/knowledge"
      title="Bài viết của tôi"
      onSearch={(e) => {
        e.preventDefault();
        router.push(
          `/knowledge?q=${encodeURIComponent(new FormData(e.currentTarget).get("q")?.toString() || "")}`,
        );
      }}
    >
      <main id="main" className={styles.main}>
        <header className={styles.head}>
          <span className={styles.icon}>
            <Glyph d={glyphs.doc} />
          </span>
          <div>
            <h1>Bài viết của tôi</h1>
            <p>
              Bài chia sẻ bạn đã soạn: bản nháp, đang chờ duyệt, cần chỉnh sửa,
              bị từ chối và đã duyệt.
            </p>
          </div>
          {user?.department_id && (
            <Link className={styles.create} href="/knowledge/new">
              <Glyph d={glyphs.plus} />
              Tạo bài mới
            </Link>
          )}
        </header>

        <div className={styles.toolbar}>
          <div
            className={styles.chips}
            role="group"
            aria-label="Lọc theo trạng thái"
          >
            {(["", ...STATUSES] as ("" | MineStatus)[]).map((s) => (
              <button
                key={s || "all"}
                type="button"
                aria-pressed={state.status === s}
                onClick={() => set({ status: s })}
              >
                {s ? statusLabel[s] : "Tất cả"}
                <span>{s ? c[s] : all.length}</span>
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <Glyph d={glyphs.search} />
            <input
              type="search"
              value={state.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Tìm theo tiêu đề"
              aria-label="Tìm bài viết của tôi theo tiêu đề"
            />
          </label>
        </div>

        {error ? (
          <section className={styles.state} role="alert">
            <Glyph d={glyphs.alert} />
            <h2>Không tải được bài viết của bạn</h2>
            <p>{error}</p>
            <button type="button" onClick={() => setRevision((n) => n + 1)}>
              Thử lại
            </button>
          </section>
        ) : rows === null ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải bài viết của tôi"
          >
            <div />
            <div />
            <div />
            Đang tải…
          </div>
        ) : !all.length ? (
          <section className={styles.state}>
            <h2>Bạn chưa có bài viết nào</h2>
            <p>Bài bạn lưu nháp hoặc gửi duyệt sẽ hiện ở đây.</p>
            {user?.department_id && (
              <Link href="/knowledge/new">Tạo bài chia sẻ đầu tiên</Link>
            )}
          </section>
        ) : (
          <>
            <p className={styles.count} role="status">
              {result.total} bài
              {state.status ? ` · ${statusLabel[state.status]}` : ""}
              {state.q.trim() ? ` · khớp “${state.q.trim()}”` : ""}
            </p>
            {result.total ? (
              <ul
                className={styles.list}
                aria-label="Danh sách bài viết của tôi"
              >
                {result.items.map((r) => (
                  <li key={r.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <h2>{r.title}</h2>
                      <span className={`${styles.status} ${styles[r.status]}`}>
                        {statusLabel[r.status]}
                      </span>
                    </div>
                    <p className={styles.meta}>
                      {[
                        `Phiên bản v${r.versionNumber}`,
                        `Tạo phiên bản ${day(r.createdAt)}`,
                        processName(r.processId) || "Chưa chọn công đoạn",
                      ].join(" · ")}
                    </p>
                    {r.remark &&
                      ["CHANGES_REQUESTED", "REJECTED"].includes(r.status) && (
                        <p className={styles.remark}>
                          <b>Ý kiến người duyệt:</b> {r.remark}
                        </p>
                      )}
                    {r.publishedVersion && (
                      <p className={styles.note}>
                        Bản v{r.publishedVersion} đã duyệt vẫn đang hiển thị
                        trong Kho tri thức.
                      </p>
                    )}
                    <div className={styles.actions}>
                      {actionsFor(r).map((a) => (
                        <Link
                          key={a.label}
                          href={a.href}
                          className={
                            a.primary ? styles.primary : styles.secondary
                          }
                        >
                          {a.label}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <section className={styles.state}>
                <h2>Không có bài phù hợp</h2>
                <p>Thử chọn trạng thái khác hoặc xóa từ khóa.</p>
                <button
                  type="button"
                  onClick={() => set({ status: "", q: "" })}
                >
                  Xóa bộ lọc
                </button>
              </section>
            )}
            {result.pages > 1 && (
              <nav className={styles.pager} aria-label="Phân trang">
                <button
                  type="button"
                  disabled={result.page <= 1}
                  onClick={() =>
                    setState((s) => ({ ...s, page: result.page - 1 }))
                  }
                >
                  Trang trước
                </button>
                <span>
                  Trang {result.page}/{result.pages}
                </span>
                <button
                  type="button"
                  disabled={result.page >= result.pages}
                  onClick={() =>
                    setState((s) => ({ ...s, page: result.page + 1 }))
                  }
                >
                  Trang sau
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </AppFrame>
  );
}
