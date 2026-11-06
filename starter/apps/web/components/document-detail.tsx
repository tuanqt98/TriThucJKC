"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, type Content, type User } from "./api";
import { AppFrame } from "./app-frame";
import { Icon } from "./icon";
import type { ReadingTask } from "./documents-model";
import {
  ackError,
  fileKind,
  formatBytes,
  parseSections,
  readingSummary,
  readingText,
  type AttachmentFile,
} from "./document-detail-model";
import styles from "./document-detail.module.css";

type Tab = "content" | "files" | "history";
type LoadError = { kind: "missing" | "forbidden" | "error"; message: string };

const TZ = "Asia/Ho_Chi_Minh";
const day = (v: string) =>
  new Date(v).toLocaleDateString("vi-VN", { timeZone: TZ });
const moment = (v: string) =>
  new Date(v).toLocaleString("vi-VN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  chevron: "m6 9 6 6 6-6",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  back: "M20 12H4m6-6-6 6 6 6",
  tag: "M3 12V3h9l9 9-9 9ZM7.5 7.5h.01",
  calendar: "M4 5h16v16H4ZM4 10h16M9 3v4M15 3v4",
  people:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-2a6 6 0 0 1 12 0v2M16 3a4 4 0 0 1 0 8M22 21v-2a6 6 0 0 0-4-5.6",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z",
  clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [doc, setDoc] = useState<Content | null>(null),
    [tasks, setTasks] = useState<ReadingTask[] | null>(null),
    [files, setFiles] = useState<AttachmentFile[] | null>(null);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<LoadError | null>(null),
    [readingError, setReadingError] = useState(""),
    [filesError, setFilesError] = useState(""),
    [revision, setRevision] = useState(0),
    [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false),
    [ackMessage, setAckMessage] = useState(""),
    [ackProblem, setAckProblem] = useState(""),
    [tab, setTab] = useState<Tab>("content"),
    [open, setOpen] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setLoading(true);
      setLoadError(null);
      setReadingError("");
      setFilesError("");
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) {
          router.replace("/account");
          return;
        }
        const detail = await api<Content>(
          `/documents/${encodeURIComponent(id)}`,
        );
        if (!active) return;
        setDoc(detail);
        const [reading, attachments] = await Promise.allSettled([
          api<ReadingTask[]>("/my/reading"),
          api<AttachmentFile[]>(
            `/content-versions/${detail.version_id}/attachments`,
          ),
        ]);
        if (!active) return;
        for (const r of [reading, attachments])
          if (
            r.status === "rejected" &&
            r.reason instanceof ApiError &&
            r.reason.status === 401
          ) {
            router.replace("/login");
            return;
          }
        if (reading.status === "fulfilled") setTasks(reading.value);
        else {
          setTasks(null);
          setReadingError(
            "Không tải được trạng thái xác nhận đọc. Nội dung vẫn có thể xem; vui lòng tải lại trước khi xác nhận.",
          );
        }
        if (attachments.status === "fulfilled") setFiles(attachments.value);
        else {
          setFiles(null);
          setFilesError("Không tải được danh sách tệp đính kèm.");
        }
        setClock(Date.now());
      } catch (e) {
        if (!active) return;
        setDoc(null);
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        const status = e instanceof ApiError ? e.status : 0;
        setLoadError(
          status === 404 || status === 422
            ? {
                kind: "missing",
                message:
                  "Tài liệu không tồn tại, đã thay thế hoặc bạn không có quyền xem.",
              }
            : status === 403
              ? {
                  kind: "forbidden",
                  message: e instanceof Error ? e.message : "Không đủ quyền.",
                }
              : {
                  kind: "error",
                  message:
                    e instanceof Error ? e.message : "Không tải được tài liệu.",
                },
        );
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id, router, revision]);

  const summary = doc
    ? readingSummary(tasks, doc.id, doc.version_id, clock)
    : readingSummary(null, "", "", 0);
  const sections = doc ? parseSections(doc.body) : [];
  const canAck =
    !!doc &&
    !!user &&
    !!summary.current &&
    !summary.current.acknowledged_at &&
    summary.current.version_id === doc.version_id;
  const mandatory = !!summary.current;
  const fileCount = files?.length ?? 0;
  const historyCount = 1 + summary.history.length;

  async function acknowledge() {
    if (!canAck || busy || !summary.current || !doc || !user) return;
    setBusy(true);
    setAckProblem("");
    setAckMessage("");
    try {
      await api<{ message: string }>(
        `/reading-assignments/${summary.current.id}/acknowledge`,
        {
          method: "POST",
          body: JSON.stringify({ version_id: doc.version_id }),
        },
        user.csrf_token,
      );
      setAckMessage(
        `Đã ghi nhận bạn đọc phiên bản v${doc.version_number}. Lịch sử xác nhận các phiên bản trước được giữ nguyên.`,
      );
      setRevision((n) => n + 1);
    } catch (e) {
      const kind = ackError(e instanceof ApiError ? e.status : 0);
      if (kind === "SESSION") {
        setAckProblem(
          "Phiên đăng nhập đã hết hạn. Chưa ghi nhận xác nhận; vui lòng đăng nhập lại.",
        );
        router.replace("/login");
      } else if (kind === "CONFLICT") {
        setAckProblem(
          "Phiên bản đã thay đổi hoặc chưa có hiệu lực, chưa ghi nhận xác nhận. Đã tải lại phiên bản hiện hành, vui lòng đọc lại trước khi xác nhận.",
        );
        setRevision((n) => n + 1);
      } else if (kind === "NOT_FOUND") {
        setAckProblem(
          "Không tìm thấy nhiệm vụ đọc của bạn cho phiên bản này. Đã tải lại trạng thái.",
        );
        setRevision((n) => n + 1);
      } else
        setAckProblem(
          e instanceof Error ? e.message : "Chưa ghi nhận được xác nhận.",
        );
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const ackButton = (extra = "") => (
    <button
      type="button"
      className={`${styles.ackButton} ${extra}`}
      disabled={busy}
      onClick={acknowledge}
    >
      <Icon name="check" />
      {busy ? "Đang ghi nhận…" : "Xác nhận đã đọc"}
    </button>
  );

  const banner =
    doc && summary.newVersionPending ? (
      <div className={styles.banner} role="note">
        <Glyph d={glyphs.alert} />
        <div>
          <b>Đã có phiên bản mới (v{doc.version_number})</b>
          <span>
            Xác nhận trước đây không áp dụng cho phiên bản này
            {summary.current?.due_at
              ? `. Vui lòng đọc và xác nhận trước ${day(summary.current.due_at)}.`
              : "; vui lòng đọc và xác nhận lại."}
          </span>
        </div>
      </div>
    ) : doc && summary.status === "OVERDUE" ? (
      <div className={styles.banner} role="note">
        <Glyph d={glyphs.alert} />
        <div>
          <b>Đã quá hạn xác nhận</b>
          <span>
            Hạn {summary.current?.due_at && day(summary.current.due_at)}. Vui
            lòng đọc và xác nhận phiên bản v{doc.version_number}.
          </span>
        </div>
      </div>
    ) : null;

  return (
    <AppFrame
      user={user}
      path="/documents"
      title="Chi tiết nội quy"
      onSearch={(e) => {
        e.preventDefault();
        router.push(
          `/knowledge?q=${encodeURIComponent(new FormData(e.currentTarget).get("q")?.toString() || "")}`,
        );
      }}
    >
      <main id="main" className={styles.main}>
        <p className={styles.demo}>
          Môi trường DEMO · Tài liệu minh họa, chưa dùng làm quy định vận hành.
        </p>
        <nav className={styles.crumbs} aria-label="Đường dẫn">
          <Link href="/documents">
            <Glyph d={glyphs.back} />
            Nội quy
          </Link>
          {doc && (
            <span aria-current="page" title={doc.code}>
              {doc.code}
            </span>
          )}
        </nav>

        {loading && !doc ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải tài liệu"
          >
            <div />
            <div />
            <div />
            Đang tải tài liệu và trạng thái xác nhận…
          </div>
        ) : loadError ? (
          <section className={styles.stateCard} role="alert">
            <span className={styles.stateIcon}>
              <Glyph
                d={loadError.kind === "error" ? glyphs.alert : glyphs.lock}
              />
            </span>
            <h1>
              {loadError.kind === "missing"
                ? "Không tìm thấy tài liệu"
                : loadError.kind === "forbidden"
                  ? "Bạn không có quyền xem tài liệu này"
                  : "Không thể tải tài liệu"}
            </h1>
            <p>{loadError.message}</p>
            <div>
              {loadError.kind === "error" && (
                <button type="button" onClick={() => setRevision((n) => n + 1)}>
                  Thử lại
                </button>
              )}
              <Link href="/documents">Về thư viện nội quy</Link>
            </div>
          </section>
        ) : doc ? (
          <div className={styles.layout} data-tab={tab}>
            <article className={styles.article} aria-labelledby="doc-title">
              <header className={styles.head}>
                <span className={styles.docIcon}>
                  <Icon name="document" />
                </span>
                <div className={styles.headText}>
                  <span className={styles.code} title={doc.code}>
                    {doc.code}
                  </span>
                  <h1 id="doc-title">{doc.title}</h1>
                  <div className={styles.chips}>
                    <span className={styles.chipVersion}>
                      v{doc.version_number}
                    </span>
                    <span className={styles.chipOk}>
                      Đã ban hành · hiện hành
                    </span>
                    {mandatory && (
                      <span className={styles.chipMust}>Bắt buộc</span>
                    )}
                    <span
                      className={`${styles.chipRead} ${styles[summary.status]}`}
                      data-testid="reading-status"
                    >
                      {readingText[summary.status]}
                    </span>
                  </div>
                </div>
              </header>
              <dl className={styles.meta}>
                <div>
                  <Glyph d={glyphs.people} />
                  <dt>Bộ phận phụ trách</dt>
                  <dd>{doc.department_name || "Chưa có thông tin"}</dd>
                </div>
                <div>
                  <Glyph d={glyphs.tag} />
                  <dt>Phiên bản</dt>
                  <dd>v{doc.version_number}</dd>
                </div>
                <div>
                  <Glyph d={glyphs.calendar} />
                  <dt>Ngày ban hành</dt>
                  <dd className={styles.missing}>Chưa cung cấp</dd>
                </div>
                <div>
                  <Glyph d={glyphs.calendar} />
                  <dt>Ngày hiệu lực</dt>
                  <dd className={styles.missing}>Chưa cung cấp</dd>
                </div>
                <div>
                  <Glyph d={glyphs.shield} />
                  <dt>Mức độ</dt>
                  <dd className={mandatory ? styles.must : ""}>
                    {mandatory ? "Bắt buộc đọc" : "Tham khảo"}
                  </dd>
                </div>
                <div>
                  <Glyph d={glyphs.clock} />
                  <dt>Tạo phiên bản</dt>
                  <dd>{day(doc.created_at)}</dd>
                </div>
              </dl>

              <div
                className={styles.tabs}
                role="tablist"
                aria-label="Phần tài liệu"
              >
                {(
                  [
                    ["content", "Nội dung"],
                    ["files", `Tệp đính kèm (${fileCount})`],
                    ["history", `Lịch sử (${historyCount})`],
                  ] as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`tab-${key}`}
                    aria-selected={tab === key}
                    aria-controls={`panel-${key}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className={styles.mobileBanner}>{banner}</div>

              <section
                id="panel-content"
                className={styles.sections}
                aria-label="Nội dung tài liệu"
              >
                {sections.length ? (
                  sections.map((s, i) => (
                    <section
                      key={`${s.title}-${i}`}
                      className={styles.section}
                      data-open={open.has(i)}
                    >
                      <h2>
                        <span className={styles.num}>{i + 1}</span>
                        {s.title}
                        <button
                          type="button"
                          className={styles.more}
                          aria-expanded={open.has(i)}
                          aria-label={`${open.has(i) ? "Thu gọn" : "Mở rộng"} mục ${s.title}`}
                          onClick={() => toggle(i)}
                        >
                          <Glyph d={glyphs.chevron} />
                        </button>
                      </h2>
                      <div className={styles.sectionBody}>
                        {s.paragraphs.map((p, j) => (
                          <p key={j}>{p}</p>
                        ))}
                        {s.bullets.length > 0 && (
                          <ul>
                            {s.bullets.map((b, j) => (
                              <li key={j}>{b}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  ))
                ) : (
                  <p className={styles.empty}>
                    Phiên bản này chưa có nội dung văn bản. Xem tệp đính kèm nếu
                    có.
                  </p>
                )}
              </section>
            </article>

            <aside
              className={styles.side}
              aria-label="Thông tin xác nhận và phiên bản"
            >
              <div className={styles.desktopBanner}>{banner}</div>
              <section className={styles.ackCard} aria-labelledby="ack-title">
                <h2 id="ack-title">Tiến độ xác nhận của bạn</h2>
                {summary.status === "UNKNOWN" ? (
                  <p className={styles.muted}>{readingError}</p>
                ) : (
                  <>
                    <div className={styles.progress}>
                      <div
                        role="progressbar"
                        aria-label="Tiến độ xác nhận"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          summary.status === "ACKNOWLEDGED" ? 100 : 0
                        }
                      >
                        <span
                          style={{
                            width:
                              summary.status === "ACKNOWLEDGED" ? "100%" : "0%",
                          }}
                        />
                      </div>
                      <b>{summary.status === "ACKNOWLEDGED" ? "100%" : "0%"}</b>
                    </div>
                    <p
                      className={`${styles.ackState} ${styles[summary.status]}`}
                    >
                      {readingText[summary.status]}
                      {summary.current?.due_at &&
                        summary.status !== "ACKNOWLEDGED" &&
                        ` · Hạn ${day(summary.current.due_at)}`}
                    </p>
                    {summary.status === "ACKNOWLEDGED" && summary.current && (
                      <p className={styles.ackDone} data-testid="ack-receipt">
                        <Icon name="check" />
                        <span>
                          Đã xác nhận phiên bản v
                          {summary.current.version_number}
                          <small>
                            lúc {moment(summary.current.acknowledged_at!)} · ghi
                            nhận bằng tài khoản của bạn
                          </small>
                        </span>
                      </p>
                    )}
                    {canAck && (
                      <>
                        {ackButton()}
                        <small className={styles.muted}>
                          Xác nhận phiên bản v{doc.version_number} bằng tài
                          khoản {user?.full_name}. Không thể xác nhận thay người
                          khác.
                        </small>
                      </>
                    )}
                    {summary.status === "NOT_ASSIGNED" && (
                      <p className={styles.muted}>
                        Phiên bản này chưa được giao cho bạn nên không cần xác
                        nhận. Bạn vẫn có thể đọc để tham khảo.
                      </p>
                    )}
                  </>
                )}
                {readingError && summary.status !== "UNKNOWN" && (
                  <p className={styles.muted}>{readingError}</p>
                )}
                {readingError && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setRevision((n) => n + 1)}
                  >
                    Tải lại trạng thái
                  </button>
                )}
                {ackProblem && (
                  <p className={styles.error} role="alert">
                    {ackProblem}
                  </p>
                )}
                {ackMessage && (
                  <p className={styles.notice} role="status">
                    {ackMessage}
                  </p>
                )}
              </section>

              <section
                id="panel-files"
                className={styles.filesCard}
                aria-labelledby="files-title"
              >
                <h2 id="files-title">Tệp đính kèm ({fileCount})</h2>
                {filesError ? (
                  <p className={styles.error} role="alert">
                    {filesError}
                  </p>
                ) : fileCount ? (
                  <ul className={styles.files}>
                    {files!.map((f) => {
                      const kind = fileKind(f);
                      const clean = f.malware_scan_status === "CLEAN";
                      return (
                        <li key={f.id}>
                          <span
                            className={`${styles.fileIcon} ${styles[kind]}`}
                          >
                            {kind === "pdf"
                              ? "PDF"
                              : kind === "image"
                                ? "IMG"
                                : kind === "sheet"
                                  ? "XLS"
                                  : "FILE"}
                          </span>
                          <span className={styles.fileName}>
                            <b title={f.filename}>{f.filename}</b>
                            <small>
                              {formatBytes(f.byte_size)} ·{" "}
                              {clean ? "Đã quét an toàn" : "Đang chờ kiểm tra"}
                            </small>
                          </span>
                          {clean ? (
                            <a
                              className={styles.download}
                              href={`/api/v1/attachments/${f.id}/download`}
                              aria-label={`Tải ${f.filename}`}
                            >
                              <Glyph d={glyphs.download} />
                            </a>
                          ) : (
                            <span className={styles.muted}>Chưa tải được</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={styles.muted}>
                    Phiên bản này không có tệp đính kèm.
                  </p>
                )}
                <small className={styles.muted}>
                  Chỉ tệp đã quét an toàn và đúng quyền xem phiên bản mới tải
                  được.
                </small>
              </section>

              <section
                id="panel-history"
                className={styles.historyCard}
                aria-labelledby="history-title"
              >
                <h2 id="history-title">Lịch sử phiên bản</h2>
                <ol className={styles.timeline}>
                  <li data-current="true">
                    <div>
                      <b>v{doc.version_number}</b>
                      <span className={styles.chipOk}>Hiện tại</span>
                    </div>
                    <small>Tạo phiên bản {day(doc.created_at)}</small>
                    <small>
                      Của bạn: {readingText[summary.status]}
                      {summary.current?.acknowledged_at &&
                        ` · ${moment(summary.current.acknowledged_at)}`}
                    </small>
                  </li>
                  {summary.history.map((t) => (
                    <li key={t.id}>
                      <div>
                        <b>v{t.version_number}</b>
                        <span className={styles.chipOld}>Bản trước</span>
                      </div>
                      <small>
                        {t.acknowledged_at
                          ? `Bạn đã xác nhận lúc ${moment(t.acknowledged_at)}`
                          : "Bạn chưa xác nhận bản này; không cần xác nhận lại vì đã có bản mới."}
                      </small>
                    </li>
                  ))}
                </ol>
                <small className={styles.muted}>
                  Hiển thị phiên bản hiện hành và các phiên bản bạn từng được
                  giao đọc. Danh sách đầy đủ và nội dung thay đổi giữa các phiên
                  bản chưa được API cung cấp.
                </small>
              </section>
            </aside>
          </div>
        ) : null}

        {doc && canAck && (
          <div className={styles.stickyAck}>
            {ackButton(styles.stickyButton)}
          </div>
        )}
        <footer className={styles.footer}>
          Tri Thức JKC · Môi trường DEMO
        </footer>
      </main>
    </AppFrame>
  );
}
