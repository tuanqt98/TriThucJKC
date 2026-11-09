"use client";
// UI-05B · Chi tiết bài tri thức (/knowledge/[id]). Layout approved by PO from the UI-05B proposal.
// Shows only what the API returns: published version within the reader's ACL (else 404).
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type Content,
  type ContentPage,
  type User,
} from "./api";
import { AppFrame } from "./app-frame";
import { Icon } from "./icon";
import {
  fileKind,
  formatBytes,
  type AttachmentFile,
} from "./document-detail-model";
import {
  articleSections,
  businessCode,
  isImage,
  LIBRARY_FROM_KEY,
  LIBRARY_QUERY_KEY,
  libraryHref,
  relatedArticles,
  shouldGoBack,
  splitImages,
  type ArticleSection,
} from "./knowledge-detail-model";
import styles from "./knowledge-detail.module.css";

type Tab = "content" | "files" | "approval";
type LoadError = { kind: "missing" | "forbidden" | "error"; message: string };

const TZ = "Asia/Ho_Chi_Minh";
const day = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("vi-VN", { timeZone: TZ }) : "";
const fileUrl = (f: AttachmentFile) => `/api/v1/attachments/${f.id}/download`;
const storage = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

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
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2ZM4 19V5M8 7h7",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
  dept: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  process: "M6 7h12v10H6ZM9 3v4m6-4v4M9 17v4m6-4v4",
  calendar: "M4 5h16v16H4ZM4 10h16M9 3v4M15 3v4",
  version: "M12 8v4l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  image: "M4 5h16v14H4ZM4 15l4-4 4 4 3-3 5 5M15 9h.01",
};

function Figure({
  file,
  className,
}: {
  file: AttachmentFile;
  className?: string;
}) {
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ACL-protected API file, not a static asset */}
      <img src={fileUrl(file)} alt={file.filename} loading="lazy" />
      <figcaption>{file.filename}</figcaption>
    </figure>
  );
}

function SectionBody({ section }: { section: ArticleSection }) {
  const blocks = section.blocks.map((b, i) =>
    b.type === "p" ? (
      <p key={i}>{b.text}</p>
    ) : b.type === "image" ? (
      <Figure key={i} file={b.file} className={styles.inlineFigure} />
    ) : b.type === "ul" ? (
      <ul key={i}>
        {b.items.map((t, j) => (
          <li key={j}>{t}</li>
        ))}
      </ul>
    ) : (
      <ol key={i}>
        {b.items.map((t, j) => (
          <li key={j}>{t}</li>
        ))}
      </ol>
    ),
  );
  return section.caution ? (
    <div className={styles.caution}>
      <Glyph d={glyphs.alert} />
      <div>{blocks}</div>
    </div>
  ) : (
    <div className={styles.sectionBody}>{blocks}</div>
  );
}

