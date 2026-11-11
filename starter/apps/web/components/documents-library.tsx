"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ContentPage, type User } from "./api";
import { AppFrame } from "./app-frame";
import { Icon } from "./icon";
import {
  documentRows,
  filterDocuments,
  loadDocumentSnapshot,
  emptyFilters,
  readingLabels,
  type DocumentRecord,
  type ReadingTask,
  type DocumentRow,
  type Filters,
} from "./documents-model";
import styles from "./documents-library.module.css";

function date(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}
function ReadingBadge({ row }: { row: DocumentRow }) {
  return (
    <span className={`${styles.badge} ${styles[row.readingState]}`}>
      {readingLabels[row.readingState]}
    </span>
  );
}
export function DocumentsLibrary() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [documents, setDocuments] = useState<DocumentRecord[]>([]),
    [reading, setReading] = useState<ReadingTask[] | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [forbidden, setForbidden] = useState(false),
    [readingError, setReadingError] = useState(""),
    [revision, setRevision] = useState(0),
    [clock, setClock] = useState(0);
  const [filters, setFilters] = useState<Filters>(emptyFilters),
    [draft, setDraft] = useState(""),
    [page, setPage] = useState(1),
    [moreFilters, setMoreFilters] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setLoading(true);
      setError("");
      setReadingError("");
      setForbidden(false);
      setDocuments([]);
      setReading(null);
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) {
          router.replace("/account");
          return;
        }
        const [docs, tasks] = await Promise.allSettled([
          loadDocumentSnapshot((p) =>
            api<ContentPage>(`/documents?page=${p}&pageSize=100`),
          ),
          api<ReadingTask[]>("/my/reading"),
        ]);
        if (!active) return;
        if (docs.status === "rejected") throw docs.reason;
        if (
          tasks.status === "rejected" &&
          tasks.reason instanceof ApiError &&
          tasks.reason.status === 401
        ) {
          router.replace("/login");
          return;
        }
        setDocuments(docs.value);
        if (tasks.status === "fulfilled") setReading(tasks.value);
        else {
          setFilters((f) => ({ ...f, reading: "", required: "" }));
          setReadingError(
            "Không tải được trạng thái xác nhận đọc. Danh sách tài liệu vẫn có thể tra cứu.",
          );
        }
        setClock(Date.now());
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else {
          setForbidden(e instanceof ApiError && e.status === 403);
          setError(e instanceof Error ? e.message : "Không tải được tài liệu.");
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [router, revision]);
  const rows = documentRows(documents, reading, clock),
    filtered = filterDocuments(rows, filters);
  const pageSize = 5,
    pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    shown = filtered.slice((page - 1) * pageSize, page * pageSize);
  const departments = [
    ...new Map(
      documents.map((d) => [
        d.owner_department_id || "unknown",
        d.department_name || "Chưa có thông tin",
      ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  const versions = [...new Set(documents.map((d) => d.version_number))].sort(
    (a, b) => b - a,
  );
  const assigned = rows.filter((r) => r.task),
    acknowledged = assigned.filter(
      (r) => r.readingState === "ACKNOWLEDGED",
    ).length;
  const pending = rows.filter((r) => r.readingState === "PENDING").length,
    overdue = rows.filter((r) => r.readingState === "OVERDUE").length;
  const required = [...assigned].sort(
    (a, b) =>
      (a.readingState === "ACKNOWLEDGED" ? 1 : 0) -
        (b.readingState === "ACKNOWLEDGED" ? 1 : 0) ||
      (a.task!.due_at ? Date.parse(a.task!.due_at) : Infinity) -
        (b.task!.due_at ? Date.parse(b.task!.due_at) : Infinity),
  );
  function change<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  const extraActive = [
    filters.version,
    filters.publication,
    filters.required,
  ].filter(Boolean).length;
  function reset() {
    setFilters(emptyFilters);
    setDraft("");
    setPage(1);
  }
  return (
    <AppFrame
      user={user}
      path="/documents"
      title="Nội quy & Quy trình"
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
        <section className={styles.hero}>
          <div className={styles.heroIcon}>
            <Icon name="document" />
          </div>
          <div className={styles.heroText}>
            <h1>
              <span>Thư viện </span>nội quy & quy trình
            </h1>
            <p>Tra cứu tài liệu · Theo dõi phiên bản · Xác nhận đã đọc</p>
            <div className={styles.features}>
              <span>
                <Icon name="search" />
                Tra cứu nhanh
              </span>
              <span>
                <Icon name="document" />
                Phiên bản rõ ràng
              </span>
              <span>
                <Icon name="check" />
                Đúng nhiệm vụ đọc
              </span>
            </div>
          </div>
          <div className={styles.heroArt}>
            <Image
              src="/images/dashboard-demo/offset.webp"
              alt=""
              fill
              unoptimized
              priority
              sizes="45vw"
            />
          </div>
        </section>
        {loading ? (
          <div
            className={styles.loading}
            role="status"
            aria-busy="true"
            aria-label="Đang tải thư viện tài liệu"
          >
            <div />
            <div />
            <div />
            Đang tải tài liệu và nhiệm vụ đọc…
          </div>
        ) : error ? (
          <section className={styles.error} role="alert">
            <Icon name={forbidden ? "lock" : "incident"} />
            <h2>
              {forbidden
                ? "Bạn không có quyền xem danh sách này"
                : "Không thể tải tài liệu"}
            </h2>
            <p>{error}</p>
            <button onClick={() => setRevision((v) => v + 1)}>Thử lại</button>
            <Link href="/">Về Trang chủ</Link>
          </section>
        ) : (
          <>
            <div className={styles.layout}>
              <aside
                className={styles.overview}
                aria-label="Tổng quan tài liệu"
              >
                <h2>Tổng quan tài liệu</h2>
                {[
                  ["Tổng số tài liệu", documents.length, "", "document"],
                  [
                    "Chờ xác nhận",
                    reading === null ? "—" : pending,
                    "PENDING",
                    "clock",
                  ],
                  [
                    "Đã xác nhận",
                    reading === null ? "—" : acknowledged,
                    "ACKNOWLEDGED",
                    "check",
                  ],
                  [
                    "Quá hạn",
                    reading === null ? "—" : overdue,
                    "OVERDUE",
                    "incident",
                  ],
                ].map(([label, count, state, icon]) => (
                  <button
                    key={label}
                    disabled={reading === null && state !== ""}
                    onClick={() => change("reading", String(state))}
                    aria-pressed={filters.reading === state}
                  >
                    <span
                      className={`${styles.summaryIcon} ${styles[String(state) || "ALL"]}`}
                    >
                      <Icon name={String(icon)} />
                    </span>
                    <span>
                      <strong>{count}</strong>
                      <small>{label}</small>
                    </span>
                  </button>
                ))}
              </aside>
              <section
                className={styles.library}
                aria-label="Thư viện tài liệu"
              >
                <nav className={styles.tabs} aria-label="Loại tài liệu">
                  <button aria-current="page" onClick={reset}>
                    Tất cả <span>({documents.length})</span>
                  </button>
                  {["Nội quy", "Quy trình", "An toàn", "Biểu mẫu"].map(
                    (label) => (
                      <button
                        disabled
                        title="Chưa có dữ liệu phân loại tài liệu"
                        key={label}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </nav>
                <form
                  className={`filter-search ${styles.search}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    change("query", draft.trim());
                  }}
                >
                  <Icon name="search" />
                  <input
                    name="filter"
                    aria-label="Lọc theo tiêu đề"
                    placeholder="Tìm tên hoặc mã tài liệu…"
                    maxLength={200}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit">Tìm kiếm</button>
                </form>
                <div
                  id="document-filters"
                  className={styles.filters}
                  data-expanded={moreFilters}
                >
                  <label>
                    Bộ phận
                    <select
                      aria-label="Lọc bộ phận"
                      value={filters.department}
                      onChange={(e) => change("department", e.target.value)}
                    >
                      <option value="">Tất cả bộ phận</option>
                      {departments.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.extraFilter}>
                    Phiên bản
                    <select
                      aria-label="Lọc phiên bản"
                      value={filters.version}
                      onChange={(e) => change("version", e.target.value)}
                    >
                      <option value="">Tất cả phiên bản</option>
                      {versions.map((v) => (
                        <option key={v} value={v}>
                          v{v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.extraFilter}>
                    Trạng thái
                    <select
                      aria-label="Lọc trạng thái ban hành"
                      value={filters.publication}
                      onChange={(e) => change("publication", e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="APPROVED">Đã ban hành</option>
                      <option disabled>Hiệu lực: chưa có dữ liệu</option>
                    </select>
                  </label>
                  <label>
                    Xác nhận đọc
                    <select
                      aria-label="Lọc trạng thái đọc"
                      disabled={reading === null}
                      value={filters.reading}
                      onChange={(e) => change("reading", e.target.value)}
                    >
                      <option value="">Tất cả trạng thái đọc</option>
                      {Object.entries(readingLabels)
                        .filter(([k]) => k !== "UNKNOWN")
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className={styles.extraFilter}>
                    Yêu cầu đọc
                    <select
                      aria-label="Lọc yêu cầu đọc"
                      disabled={reading === null}
                      value={filters.required}
                      onChange={(e) => change("required", e.target.value)}
                    >
                      <option value="">Tất cả yêu cầu</option>
                      <option value="yes">Được giao cho tôi</option>
                      <option value="no">Không được giao</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.moreToggle}
                    aria-expanded={moreFilters}
                    aria-controls="document-filters"
                    onClick={() => setMoreFilters((v) => !v)}
                  >
                    {moreFilters ? "Thu gọn bộ lọc" : "Bộ lọc khác"}
                    {extraActive > 0 && ` (${extraActive})`}
                  </button>
                  <button
                    type="button"
                    className={styles.reset}
                    onClick={reset}
                  >
                    Xóa bộ lọc
                  </button>
                </div>
                <p className={styles.dataNote}>
                  Loại tài liệu và ngày hiệu lực chưa được cung cấp. Bộ phận
                  hiển thị là bộ phận phụ trách.
                </p>
                {readingError && (
                  <div className={styles.readingError} role="alert">
                    {readingError}
                    <button onClick={() => setRevision((v) => v + 1)}>
                      Tải lại trạng thái đọc
                    </button>
                  </div>
                )}
                <div className={styles.results} role="status">
                  {filtered.length} tài liệu phù hợp · Phiên bản đã ban hành
                  hiện hành
                </div>
                {shown.length ? (
                  <>
                    <div className={styles.tableWrap}>
                      <table>
                        <caption className={styles.srOnly}>
                          Danh sách tài liệu trong phạm vi được quyền xem
                        </caption>
                        <thead>
                          <tr>
                            <th>Mã tài liệu</th>
                            <th>Tên tài liệu</th>
                            <th>Bộ phận phụ trách</th>
                            <th>Phiên bản</th>
                            <th>Hiệu lực từ</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((row) => (
                            <tr key={row.document.id}>
                              <td>
                                <span
                                  className={styles.code}
                                  title={row.document.code}
                                >
                                  {row.document.code}
                                </span>
                              </td>
                              <td>
                                <Link
                                  className={styles.titleLink}
                                  href={`/documents/${row.document.id}`}
                                >
                                  <Icon name="document" />
                                  {row.document.title}
                                </Link>
                              </td>
                              <td>
                                {row.document.department_name ||
                                  "Chưa có thông tin"}
                              </td>
                              <td>
                                <span className={styles.version}>
                                  v{row.document.version_number}
                                </span>
                              </td>
                              <td>
                                <span title="Chưa có dữ liệu ngày hiệu lực">
                                  —
                                </span>
                                <small className={styles.dateNote}>
                                  Chưa cung cấp
                                </small>
                              </td>
                              <td className={styles.statusCell}>
                                <span
                                  className={`${styles.badge} ${styles.published}`}
                                >
                                  Đã ban hành
                                </span>
                                <ReadingBadge row={row} />
                                {row.task?.due_at && (
                                  <small className={styles.due}>
                                    Hạn: {date(row.task.due_at)}
                                  </small>
                                )}
                              </td>
                              <td>
                                <Link
                                  className={styles.view}
                                  href={`/documents/${row.document.id}`}
                                >
                                  Xem tài liệu
                                  <Icon name="arrow" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.mobileList}>
                      {shown.map((row) => (
                        <Link
                          className={`content-card ${styles.mobileCard}`}
                          key={row.document.id}
                          href={`/documents/${row.document.id}`}
                        >
                          <span
                            className={`${styles.docIcon} ${styles[row.readingState]}`}
                          >
                            <Icon name="document" />
                          </span>
                          <div>
                            <span
                              className={styles.code}
                              title={row.document.code}
                            >
                              {row.document.code}
                            </span>
                            <h2>{row.document.title}</h2>
                            <p>
                              v{row.document.version_number} ·{" "}
                              {row.document.department_name ||
                                "Chưa có bộ phận"}
                            </p>
                            <small>Hiệu lực: chưa có dữ liệu</small>
                            {row.task?.due_at && (
                              <small className={styles.due}>
                                Hạn: {date(row.task.due_at)}
                              </small>
                            )}
                          </div>
                          <span className={styles.cardStatus}>
                            <span
                              className={`${styles.badge} ${styles.published}`}
                            >
                              Đã ban hành
                            </span>
                            <ReadingBadge row={row} />
                            <Icon name="arrow" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={styles.empty}>
                    <Icon name="search" />
                    <h2>
                      {documents.length
                        ? "Không tìm thấy kết quả phù hợp."
                        : "Chưa có tài liệu được quyền xem."}
                    </h2>
                    <p>Thử thay đổi từ khóa hoặc bộ lọc.</p>
                    <button onClick={reset}>Xóa bộ lọc</button>
                  </div>
                )}
                <nav
                  className={styles.pagination}
                  aria-label="Phân trang tài liệu"
                >
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trang trước
                  </button>
                  <span>
                    Trang {page}/{pages}
                  </span>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Trang sau
                  </button>
                </nav>
              </section>
              <aside
                className={styles.mandatory}
                aria-label="Tài liệu bắt buộc của tôi"
              >
                <div className={styles.sectionTitle}>
                  <h2>Tài liệu bắt buộc của tôi</h2>
                  <button
                    disabled={reading === null}
                    onClick={() => change("required", "yes")}
                  >
                    Xem tất cả →
                  </button>
                </div>
                {reading === null ? (
                  <p>Chưa tải được nhiệm vụ đọc.</p>
                ) : assigned.length ? (
                  <>
                    <div className={styles.progress}>
                      <div
                        className={styles.ring}
                        style={{
                          background: `conic-gradient(var(--primary) ${(acknowledged / assigned.length) * 360}deg, #e8f1fb 0)`,
                        }}
                      >
                        <strong>
                          {acknowledged}/{assigned.length}
                        </strong>
                      </div>
                      <p>
                        Đã xác nhận {acknowledged}/{assigned.length} tài liệu
                        được giao
                      </p>
                    </div>
                    {required.map((row) => (
                      <Link
                        className={styles.requiredCard}
                        key={row.document.id}
                        href={`/documents/${row.document.id}`}
                      >
                        <span
                          className={`${styles.docIcon} ${styles[row.readingState]}`}
                        >
                          <Icon name="document" />
                        </span>
                        <div>
                          <b>{row.document.title}</b>
                          <small>v{row.document.version_number}</small>
                          <ReadingBadge row={row} />
                          {row.task?.due_at && (
                            <small className={styles.due}>
                              Hạn: {date(row.task.due_at)}
                            </small>
                          )}
                        </div>
                        <Icon name="arrow" />
                      </Link>
                    ))}
                  </>
                ) : (
                  <p>Chưa có tài liệu bắt buộc được giao.</p>
                )}
                <small className={styles.assignmentNote}>
                  Mở tài liệu để đọc và xác nhận đúng phiên bản. Lịch sử cũ được
                  giữ nguyên.
                </small>
              </aside>
            </div>
          </>
        )}
        <footer className={styles.footer}>
          Tri Thức JKC · Môi trường DEMO
        </footer>
      </main>
    </AppFrame>
  );
}
