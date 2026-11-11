"use client";
// UI-09 · Phê duyệt nội dung (/approvals), mockup 08.
// Queue and decisions use the versioned workflow API only; the server enforces scope (head for articles, HR for
// documents), forbids self-approval, requires a reason for "request changes"/"reject" and checks the revision.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type User } from "./api";
import { AppFrame } from "./app-frame";
import {
  fileKind,
  formatBytes,
  type AttachmentFile,
} from "./document-detail-model";
import { articleSections } from "./knowledge-detail-model";
import {
  approvedHistory,
  buildQueue,
  decisionLabel,
  departments,
  filterQueue,
  kindLabel,
  REMARK_MAX,
  remarkError,
  resultMessage,
  reviewerRoles,
  type Decision,
  type HistoryRow,
  type Kind,
  type Person,
  type QueueItem,
  type QueueSource,
} from "./approvals-model";
import styles from "./approvals.module.css";

type Process = { id: string; name: string };
const expired = "/login?reason=session-expired";
const TZ = "Asia/Ho_Chi_Minh";
const when = (v: string) =>
  new Date(v).toLocaleString("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
  approvals: "M9 3h6v3H9ZM8 4H5v18h14V4h-3M8 14l3 3 5-7",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  check: "m5 12 4 4L19 6",
  edit: "M4 20h4L19 9l-4-4L4 16ZM14 6l4 4",
  close: "M6 6l12 12M18 6 6 18",
  clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  doc: "M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2ZM4 19V5M8 7h7",
};