export function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [article, setArticle] = useState<Content | null>(null),
    [files, setFiles] = useState<AttachmentFile[] | null>(null),
    [related, setRelated] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<LoadError | null>(null),
    [filesError, setFilesError] = useState(""),
    [revision, setRevision] = useState(0),
    [tab, setTab] = useState<Tab>("content"),
    [backHref, setBackHref] = useState("/knowledge");

  // Saved list state is per tab (sessionStorage); read after mount to keep SSR markup stable.
  useEffect(() => {
    const href = libraryHref(storage(LIBRARY_QUERY_KEY));
    queueMicrotask(() => setBackHref(href));
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setLoading(true);
      setLoadError(null);
      setFilesError("");
      setTab("content");
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) {
          router.replace("/account");
          return;
        }
        const detail = await api<Content>(
          `/articles/${encodeURIComponent(id)}`,
        );
        if (!active) return;
        setArticle(detail);
        const [attachments, same] = await Promise.allSettled([
          api<AttachmentFile[]>(
            `/content-versions/${detail.version_id}/attachments`,
          ),
          detail.process_id
            ? api<ContentPage>(
                `/articles?processId=${encodeURIComponent(detail.process_id)}&pageSize=4`,
              )
            : Promise.resolve(null),
        ]);
        if (!active) return;
        for (const r of [attachments, same])
          if (
            r.status === "rejected" &&
            r.reason instanceof ApiError &&
            r.reason.status === 401
          ) {
            router.replace("/login");
            return;
          }
        if (attachments.status === "fulfilled") setFiles(attachments.value);
        else {
          setFiles(null);
          setFilesError(
            "Không tải được ảnh và tệp đính kèm. Nội dung vẫn xem được.",
          );
        }
        setRelated(
          same.status === "fulfilled" && same.value
            ? relatedArticles(same.value.items, detail.id)
            : [],
        );
      } catch (e) {
        if (!active) return;
        setArticle(null);
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
                  "Bài viết không tồn tại, chưa được duyệt hoặc bạn không có quyền xem.",
              }
            : status === 403
              ? {
                  kind: "forbidden",
                  message: e instanceof Error ? e.message : "Không đủ quyền.",
                }
              : {
                  kind: "error",
                  message:
                    e instanceof Error ? e.message : "Không tải được bài viết.",
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

  function back(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (shouldGoBack(storage(LIBRARY_FROM_KEY), id, window.history.length)) {
      e.preventDefault();
      router.back();
    }
  }
  function leaveToRelated() {
    // The next article was not opened from the library: its back link must not pop history.
    try {
      sessionStorage.removeItem(LIBRARY_FROM_KEY);
    } catch {}
  }

  const sections = article ? articleSections(article.body, files || []) : [];
  const images = splitImages(files || [], sections);
  const code = businessCode(article?.code);
  const fileCount = files?.length ?? 0;
  const meta = article
    ? ([
        [glyphs.user, "Người chia sẻ", article.author_name],
        [glyphs.dept, "Bộ phận", article.department_name],
        [glyphs.process, "Công đoạn", article.process_name],
        [glyphs.calendar, "Ngày duyệt", day(article.approved_at)],
        [glyphs.version, "Phiên bản", `v${article.version_number} · hiện hành`],
      ].filter(([, , v]) => v) as [string, string, string][])
    : [];

  // Mobile header keeps a one-line summary; version and process are already in the chips.
  const compact = article
    ? [
        article.author_name,
        article.department_name,
        article.approved_at && `Duyệt ${day(article.approved_at)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <AppFrame
      user={user}
      path="/knowledge"
      title="Chi tiết bài tri thức"
      onSearch={(e) => {
        e.preventDefault();
        router.push(
          `/knowledge?q=${encodeURIComponent(new FormData(e.currentTarget).get("q")?.toString() || "")}`,
        );
      }}
    >
      <main id="main" className={styles.main}>
        <nav className={styles.crumbs} aria-label="Đường dẫn">
          <Link href={backHref} onClick={back}>
            <Glyph d={glyphs.back} />
            Kho tri thức
          </Link>
          {article?.process_name && <span>{article.process_name}</span>}
        </nav>

        {loading && !article ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải bài viết"
          >
            <div />
            <div />
            <div />
            Đang tải bài viết…
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
                ? "Không tìm thấy bài viết"
                : loadError.kind === "forbidden"
                  ? "Bạn không có quyền xem bài viết này"
                  : "Không thể tải bài viết"}
            </h1>
            <p>{loadError.message}</p>
            <div>
              {loadError.kind === "error" && (
                <button type="button" onClick={() => setRevision((n) => n + 1)}>
                  Thử lại
                </button>
              )}
              <Link href={backHref}>Về Kho tri thức</Link>
            </div>
          </section>
        ) : article ? (
          <div className={styles.layout} data-tab={tab}>
            <div className={styles.column}>
              <header className={`${styles.card} ${styles.head}`}>
                <div className={styles.top}>
                  <span className={styles.icon}>
                    <Glyph d={glyphs.book} />
                  </span>
                  <div className={styles.headText}>
                    {code && <span className={styles.code}>{code}</span>}
                    <h1 id="article-title">{article.title}</h1>
                    <div className={styles.chips}>
                      <span className={styles.chipOk}>
                        <Icon name="check" />
                        Đã duyệt
                      </span>
                      <span className={styles.chipVersion}>
                        v{article.version_number}
                      </span>
                      <span className={styles.chipKind}>Bài tri thức</span>
                      {article.process_name && (
                        <span className={styles.chipProcess}>
                          {article.process_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {images.cover && (
                  <Figure
                    file={images.cover}
                    className={`${styles.cover} ${styles.coverWide}`}
                  />
                )}
                {compact && (
                  <p className={styles.metaCompact} data-testid="meta-compact">
                    {compact}
                  </p>
                )}
                <dl className={styles.meta}>
                  {meta.map(([d, k, v]) => (
                    <div key={k}>
                      <Glyph d={d} />
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </header>

              <div
                className={styles.tabs}
                role="tablist"
                aria-label="Phần của bài viết"
              >
                {(
                  [
                    ["content", "Nội dung"],
                    ["files", `Ảnh & tệp (${fileCount})`],
                    ["approval", "Phê duyệt"],
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

              <article
                id="panel-content"
                className={`${styles.card} ${styles.body}`}
                data-panel="content"
                aria-labelledby="article-title"
              >
                {images.cover && (
                  // Mobile (PO): cover lives in the "Nội dung" tab so the tabs follow the title directly.
                  <Figure
                    file={images.cover}
                    className={`${styles.cover} ${styles.coverMobile}`}
                  />
                )}
                {sections.length ? (
                  sections.map((s, i) => (
                    <section key={`${s.title}-${i}`} aria-label={s.title}>
                      <h2>
                        <span className={styles.num}>{i + 1}</span>
                        {s.title}
                      </h2>
                      <SectionBody section={s} />
                    </section>
                  ))
                ) : (
                  <p className={styles.muted}>
                    Phiên bản này chưa có nội dung văn bản. Xem ảnh và tệp đính
                    kèm nếu có.
                  </p>
                )}
              </article>

              {images.gallery.length > 0 && (
                <section
                  className={`${styles.card} ${styles.gallery}`}
                  data-panel="content"
                  aria-labelledby="gallery-title"
                >
                  <h2 id="gallery-title">
                    <Glyph d={glyphs.image} />
                    Hình ảnh khác ({images.gallery.length})
                  </h2>
                  <div>
                    {images.gallery.map((f) => (
                      <Figure key={f.id} file={f} />
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside
              className={styles.side}
              aria-label="Phê duyệt, tệp đính kèm và bài liên quan"
            >
              <section
                id="panel-approval"
                className={`${styles.card} ${styles.approval}`}
                data-panel="approval"
                aria-labelledby="approval-title"
              >
                <h2 id="approval-title">Phê duyệt &amp; phiên bản</h2>
                <ol className={styles.timeline}>
                  <li>
                    <div>
                      <b>v{article.version_number}</b>
                      <span className={styles.chipOk}>Hiện hành</span>
                    </div>
                    <small>
                      {article.approved_at &&
                        `Duyệt ${day(article.approved_at)} · `}
                      Tạo phiên bản {day(article.created_at)}
                    </small>
                  </li>
                </ol>
                <dl className={styles.kv}>
                  <div>
                    <dt>Trạng thái</dt>
                    <dd className={styles.okText}>Đã duyệt</dd>
                  </div>
                  {article.approver_name && (
                    <div>
                      <dt>Người duyệt</dt>
                      <dd>{article.approver_name}</dd>
                    </div>
                  )}
                  {article.department_name && (
                    <div>
                      <dt>Bộ phận</dt>
                      <dd>{article.department_name}</dd>
                    </div>
                  )}
                  {article.approved_at && (
                    <div>
                      <dt>Ngày duyệt</dt>
                      <dd>{day(article.approved_at)}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <section
                id="panel-files"
                className={`${styles.card} ${styles.files}`}
                data-panel="files"
                aria-labelledby="files-title"
              >
                <h2 id="files-title">Ảnh &amp; tệp đính kèm ({fileCount})</h2>
                {filesError ? (
                  <p className={styles.error} role="alert">
                    {filesError}{" "}
                    <button
                      type="button"
                      onClick={() => setRevision((n) => n + 1)}
                    >
                      Thử lại
                    </button>
                  </p>
                ) : files === null ? (
                  <p className={styles.muted}>Đang tải…</p>
                ) : fileCount ? (
                  <ul>
                    {files.map((f) => {
                      const kind = fileKind(f);
                      const clean = f.malware_scan_status === "CLEAN";
                      return (
                        <li key={f.id}>
                          {isImage(f) ? (
                            // eslint-disable-next-line @next/next/no-img-element -- ACL-protected API file
                            <img
                              className={styles.thumb}
                              src={fileUrl(f)}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className={`${styles.fileIcon} ${styles[kind]}`}
                            >
                              {kind === "pdf"
                                ? "PDF"
                                : kind === "sheet"
                                  ? "XLS"
                                  : kind === "image"
                                    ? "IMG"
                                    : "FILE"}
                            </span>
                          )}
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
                              href={fileUrl(f)}
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
                    Bài viết không có ảnh hay tệp đính kèm.
                  </p>
                )}
              </section>

              {related.length > 0 && (
                <section
                  className={`${styles.card} ${styles.related}`}
                  data-panel="content"
                  aria-labelledby="related-title"
                >
                  <h2 id="related-title">Cùng công đoạn</h2>
                  <ul>
                    {related.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/knowledge/${r.id}`}
                          onClick={leaveToRelated}
                        >
                          <b>{r.title}</b>
                          <small>
                            {[r.author_name, day(r.approved_at)]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        ) : null}
      </main>
    </AppFrame>
  );
}
