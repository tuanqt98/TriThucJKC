"use client";
// UI-08 · Đào tạo / Khóa học của tôi (/learning), mockup 07.
// Only courses assigned to this account (GET /my/learning, server-side scope); statuses and lesson counts come
// from the backend. Recent results read each assignment's own attempts (GET /my/learning/{id}).
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, type User } from "./api";
import { AppFrame } from "./app-frame";
import {
  counts,
  ctaLabel,
  day,
  filterCourses,
  isStatus,
  labelOf,
  progress,
  recentResults,
  resultCandidates,
  score,
  STATUS_ORDER,
  statusLabel,
  upcoming,
  type CourseDetail,
  type LearningItem,
  type LearningStatus,
  type RecentResult,
} from "./learning-model";
import styles from "./my-courses.module.css";

// No "recent attempts" endpoint yet (DATA-34): read at most this many course details.
const DETAIL_LIMIT = 30;
const expired = "/login?reason=session-expired";

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
  course: "m2 8 10-5 10 5-10 5ZM6 10v7q6 5 12 0v-7M22 8v9",
  play: "M8 5v14l11-7Z",
  check: "m5 12 4 4L19 6",
  clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  alert: "M12 3 2 21h20ZM12 10v5M12 18h.01",
  calendar: "M4 5h16v16H4ZM4 10h16M9 3v4M15 3v4",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  quiz: "M9 3h6v3H9ZM8 4H5v18h14V4h-3M8 12h8M8 16h5",
};
const statGlyph: Record<string, string> = {
  NOT_STARTED: glyphs.course,
  IN_PROGRESS: glyphs.play,
  COMPLETED: glyphs.check,
  OVERDUE: glyphs.clock,
};

