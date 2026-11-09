"use client";
// UI-06 · Chi tiết sự cố & giải pháp (/incidents/[id]), mockup 05.
// Data: the approved INCIDENT_GUIDE content (GET /incidents/{id}, ACL/RLS-checked; else 404), its attachments
// and approved guides of the same process. Incident records (severity, field verification, recurrences) live in
// /workspace/incidents and are not linked to guides yet (REPORT GAP), so they are never invented here.
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
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
import {
  defaultOpen,
  isHypothesis,
  sectionKind,
  type SectionKind,
} from "./incident-detail-model";
import styles from "./incident-detail.module.css";

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
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
  dept: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
  process: "M6 7h12v10H6ZM9 3v4m6-4v4M9 17v4m6-4v4",
  calendar: "M4 5h16v16H4ZM4 10h16M9 3v4M15 3v4",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  chevron: "m6 9 6 6 6-6",
  repeat:
    "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
  close: "M6 6l12 12M18 6 6 18",
  zoom: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM21 21l-5-5M11 8v6M8 11h6",
};
const kindGlyph: Record<SectionKind, string> = {
  symptom: glyphs.alert,
  condition: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8",
  cause:
    "M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  check: "M9 3h6v3H9ZM8 4H5v18h14V4h-3M8 12h8M8 16h5",
  solution:
    "M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.7-1 1.5-1 2.5H9c0-1-.3-1.8-1-2.5A6 6 0 0 1 12 3Z",
  result: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  prevention: glyphs.shield,
  safety: glyphs.alert,
  other: "M4 5h16v14H4ZM8 9h8M8 13h6",
};

