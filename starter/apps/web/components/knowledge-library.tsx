"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  ApiError,
  type Content,
  type ContentPage,
  type Dashboard,
  type User,
} from "./api";
import { AppFrame } from "./app-frame";
import { Icon } from "./icon";
import {
  activeFilterCount,
  applyFilters,
  defaultState,
  detailHref,
  excerpt,
  kindLabels,
  lacksDiacritics,
  loadAll,
  readState,
  sortLabels,
  thumbnail,
  writeState,
  type KnowledgeKind,
  type KnowledgeState,
  type Sort,
} from "./knowledge-model";
import styles from "./knowledge-library.module.css";

type Process = Dashboard["processes"][number];
type Failure = { kind: "forbidden" | "error"; message: string };
const DEBOUNCE_MS = 350;
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
  close: "M6 6l12 12M18 6 6 18",
  filter: "M3 5h18l-7 8v6l-4 2v-8Z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  lock: "M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  check: "M20 6 9 17l-5-5",
  share: "M12 5v14M5 12h14",
};

export function KnowledgeLibrary() {
  const router = useRouter();
  // Seed from the live URL (not server props): after Back the router cache may hold stale props.
  const params = useSearchParams();
  const [state, setState] = useState<KnowledgeState>(() =>
    readState(new URLSearchParams(params.toString())),
  );
  const [draft, setDraft] = useState(state.q);
  const [user, setUser] = useState<User | null>(null),
    [processes, setProcesses] = useState<Process[]>([]),
    [items, setItems] = useState<Content[] | null>(null),
    [recent, setRecent] = useState<Content[] | null>(null),
    [failure, setFailure] = useState<Failure | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [sheet, setSheet] = useState(false);
  const request = useRef(0);
  const sheetButton = useRef<HTMLButtonElement>(null);

  // Session, processes and "mới cập nhật" side list: once.
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        if (me.must_change_password) {
          router.replace("/account");
          return;
        }
        setUser(me);
        const [proc, latest] = await Promise.allSettled([
          api<Process[]>("/processes"),
          api<ContentPage>("/articles?pageSize=5"),
        ]);
        if (!active) return;
        if (proc.status === "fulfilled") setProcesses(proc.value);
        setRecent(latest.status === "fulfilled" ? latest.value.items : []);
      } catch (e) {
        if (active && e instanceof ApiError && e.status === 401)
          router.replace("/login");
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  // Debounce typing; submitting commits immediately.
  useEffect(() => {
    if (draft.trim() === state.q) return;
    const t = setTimeout(
      () => setState((s) => ({ ...s, q: draft.trim(), page: 1 })),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [draft, state.q]);

  // Server-side filters (q, process) -> fetch full snapshot of articles + incident guides.
  useEffect(() => {
    const id = ++request.current;
    const controller = new AbortController();
    Promise.resolve().then(async () => {
      setLoading(true);
      setFailure(null);
      const query = (endpoint: string) => (page: number) =>
        api<ContentPage>(
          `${endpoint}?q=${encodeURIComponent(state.q)}&page=${page}&pageSize=100${state.process ? `&processId=${encodeURIComponent(state.process)}` : ""}`,
          { signal: controller.signal },
        );
      try {
        const [articles, incidents] = await Promise.all([
          loadAll(query("/articles")),
          loadAll(query("/incidents")),
        ]);
        if (id !== request.current) return; // newer search already started
        setItems([...articles, ...incidents]);
      } catch (e) {
        if (id !== request.current || controller.signal.aborted) return;
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setItems(null);
        setFailure(
          e instanceof ApiError && e.status === 403
            ? { kind: "forbidden", message: e.message }
            : {
                kind: "error",
                message:
                  e instanceof Error && e.message
                    ? e.message
                    : "Không thể kết nối hệ thống.",
              },
        );
      } finally {
        if (id === request.current) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [state.q, state.process, revision, router]);

  // Keep URL in sync (shareable links, Back from an article restores the list).
  useEffect(() => {
    const qs = writeState(state);
    const next = `/knowledge${qs ? `?${qs}` : ""}`;
    // Native history API is supported by the App Router and avoids a server round trip.
    if (`${window.location.pathname}${window.location.search}` !== next)
      window.history.replaceState(window.history.state, "", next);
  }, [state]);

  // Escape closes the mobile filter sheet.
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const result = useMemo(
    () => (items ? applyFilters(items, state) : null),
    [items, state],
  );
  const departments = useMemo(
    () =>
      [
        ...new Map(
          (items || []).map((i) => [
            i.owner_department_id || "unknown",
            i.department_name || "Chưa có thông tin",
          ]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "vi")),
    [items],
  );
  const processCode = useMemo(
    () => new Map(processes.map((p) => [p.id, p.code])),
    [processes],
  );
  const canCreate = !!user?.department_id;
  const filters = activeFilterCount(state);
  const searching = !!state.q;
  const pending = draft.trim() !== state.q;

  function update(patch: Partial<KnowledgeState>) {
    setState((s) => ({ ...s, page: 1, ...patch }));
  }
  function submit(value: string) {
    setDraft(value);
    update({ q: value.trim() });
  }
  function clearAll() {
    setDraft("");
    setState((s) => ({ ...defaultState, view: s.view }));
  }
  function closeSheet() {
    setSheet(false);
    sheetButton.current?.focus();
  }

  const selects = (
    <>
      <label>
        Công đoạn
        <select
          aria-label="Lọc công đoạn"
          value={state.process}
          onChange={(e) => update({ process: e.target.value })}
        >
          <option value="">Tất cả</option>
          {processes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bộ phận
        <select
          aria-label="Lọc bộ phận"
          value={state.department}
          onChange={(e) => update({ department: e.target.value })}
        >
          <option value="">Tất cả</option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          {state.department &&
            !departments.some(([id]) => id === state.department) && (
              <option value={state.department}>Bộ phận đã chọn</option>
            )}
        </select>
      </label>
      <label className={styles.unavailable}>
        Thiết bị
        <select disabled aria-label="Lọc thiết bị (chưa có dữ liệu)">
          <option>Chưa có</option>
        </select>
      </label>
      <label className={styles.unavailable}>
        Thẻ
        <select disabled aria-label="Lọc thẻ (chưa có dữ liệu)">
          <option>Chưa có</option>
        </select>
      </label>
    </>
  );

  return (
    <AppFrame
      user={user}
      path="/knowledge"
      title="Kho tri thức"
      onSearch={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget).get("q")?.toString() || "");
      }}
    >
      <main id="main" className={styles.main}>
        <p className={styles.demo}>
          Môi trường DEMO · Nội dung minh họa, chưa dùng làm hướng dẫn vận hành.
        </p>
        <section className={styles.hero}>
          <div className={styles.heroIcon} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className={styles.heroText}>
            <h1>Kho tri thức</h1>
            <p>Tìm kinh nghiệm – hướng dẫn – bài học thực tế đã được duyệt.</p>
            <small>Chia sẻ để làm tốt hơn mỗi ngày.</small>
          </div>
          <div className={styles.heroArt}>
            <Image
              src="/images/dashboard-demo/offset.webp"
              alt=""
              fill
              unoptimized
              priority
              sizes="40vw"
            />
          </div>
        </section>

        <div className={styles.layout}>
          <section className={styles.library} aria-label="Kết quả tri thức">
            <form
              role="search"
              className={styles.search}
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
            >
              <Icon name="search" />
              <input
                type="search"
                name="knowledge-q"
                aria-label="Từ khóa tìm tri thức"
                placeholder="Tìm theo tiêu đề, ví dụ: lệch màu"
                maxLength={200}
                value={draft}
                enterKeyHint="search"
                onChange={(e) => setDraft(e.target.value)}
              />
              {draft && (
                <button
                  type="button"
                  className={styles.clearQuery}
                  aria-label="Xóa từ khóa"
                  onClick={() => submit("")}
                >
                  <Glyph d={glyphs.close} />
                </button>
              )}
              <button type="submit" className={styles.searchButton}>
                Tìm kiếm
              </button>
            </form>
            {canCreate && (
              <Link className={styles.share} href="/knowledge/new">
                <Glyph d={glyphs.share} />
                Chia sẻ kiến thức
              </Link>
            )}

            <div className={styles.toolbar}>
              <div
                className={styles.chips}
                role="group"
                aria-label="Loại kiến thức"
              >
                {(
                  [
                    ["", "Tất cả"],
                    ["ARTICLE", kindLabels.ARTICLE],
                    ["INCIDENT_GUIDE", kindLabels.INCIDENT_GUIDE],
                  ] as ["" | KnowledgeKind, string][]
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={state.type === value}
                    onClick={() => update({ type: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className={styles.filters}>{selects}</div>
              <button
                ref={sheetButton}
                type="button"
                className={styles.sheetButton}
                aria-haspopup="dialog"
                aria-expanded={sheet}
                onClick={() => setSheet(true)}
              >
                <Glyph d={glyphs.filter} />
                Bộ lọc{filters ? ` (${filters})` : ""}
              </button>
            </div>

            <div className={styles.resultBar}>
              <p role="status" aria-live="polite" className={styles.count}>
                {loading || pending
                  ? "Đang tìm…"
                  : result
                    ? searching
                      ? `Tìm thấy ${result.total} kết quả cho “${state.q}”`
                      : `${result.total} bài đã duyệt`
                    : ""}
              </p>
              <div className={styles.resultTools}>
                {(filters > 0 || searching) && (
                  <button
                    type="button"
                    className={styles.clearAll}
                    onClick={clearAll}
                  >
                    Xóa bộ lọc
                  </button>
                )}
                <label className={styles.sort}>
                  Sắp xếp
                  <select
                    aria-label="Sắp xếp"
                    value={state.sort}
                    onChange={(e) => update({ sort: e.target.value as Sort })}
                  >
                    {Object.entries(sortLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <div
                  className={styles.viewToggle}
                  role="group"
                  aria-label="Kiểu hiển thị"
                >
                  <button
                    type="button"
                    aria-label="Dạng danh sách"
                    aria-pressed={state.view === "list"}
                    onClick={() => setState((s) => ({ ...s, view: "list" }))}
                  >
                    <Glyph d={glyphs.list} />
                  </button>
                  <button
                    type="button"
                    aria-label="Dạng lưới"
                    aria-pressed={state.view === "grid"}
                    onClick={() => setState((s) => ({ ...s, view: "grid" }))}
                  >
                    <Glyph d={glyphs.grid} />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div
                className={styles.loading}
                role="status"
                aria-busy="true"
                aria-label="Đang tải kho tri thức"
              >
                <div />
                <div />
                <div />
              </div>
            ) : failure ? (
              <div className={styles.state} role="alert">
                <span className={styles.stateIcon}>
                  <Glyph
                    d={
                      failure.kind === "forbidden" ? glyphs.lock : glyphs.alert
                    }
                  />
                </span>
                <h2>
                  {failure.kind === "forbidden"
                    ? "Bạn không có quyền xem kho tri thức"
                    : "Không thể tải kho tri thức"}
                </h2>
                <p>{failure.message}</p>
                {failure.kind === "error" && (
                  <button
                    type="button"
                    onClick={() => setRevision((n) => n + 1)}
                  >
                    Thử lại
                  </button>
                )}
              </div>
            ) : result && result.total === 0 ? (
              <div className={styles.state}>
                <span className={styles.stateIcon}>
                  <Icon name="search" />
                </span>
                {searching || filters ? (
                  <>
                    <h2>Không tìm thấy kết quả phù hợp.</h2>
                    <p>
                      Thử từ khóa khác hoặc bỏ bớt bộ lọc.
                      {lacksDiacritics(state.q) &&
                        " Tìm kiếm hiện phân biệt dấu tiếng Việt: hãy thử gõ có dấu (ví dụ “lệch màu”)."}
                    </p>
                    <button type="button" onClick={clearAll}>
                      Xóa bộ lọc
                    </button>
                  </>
                ) : (
                  <>
                    <h2>Chưa có bài tri thức được duyệt</h2>
                    <p>
                      Bài viết sẽ xuất hiện sau khi trưởng bộ phận phê duyệt.
                    </p>
                  </>
                )}
                {canCreate && (
                  <Link href="/knowledge/new">Chia sẻ kiến thức</Link>
                )}
              </div>
            ) : result ? (
              <>
                <ul
                  aria-label="Danh sách kết quả"
                  className={`${styles.results} ${state.view === "grid" ? styles.grid : ""}`}
                  aria-busy={loading}
                  data-stale={loading || pending}
                >
                  {result.items.map((item) => (
                    <li key={item.id}>
                      <Link className={styles.card} href={detailHref(item)}>
                        <span className={styles.thumb}>
                          <Image
                            src={thumbnail(
                              item.process_id
                                ? processCode.get(item.process_id)
                                : undefined,
                              item.kind,
                            )}
                            alt=""
                            fill
                            unoptimized
                            sizes="180px"
                          />
                          <small>Ảnh minh họa</small>
                        </span>
                        <span className={styles.cardBody}>
                          <span className={styles.cardHead}>
                            <h2>{item.title}</h2>
                            <span className={styles.approved}>
                              <Glyph d={glyphs.check} />
                              Đã duyệt
                            </span>
                          </span>
                          {excerpt(item.body) && (
                            <span className={styles.excerpt}>
                              {excerpt(item.body)}
                            </span>
                          )}
                          <span className={styles.tags}>
                            <span className={styles.tagKind}>
                              {kindLabels[item.kind as KnowledgeKind] ||
                                item.kind}
                            </span>
                            {item.process_name && (
                              <span className={styles.tagProcess}>
                                {item.process_name}
                              </span>
                            )}
                            {item.department_name && (
                              <span className={styles.tagDept}>
                                {item.department_name}
                              </span>
                            )}
                          </span>
                          <span className={styles.meta}>
                            <span className={styles.author}>
                              <span
                                className={styles.avatar}
                                aria-hidden="true"
                              >
                                {(item.author_name || "?")
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                              <span>
                                <small>Người chia sẻ</small>
                                {item.author_name || "Chưa có thông tin"}
                              </span>
                            </span>
                            <span className={styles.date}>
                              <Icon name="clock" />
                              {item.approved_at
                                ? `Duyệt ${day(item.approved_at)}`
                                : `Cập nhật ${day(item.created_at)}`}
                            </span>
                            <span className={styles.version}>
                              v{item.version_number}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {result.pages > 1 && (
                  <nav className={styles.pagination} aria-label="Phân trang">
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
            ) : null}
          </section>

          <aside className={styles.side} aria-label="Gợi ý">
            <section className={styles.recent}>
              <div className={styles.sideTitle}>
                <h2>Mới được duyệt</h2>
              </div>
              {recent === null ? (
                <p className={styles.muted}>Đang tải…</p>
              ) : recent.length ? (
                <ul>
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={detailHref(r)}>
                        <span className={styles.recentThumb}>
                          <Image
                            src={thumbnail(
                              r.process_id
                                ? processCode.get(r.process_id)
                                : undefined,
                              r.kind,
                            )}
                            alt=""
                            fill
                            unoptimized
                            sizes="72px"
                          />
                        </span>
                        <span>
                          <b>{r.title}</b>
                          <small>
                            {r.process_name || "Chưa gắn công đoạn"} ·{" "}
                            {day(r.approved_at || r.created_at)}
                          </small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>Chưa có bài được duyệt.</p>
              )}
              <small className={styles.muted}>
                Xếp theo thời điểm duyệt. Chưa có số liệu lượt xem để xếp “nổi
                bật”.
              </small>
            </section>
            <section className={styles.cta}>
              <span className={styles.ctaIcon} aria-hidden="true">
                <Glyph d={glyphs.share} />
              </span>
              <h2>Không tìm thấy?</h2>
              <p>
                {canCreate
                  ? "Chia sẻ kinh nghiệm của bạn để đồng nghiệp tra cứu sau khi được duyệt."
                  : "Liên hệ trưởng bộ phận để bổ sung bài tri thức."}
              </p>
              {canCreate && (
                <Link href="/knowledge/new">Chia sẻ kiến thức →</Link>
              )}
            </section>
          </aside>
        </div>

        {sheet && (
          <div className={styles.sheetBackdrop} onClick={closeSheet}>
            <div
              className={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby="sheet-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.sheetHead}>
                <h2 id="sheet-title">Bộ lọc</h2>
                <button
                  type="button"
                  aria-label="Đóng bộ lọc"
                  autoFocus
                  onClick={closeSheet}
                >
                  <Glyph d={glyphs.close} />
                </button>
              </div>
              <div className={styles.sheetBody}>{selects}</div>
              <div className={styles.sheetActions}>
                <button type="button" onClick={clearAll}>
                  Xóa bộ lọc
                </button>
                <button
                  type="button"
                  className={styles.apply}
                  onClick={closeSheet}
                >
                  Xem {result ? result.total : ""} kết quả
                </button>
              </div>
            </div>
          </div>
        )}
        <footer className={styles.footer}>
          Tri Thức JKC · Môi trường DEMO
        </footer>
      </main>
    </AppFrame>
  );
}