export function MyCourses() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"" | LearningStatus>(() => {
    const s = params.get("status") || "";
    return isStatus(s) ? s : "";
  });
  const [q, setQ] = useState(() => (params.get("q") || "").slice(0, 200));
  const [user, setUser] = useState<User | null>(null),
    [items, setItems] = useState<LearningItem[] | null>(null),
    [results, setResults] = useState<RecentResult[] | null>(null),
    [resultsError, setResultsError] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      setError("");
      setItems(null);
      setResults(null);
      setResultsError(false);
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password) return router.replace("/account");
        const list = await api<LearningItem[]>("/my/learning");
        if (!active) return;
        setItems(list);
        const settled = await Promise.allSettled(
          resultCandidates(list, DETAIL_LIMIT).map(async (i) => ({
            id: i.id,
            detail: await api<CourseDetail>(`/my/learning/${i.id}`),
          })),
        );
        if (!active) return;
        const ok = settled.flatMap((s) =>
          s.status === "fulfilled" ? [s.value] : [],
        );
        setResultsError(ok.length < settled.length);
        setResults(recentResults(ok));
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
  }, [router, revision]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    const next = `/learning${p.toString() ? `?${p}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== next)
      window.history.replaceState(window.history.state, "", next);
  }, [status, q]);

  const all = items || [];
  const c = counts(all);
  const shown = filterCourses(all, status, q);
  const soon = upcoming(all);

  return (
    <AppFrame
      user={user}
      path="/learning"
      title="Khóa học của tôi"
      onSearch={(e) => {
        e.preventDefault();
        router.push(
          `/knowledge?q=${encodeURIComponent(new FormData(e.currentTarget).get("q")?.toString() || "")}`,
        );
      }}
    >
      <main id="main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div>
            <p className={styles.eyebrow}>Khóa học của tôi</p>
            <h1 id="hero-title">
              Học hôm nay
              <br />
              vững tay nghề, in chất lượng hơn!
            </h1>
            <p>
              Các khóa học được giao theo vị trí công việc · Nâng cao kỹ năng ·
              Đảm bảo chất lượng sản phẩm
            </p>
          </div>
          <Image
            src="/images/dashboard-demo/prepress.webp"
            alt=""
            width={520}
            height={300}
            priority
            className={styles.heroImage}
          />
        </section>

        <div
          className={styles.stats}
          role="group"
          aria-label="Thống kê khóa học"
        >
          {(
            [
              "NOT_STARTED",
              "IN_PROGRESS",
              "COMPLETED",
              "OVERDUE",
            ] as LearningStatus[]
          ).map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.stat} ${styles[s]}`}
              aria-pressed={status === s}
              onClick={() => setStatus(status === s ? "" : s)}
            >
              <span className={styles.statIcon}>
                <Glyph d={statGlyph[s]} />
              </span>
              <span>
                <small>{statusLabel[s]}</small>
                <b>{items ? c[s] : "–"}</b>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.layout}>
          <div className={styles.column}>
            <div className={styles.toolbar}>
              <div
                className={styles.tabs}
                role="group"
                aria-label="Lọc theo trạng thái học"
              >
                {(["", ...STATUS_ORDER] as ("" | LearningStatus)[])
                  .filter(
                    (s) =>
                      s !== "FAILED" || c.FAILED > 0 || status === "FAILED",
                  )
                  .map((s) => (
                    <button
                      key={s || "all"}
                      type="button"
                      aria-pressed={status === s}
                      onClick={() => setStatus(s)}
                    >
                      {s ? statusLabel[s] : "Được giao"} (
                      {s ? c[s] : all.length})
                    </button>
                  ))}
              </div>
              <label className={styles.search}>
                <Glyph d={glyphs.search} />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm khóa học được giao…"
                  aria-label="Tìm khóa học được giao"
                />
              </label>
            </div>

            {error ? (
              <section className={styles.state} role="alert">
                <Glyph d={glyphs.alert} />
                <h2>Không tải được khóa học</h2>
                <p>{error}</p>
                <button type="button" onClick={() => setRevision((n) => n + 1)}>
                  Thử lại
                </button>
              </section>
            ) : items === null ? (
              <div
                className={styles.loading}
                role="status"
                aria-busy="true"
                aria-label="Đang tải khóa học"
              >
                <div />
                <div />
                <div />
                Đang tải khóa học…
              </div>
            ) : !all.length ? (
              <section className={styles.state}>
                <h2>Bạn chưa được giao khóa học nào</h2>
                <p>
                  Khi trưởng bộ phận giao khóa học, khóa học sẽ hiện ở đây kèm
                  thời hạn hoàn thành.
                </p>
              </section>
            ) : !shown.length ? (
              <section className={styles.state}>
                <h2>Không có khóa học phù hợp</h2>
                <p>Thử chọn trạng thái khác hoặc xóa từ khóa.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("");
                    setQ("");
                  }}
                >
                  Xóa bộ lọc
                </button>
              </section>
            ) : (
              <ul className={styles.list} aria-label="Danh sách khóa học">
                {shown.map((i) => {
                  const p = progress(i);
                  const overdue = i.status === "OVERDUE";
                  return (
                    <li
                      key={i.id}
                      className={styles.card}
                      data-status={i.status}
                    >
                      <span className={styles.thumb} aria-hidden="true">
                        <Glyph d={glyphs.course} />
                      </span>
                      <div className={styles.cardBody}>
                        <div className={styles.cardHead}>
                          <h2>{i.title}</h2>
                          <span
                            className={`${styles.badge} ${styles[i.status] || ""}`}
                          >
                            {labelOf(i.status)}
                          </span>
                        </div>
                        <p className={styles.meta}>
                          <span>Phiên bản v{i.version_number}</span>
                          {i.due_at && (
                            <span className={overdue ? styles.late : ""}>
                              <Glyph d={glyphs.calendar} />
                              Hạn: {day(i.due_at)}
                            </span>
                          )}
                          {i.completed_at && (
                            <span className={styles.done}>
                              <Glyph d={glyphs.check} />
                              Hoàn thành {day(i.completed_at)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className={styles.progressBox}>
                        {p ? (
                          <>
                            <div className={styles.progressLabel}>
                              <span>
                                {p.done}/{p.total} bài học
                              </span>
                              <b>{p.percent}%</b>
                            </div>
                            <div
                              className={styles.bar}
                              role="progressbar"
                              aria-label={`Tiến độ ${i.title}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={p.percent}
                            >
                              <span style={{ width: `${p.percent}%` }} />
                            </div>
                          </>
                        ) : (
                          <p className={styles.muted}>
                            Khóa học chưa có bài học
                          </p>
                        )}
                        <Link
                          className={
                            i.status === "COMPLETED" || i.status === "FAILED"
                              ? styles.secondary
                              : styles.primary
                          }
                          href={`/learning/${i.id}`}
                        >
                          {ctaLabel(i)}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside
            className={styles.side}
            aria-label="Hạn hoàn thành và kết quả kiểm tra"
          >
            <section className={styles.panel} aria-labelledby="due-title">
              <h2 id="due-title">Hạn hoàn thành sắp tới</h2>
              {items === null ? (
                <p className={styles.muted}>Đang tải…</p>
              ) : soon.length ? (
                <ul className={styles.due}>
                  {soon.map((i) => {
                    const d = new Date(i.due_at!);
                    return (
                      <li key={i.id}>
                        <span
                          className={styles.date}
                          data-late={i.status === "OVERDUE"}
                        >
                          <b>
                            {d.toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              timeZone: "Asia/Ho_Chi_Minh",
                            })}
                          </b>
                          <small>
                            Th
                            {d.toLocaleDateString("vi-VN", {
                              month: "2-digit",
                              timeZone: "Asia/Ho_Chi_Minh",
                            })}
                          </small>
                        </span>
                        <Link href={`/learning/${i.id}`}>
                          <b>{i.title}</b>
                          <small>
                            {labelOf(i.status)} · Hạn {day(i.due_at)}
                          </small>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={styles.muted}>
                  Không có khóa học nào đang có hạn hoàn thành.
                </p>
              )}
            </section>
            <section className={styles.panel} aria-labelledby="results-title">
              <h2 id="results-title">Kết quả kiểm tra gần đây</h2>
              {results === null && !error ? (
                <p className={styles.muted}>Đang tải…</p>
              ) : results && results.length ? (
                <ul className={styles.results}>
                  {results.map((r) => (
                    <li key={r.id}>
                      <span
                        className={styles.resultIcon}
                        data-passed={!!r.passed}
                      >
                        <Glyph d={r.passed ? glyphs.check : glyphs.quiz} />
                      </span>
                      <Link href={`/learning/${r.assignmentId}`}>
                        <b>{r.title}</b>
                        <small>
                          Lần {r.attempt_no} · {day(r.submitted_at)} ·{" "}
                          {r.passed ? "Đạt" : "Chưa đạt"}
                        </small>
                      </Link>
                      <strong data-passed={!!r.passed}>
                        {score(r.score)}
                        <small>/100</small>
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>Chưa có lần nộp bài kiểm tra.</p>
              )}
              {resultsError && (
                <p className={styles.muted}>
                  Một số khóa học chưa tải được kết quả.
                </p>
              )}
            </section>
          </aside>
        </div>
      </main>
    </AppFrame>
  );
}