function Zoomable({
  file,
  onZoom,
  className,
}: {
  file: AttachmentFile;
  onZoom: (f: AttachmentFile) => void;
  className?: string;
}) {
  return (
    <figure className={className}>
      <button
        type="button"
        className={styles.zoomButton}
        onClick={() => onZoom(file)}
        aria-label={`Phóng to ảnh ${file.filename}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ACL-protected API file, not a static asset */}
        <img src={fileUrl(file)} alt={file.filename} loading="lazy" />
      </button>
      <figcaption>{file.filename}</figcaption>
    </figure>
  );
}

function SectionBody({
  section,
  onZoom,
}: {
  section: ArticleSection;
  onZoom: (f: AttachmentFile) => void;
}) {
  const images = section.blocks.flatMap((b) =>
    b.type === "image" ? [b.file] : [],
  );
  return (
    <>
      {section.blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{b.text}</p>
        ) : b.type === "ul" ? (
          <ul key={i}>
            {b.items.map((t, j) => (
              <li key={j}>{t}</li>
            ))}
          </ul>
        ) : b.type === "ol" ? (
          <ol key={i}>
            {b.items.map((t, j) => (
              <li key={j}>{t}</li>
            ))}
          </ol>
        ) : null,
      )}
      {images.length > 0 && (
        <div className={styles.sectionImages}>
          {images.map((f) => (
            <Zoomable key={f.id} file={f} onZoom={onZoom} />
          ))}
        </div>
      )}
    </>
  );
}

export function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [guide, setGuide] = useState<Content | null>(null),
    [files, setFiles] = useState<AttachmentFile[] | null>(null),
    [related, setRelated] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<LoadError | null>(null),
    [filesError, setFilesError] = useState(""),
    [revision, setRevision] = useState(0),
    [open, setOpen] = useState<Set<number> | null>(null),
    [zoom, setZoom] = useState<AttachmentFile | null>(null),
    [backHref, setBackHref] = useState("/knowledge");
  const closeRef = useRef<HTMLButtonElement>(null);

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
      setOpen(null);
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) {
          router.replace("/account");
          return;
        }
        const detail = await api<Content>(
          `/incidents/${encodeURIComponent(id)}`,
        );
        if (!active) return;
        setGuide(detail);
        const [attachments, same] = await Promise.allSettled([
          api<AttachmentFile[]>(
            `/content-versions/${detail.version_id}/attachments`,
          ),
          detail.process_id
            ? api<ContentPage>(
                `/incidents?processId=${encodeURIComponent(detail.process_id)}&pageSize=4`,
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
        setGuide(null);
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
                  "Hướng dẫn xử lý sự cố không tồn tại, chưa được duyệt hoặc bạn không có quyền xem.",
              }
            : status === 403
              ? {
                  kind: "forbidden",
                  message: e instanceof Error ? e.message : "Không đủ quyền.",
                }
              : {
                  kind: "error",
                  message:
                    e instanceof Error ? e.message : "Không tải được sự cố.",
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

  useEffect(() => {
    if (!zoom) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  function back(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (shouldGoBack(storage(LIBRARY_FROM_KEY), id, window.history.length)) {
      e.preventDefault();
      router.back();
    }
  }
  function leaveToRelated() {
    try {
      sessionStorage.removeItem(LIBRARY_FROM_KEY);
    } catch {}
  }

  const sections = guide ? articleSections(guide.body, files || []) : [];
  const expanded = open ?? defaultOpen(sections);
  const images = splitImages(files || [], sections);
  const strip = [images.cover, ...images.gallery].filter(
    (f): f is AttachmentFile => !!f,
  );
  const code = businessCode(guide?.code);
  const fileCount = files?.length ?? 0;
  const meta = guide
    ? ([
        [glyphs.user, "Người biên soạn", guide.author_name],
        [glyphs.dept, "Bộ phận", guide.department_name],
        [glyphs.process, "Công đoạn", guide.process_name],
        [glyphs.shield, "Người duyệt", guide.approver_name],
        [glyphs.calendar, "Ngày duyệt", day(guide.approved_at)],
      ].filter(([, , v]) => v) as [string, string, string][])
    : [];
  const compact = guide
    ? [
        guide.department_name,
        guide.approved_at && `Duyệt ${day(guide.approved_at)}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  function toggle(i: number) {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOpen(next);
  }

  return (
    <AppFrame
      user={user}
      path="/incidents"
      title="Chi tiết sự cố & giải pháp"
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
          <span>Giải pháp sự cố</span>
        </nav>

        {loading && !guide ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải sự cố"
          >
            <div />
            <div />
            <div />
            Đang tải sự cố và giải pháp…
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
                ? "Không tìm thấy sự cố"
                : loadError.kind === "forbidden"
                  ? "Bạn không có quyền xem sự cố này"
                  : "Không thể tải sự cố"}
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
        ) : guide ? (
          <div className={styles.layout}>
            <div className={styles.column}>
              <header className={`${styles.card} ${styles.head}`}>
                <div className={styles.top}>
                  <span className={styles.icon}>
                    <Glyph d={glyphs.alert} />
                  </span>
                  <div className={styles.headText}>
                    {code && <span className={styles.code}>{code}</span>}
                    <h1 id="incident-title">{guide.title}</h1>
                    <div className={styles.chips}>
                      <span className={styles.chipOk}>
                        <Icon name="check" />
                        Hướng dẫn đã duyệt
                      </span>
                      <span className={styles.chipVersion}>
                        v{guide.version_number}
                      </span>
                      <span className={styles.chipKind}>Giải pháp sự cố</span>
                      {guide.process_name && (
                        <span className={styles.chipProcess}>
                          {guide.process_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {strip.length > 0 && (
                  <div
                    className={styles.strip}
                    role="group"
                    aria-label="Hình ảnh sự cố"
                  >
                    {strip.map((f) => (
                      <Zoomable key={f.id} file={f} onZoom={setZoom} />
                    ))}
                  </div>
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

              {sections.length ? (
                <div className={styles.sections}>
                  {sections.map((s, i) => {
                    const kind = sectionKind(s.title);
                    const isOpen = expanded.has(i);
                    const hypothesis =
                      kind === "cause" && isHypothesis(s.title);
                    return (
                      <section
                        key={`${s.title}-${i}`}
                        className={`${styles.card} ${styles.section} ${styles[kind]}`}
                        data-open={isOpen}
                        aria-labelledby={`sec-${i}`}
                      >
                        <h2 id={`sec-${i}`}>
                          <span className={styles.kindIcon}>
                            <Glyph d={kindGlyph[kind]} />
                          </span>
                          <span className={styles.sectionTitle}>
                            {s.title}
                            {hypothesis && (
                              <small className={styles.chipHypothesis}>
                                Giả thuyết · chưa xác minh
                              </small>
                            )}
                          </span>
                          <button
                            type="button"
                            className={styles.toggle}
                            aria-expanded={isOpen}
                            aria-controls={`sec-body-${i}`}
                            aria-label={`${isOpen ? "Thu gọn" : "Mở rộng"} mục ${s.title}`}
                            onClick={() => toggle(i)}
                          >
                            <Glyph d={glyphs.chevron} />
                          </button>
                        </h2>
                        <div
                          id={`sec-body-${i}`}
                          className={styles.sectionBody}
                        >
                          <SectionBody section={s} onZoom={setZoom} />
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className={`${styles.card} ${styles.muted}`}>
                  Hướng dẫn này chưa có nội dung văn bản. Xem ảnh và tệp đính
                  kèm nếu có.
                </p>
              )}
            </div>

            <aside
              className={styles.side}
              aria-label="Trạng thái, tái diễn, tệp đính kèm và sự cố liên quan"
            >
              <section
                className={`${styles.card} ${styles.status}`}
                aria-labelledby="status-title"
              >
                <h2 id="status-title">Trạng thái duyệt &amp; xác minh</h2>
                <dl className={styles.kv}>
                  <div>
                    <dt>Hướng dẫn</dt>
                    <dd className={styles.okText}>
                      Đã duyệt · v{guide.version_number} hiện hành
                    </dd>
                  </div>
                  {guide.approver_name && (
                    <div>
                      <dt>Người duyệt</dt>
                      <dd>{guide.approver_name}</dd>
                    </div>
                  )}
                  {guide.approved_at && (
                    <div>
                      <dt>Ngày duyệt</dt>
                      <dd>{day(guide.approved_at)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Xác minh hiện trường</dt>
                    <dd className={styles.neutralText}>Chưa liên kết hồ sơ</dd>
                  </div>
                </dl>
                <p className={styles.muted}>
                  Nội dung đã được trưởng bộ phận duyệt để tra cứu. Hướng dẫn
                  này chưa liên kết với hồ sơ sự cố, nên chưa có người xác minh,
                  thời gian xác minh hay nguyên nhân đã xác minh tại hiện
                  trường.
                </p>
              </section>

              <section
                className={`${styles.card} ${styles.recurrence}`}
                aria-labelledby="recurrence-title"
              >
                <h2 id="recurrence-title">
                  <Glyph d={glyphs.repeat} />
                  Tái diễn
                </h2>
                <p className={styles.muted}>
                  Chưa có dữ liệu tái diễn liên kết với hướng dẫn này.
                </p>
                {user?.department_id ? (
                  <Link className={styles.action} href="/incidents/manage">
                    <Glyph d={glyphs.repeat} />
                    Ghi nhận tái diễn trong Hồ sơ sự cố
                  </Link>
                ) : (
                  <p className={styles.muted}>
                    Tài khoản chưa thuộc bộ phận nên không ghi nhận tái diễn
                    được.
                  </p>
                )}
              </section>

              <section
                className={`${styles.card} ${styles.files}`}
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
                    Hướng dẫn không có ảnh hay tệp đính kèm.
                  </p>
                )}
              </section>

              {related.length > 0 && (
                <section
                  className={`${styles.card} ${styles.related}`}
                  aria-labelledby="related-title"
                >
                  <h2 id="related-title">Sự cố cùng công đoạn</h2>
                  <ul>
                    {related.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/incidents/${r.id}`}
                          onClick={leaveToRelated}
                        >
                          <span className={styles.relatedIcon}>
                            <Glyph d={glyphs.alert} />
                          </span>
                          <span>
                            <b>{r.title}</b>
                            <small>
                              {[r.process_name, day(r.approved_at)]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        ) : null}

        {zoom && (
          <div
            className={styles.lightbox}
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh ${zoom.filename}`}
            onClick={() => setZoom(null)}
          >
            <button
              ref={closeRef}
              type="button"
              className={styles.close}
              aria-label="Đóng ảnh"
              onClick={() => setZoom(null)}
            >
              <Glyph d={glyphs.close} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- ACL-protected API file */}
            <img
              src={fileUrl(zoom)}
              alt={zoom.filename}
              onClick={(e) => e.stopPropagation()}
            />
            <p>{zoom.filename}</p>
          </div>
        )}
      </main>
    </AppFrame>
  );
}