export function Approvals() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [queue, setQueue] = useState<QueueItem[] | null>(null),
    [history, setHistory] = useState<HistoryRow[] | null>(null),
    [processes, setProcesses] = useState<Process[]>([]),
    [denied, setDenied] = useState(""),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [tab, setTab] = useState<"queue" | "history">("queue"),
    [kind, setKind] = useState<"" | Kind>(""),
    [department, setDepartment] = useState(""),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [sheet, setSheet] = useState(false),
    [pane, setPane] = useState<"content" | "files">("content"),
    [files, setFiles] = useState<AttachmentFile[] | null>(null),
    [remark, setRemark] = useState(""),
    [remarkProblem, setRemarkProblem] = useState(""),
    [busy, setBusy] = useState<Decision | null>(null),
    [notice, setNotice] = useState(""),
    [problem, setProblem] = useState("");
  const lock = useRef(false);

  const load = useCallback(async () => {
    const me = await api<User>("/auth/me");
    setUser(me);
    if (me.must_change_password) return router.replace("/account");
    const roles = reviewerRoles(me);
    if (!roles.head && !roles.hr) {
      setDenied(
        "Chỉ trưởng bộ phận được phân công (bài tri thức) hoặc HR (tài liệu) mới có quyền duyệt.",
      );
      setQueue([]);
      return;
    }
    const [items, people, list, past] = await Promise.all([
      api<QueueSource[]>("/workspace/contents"),
      api<Person[]>("/workspace/people").catch(() => [] as Person[]),
      api<Process[]>("/processes").catch(() => [] as Process[]),
      roles.head
        ? api<HistoryRow[]>("/approvals").catch(() => null)
        : Promise.resolve(null),
    ]);
    setProcesses(list);
    setHistory(past);
    setQueue(buildQueue(items, people, me.id));
  }, [router]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setError("");
      setDenied("");
      try {
        await load();
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401)
          return router.replace(expired);
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
  }, [load, router, revision]);

  const all = queue || [];
  const result = filterQueue(all, { kind, department, q, page });
  const selected = all.find((i) => i.id === selectedId) || null;
  const approved = history ? approvedHistory(history) : [];
  const approvedTotal = history
    ? history.filter((r) => r.status === "APPROVED").length
    : 0;
  const processName = (id: string | null) =>
    processes.find((p) => p.id === id)?.name;

  // Attachments of the selected version (reviewer access is checked by the server).
  useEffect(() => {
    if (!selected) return;
    let active = true;
    Promise.resolve().then(async () => {
      setFiles(null);
      try {
        const list = await api<AttachmentFile[]>(
          `/content-versions/${selected.version_id}/attachments`,
        );
        if (active) setFiles(list);
      } catch {
        if (active) setFiles([]);
      }
    });
    return () => {
      active = false;
    };
  }, [selected]);

  // Escape closes the tablet/mobile bottom sheet.
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  function open(id: string) {
    setSelectedId(id);
    setRemark("");
    setRemarkProblem("");
    setProblem("");
    setPane("content");
    setSheet(true);
  }

  async function decide(decision: Decision) {
    if (!selected || !user || lock.current) return;
    const err = remarkError(decision, remark);
    setRemarkProblem(err);
    if (err) return;
    if (
      decision === "reject" &&
      !window.confirm(
        `Từ chối “${selected.title}”? Tác giả sẽ thấy lý do bạn nhập.`,
      )
    )
      return;
    lock.current = true;
    setBusy(decision);
    setProblem("");
    setNotice("");
    try {
      await api(
        `/workspace/contents/${decision}`,
        {
          method: "POST",
          body: JSON.stringify({
            content_id: selected.id,
            version_id: selected.version_id,
            revision: selected.revision,
            remark: remark.trim(),
          }),
        },
        user.csrf_token,
      );
      setNotice(
        resultMessage(decision, selected.title, selected.version_number),
      );
      setQueue((qs) => (qs || []).filter((i) => i.id !== selected.id));
      setSelectedId(null);
      setSheet(false);
      setRemark("");
      setRevision((n) => n + 1);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        return router.replace(expired);
      setProblem(
        e instanceof ApiError
          ? e.status === 409
            ? "Bài đã được xử lý hoặc tác giả vừa thay đổi. Đã tải lại hàng đợi; vui lòng xem lại."
            : e.message
          : "Mất kết nối tới máy chủ. Quyết định chưa được ghi nhận, vui lòng thử lại.",
      );
      if (e instanceof ApiError && e.status === 409) setRevision((n) => n + 1);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  const detail = selected && (
    <section
      className={styles.detail}
      aria-labelledby="detail-title"
      data-testid="approval-detail"
    >
      <div className={styles.detailHead}>
        <div className={styles.chips}>
          <span
            className={styles[`kind${selected.kind}`] || styles.kindARTICLE}
          >
            <Glyph
              d={selected.kind === "DOCUMENT" ? glyphs.doc : glyphs.book}
            />
            {kindLabel[selected.kind] || selected.kind}
          </span>
          <span className={styles.pending}>Chờ duyệt</span>
        </div>
        <button
          type="button"
          className={styles.closeSheet}
          onClick={() => setSheet(false)}
          aria-label="Đóng chi tiết"
        >
          <Glyph d={glyphs.close} />
        </button>
      </div>
      <h2 id="detail-title">{selected.title}</h2>
      <dl className={styles.meta}>
        <div>
          <dt>Người gửi</dt>
          <dd>{selected.author || "Không hiển thị được tên"}</dd>
        </div>
        <div>
          <dt>Bộ phận</dt>
          <dd>{selected.department || "—"}</dd>
        </div>
        {processName(selected.process_id) && (
          <div>
            <dt>Công đoạn</dt>
            <dd>{processName(selected.process_id)}</dd>
          </div>
        )}
        <div>
          <dt>Phiên bản</dt>
          <dd>
            v{selected.version_number}
            {selected.version_number > 1 ? " · bản sửa" : ""}
          </dd>
        </div>
        <div>
          <dt>Tạo phiên bản</dt>
          <dd>{when(selected.created_at)}</dd>
        </div>
      </dl>
      <div
        className={styles.paneTabs}
        role="tablist"
        aria-label="Phần chi tiết"
      >
        <button
          type="button"
          role="tab"
          aria-selected={pane === "content"}
          onClick={() => setPane("content")}
        >
          Nội dung
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "files"}
          onClick={() => setPane("files")}
        >
          Tệp đính kèm ({files ? files.length : "…"})
        </button>
      </div>
      {pane === "content" ? (
        <div className={styles.body} aria-label="Nội dung cần duyệt">
          {articleSections(selected.body).map((s, i) => (
            <section key={i}>
              <h3>{s.title}</h3>
              {s.blocks.map((b, j) =>
                b.type === "p" ? (
                  <p key={j}>{b.text}</p>
                ) : b.type === "ul" || b.type === "ol" ? (
                  <ul key={j}>
                    {b.items.map((t, k) => (
                      <li key={k}>{t}</li>
                    ))}
                  </ul>
                ) : null,
              )}
            </section>
          ))}
        </div>
      ) : (
        <ul className={styles.files}>
          {files === null ? (
            <li>Đang tải…</li>
          ) : files.length ? (
            files.map((f) => (
              <li key={f.id}>
                <span className={styles.fileIcon}>
                  {fileKind(f) === "pdf"
                    ? "PDF"
                    : fileKind(f) === "image"
                      ? "IMG"
                      : "TỆP"}
                </span>
                <span className={styles.fileName}>
                  <b>{f.filename}</b>
                  <small>
                    {formatBytes(f.byte_size)} ·{" "}
                    {f.malware_scan_status === "CLEAN"
                      ? "Đã quét an toàn"
                      : "Đang chờ kiểm tra"}
                  </small>
                </span>
                {f.malware_scan_status === "CLEAN" && (
                  <a
                    href={`/api/v1/attachments/${f.id}/download`}
                    aria-label={`Tải ${f.filename}`}
                  >
                    Tải
                  </a>
                )}
              </li>
            ))
          ) : (
            <li>Không có tệp đính kèm.</li>
          )}
        </ul>
      )}
      <label className={styles.remark}>
        <span>Nhận xét của bạn</span>
        <textarea
          value={remark}
          maxLength={REMARK_MAX}
          rows={3}
          onChange={(e) => {
            setRemark(e.target.value);
            setRemarkProblem("");
          }}
          placeholder="Bắt buộc khi yêu cầu chỉnh sửa hoặc từ chối; tác giả sẽ thấy nhận xét này."
          aria-invalid={!!remarkProblem}
          aria-describedby={remarkProblem ? "remark-error" : undefined}
        />
        <small>
          {remark.length.toLocaleString("vi-VN")}/
          {REMARK_MAX.toLocaleString("vi-VN")}
        </small>
        {remarkProblem && (
          <em id="remark-error" className={styles.fieldError}>
            {remarkProblem}
          </em>
        )}
      </label>
      <div className={styles.actions}>
        {(["approve", "request-changes", "reject"] as Decision[]).map((d) => (
          <button
            key={d}
            type="button"
            className={styles[d.replace("-", "")]}
            disabled={!!busy}
            onClick={() => decide(d)}
          >
            <Glyph
              d={
                d === "approve"
                  ? glyphs.check
                  : d === "reject"
                    ? glyphs.close
                    : glyphs.edit
              }
            />
            {busy === d ? "Đang gửi…" : decisionLabel[d]}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <AppFrame
      user={user}
      path="/approvals"
      title="Phê duyệt nội dung"
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
            <Glyph d={glyphs.approvals} />
          </span>
          <div>
            <h1>Phê duyệt nội dung</h1>
            <p>
              Xem xét, đánh giá và ban hành các nội dung do nhân viên gửi lên.
            </p>
          </div>
          <p className={styles.rule} role="note">
            <Glyph d={glyphs.alert} />
            <span>
              <b>Không tự duyệt nội dung do chính mình tạo</b>
              Đảm bảo tính khách quan, minh bạch và chất lượng tri thức.
            </span>
          </p>
        </header>

        {denied ? (
          <section className={styles.state} role="alert">
            <Glyph d={glyphs.lock} />
            <h2>Bạn không có quyền phê duyệt</h2>
            <p>{denied}</p>
            <Link href="/">Về trang chủ</Link>
          </section>
        ) : error ? (
          <section className={styles.state} role="alert">
            <Glyph d={glyphs.alert} />
            <h2>Không tải được hàng đợi duyệt</h2>
            <p>{error}</p>
            <button type="button" onClick={() => setRevision((n) => n + 1)}>
              Thử lại
            </button>
          </section>
        ) : queue === null ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải hàng đợi duyệt"
          >
            <div />
            <div />
            Đang tải hàng đợi duyệt…
          </div>
        ) : (
          <>
            <div
              className={styles.stats}
              role="group"
              aria-label="Thống kê phê duyệt"
            >
              <button
                type="button"
                className={styles.stat}
                aria-pressed={tab === "queue"}
                onClick={() => setTab("queue")}
              >
                <span className={styles.statIcon} data-tone="blue">
                  <Glyph d={glyphs.clock} />
                </span>
                <span>
                  <small>Chờ duyệt</small>
                  <b>{all.length}</b>
                </span>
              </button>
              {history && (
                <button
                  type="button"
                  className={styles.stat}
                  aria-pressed={tab === "history"}
                  onClick={() => setTab("history")}
                >
                  <span className={styles.statIcon} data-tone="green">
                    <Glyph d={glyphs.check} />
                  </span>
                  <span>
                    <small>Đã duyệt (bài tri thức trong phạm vi)</small>
                    <b>{approvedTotal}</b>
                  </span>
                </button>
              )}
            </div>

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

            {tab === "history" && history ? (
              <section className={styles.card} aria-labelledby="history-title">
                <h2 id="history-title">Đã duyệt gần đây</h2>
                <ul className={styles.historyList}>
                  {approved.map((r) => (
                    <li key={r.id}>
                      <b>{r.title}</b>
                      <small>
                        {r.author} · v{r.version_number} · gửi{" "}
                        {when(r.requested_at)}
                      </small>
                      <span className={styles.approvedChip}>Đã duyệt</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.muted}>
                  Chỉ hiện bài tri thức đã duyệt trong phạm vi bộ phận (tối đa
                  50).
                </p>
              </section>
            ) : (
              <div className={styles.layout} data-sheet={sheet && !!selected}>
                <section className={styles.card} aria-labelledby="queue-title">
                  <h2 id="queue-title" className={styles.srOnly}>
                    Hàng đợi chờ duyệt
                  </h2>
                  <div className={styles.filters}>
                    <div
                      className={styles.kindChips}
                      role="group"
                      aria-label="Lọc loại nội dung"
                    >
                      {(["", "ARTICLE", "DOCUMENT"] as ("" | Kind)[]).map(
                        (k) => (
                          <button
                            key={k || "all"}
                            type="button"
                            aria-pressed={kind === k}
                            onClick={() => {
                              setKind(k);
                              setPage(1);
                            }}
                          >
                            {k ? kindLabel[k] : "Tất cả"} (
                            {k
                              ? all.filter((i) => i.kind === k).length
                              : all.length}
                            )
                          </button>
                        ),
                      )}
                    </div>
                    <label className={styles.select}>
                      <span className={styles.srOnly}>Lọc bộ phận</span>
                      <select
                        value={department}
                        onChange={(e) => {
                          setDepartment(e.target.value);
                          setPage(1);
                        }}
                        aria-label="Lọc bộ phận"
                      >
                        <option value="">Tất cả bộ phận</option>
                        {departments(all).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.search}>
                      <Glyph d={glyphs.search} />
                      <input
                        type="search"
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Tìm tiêu đề, người gửi…"
                        aria-label="Tìm trong hàng đợi duyệt"
                      />
                    </label>
                  </div>
                  {!all.length ? (
                    <div className={styles.empty}>
                      <Glyph d={glyphs.check} />
                      <h3>Không còn nội dung chờ duyệt</h3>
                      <p>
                        Khi nhân viên trong phạm vi gửi bài, bài sẽ hiện ở đây.
                      </p>
                    </div>
                  ) : !result.total ? (
                    <div className={styles.empty}>
                      <h3>Không có nội dung phù hợp</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setKind("");
                          setDepartment("");
                          setQ("");
                        }}
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className={styles.count}>
                        {result.total} nội dung chờ duyệt
                      </p>
                      <ul
                        className={styles.queue}
                        aria-label="Hàng đợi chờ duyệt"
                      >
                        {result.items.map((i) => (
                          <li key={i.id}>
                            <button
                              type="button"
                              className={styles.row}
                              aria-current={selectedId === i.id}
                              onClick={() => open(i.id)}
                            >
                              <span
                                className={
                                  styles[`kind${i.kind}`] || styles.kindARTICLE
                                }
                              >
                                <Glyph
                                  d={
                                    i.kind === "DOCUMENT"
                                      ? glyphs.doc
                                      : glyphs.book
                                  }
                                />
                                {kindLabel[i.kind] || i.kind}
                              </span>
                              <span className={styles.rowMain}>
                                <b className={styles.rowTitle}>{i.title}</b>
                                <small className={styles.rowDate}>
                                  Tạo phiên bản {when(i.created_at)} · v
                                  {i.version_number}
                                </small>
                              </span>
                              <span className={styles.rowDept}>
                                {i.department || "—"}
                              </span>
                              <span className={styles.rowAuthor}>
                                {i.author || "—"}
                              </span>
                              <span className={styles.pending}>Chờ duyệt</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {result.pages > 1 && (
                        <nav className={styles.pager} aria-label="Phân trang">
                          <button
                            type="button"
                            disabled={result.page <= 1}
                            onClick={() => setPage(result.page - 1)}
                          >
                            Trang trước
                          </button>
                          <span>
                            Trang {result.page}/{result.pages}
                          </span>
                          <button
                            type="button"
                            disabled={result.page >= result.pages}
                            onClick={() => setPage(result.page + 1)}
                          >
                            Trang sau
                          </button>
                        </nav>
                      )}
                    </>
                  )}
                </section>
                <aside
                  className={styles.side}
                  aria-label="Chi tiết nội dung chờ duyệt"
                >
                  {detail || (
                    <div className={styles.placeholder}>
                      <Glyph d={glyphs.approvals} />
                      <p>
                        Chọn một nội dung trong hàng đợi để đọc trước khi duyệt.
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </>
        )}
      </main>
    </AppFrame>
  );
}
