"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type Dashboard,
  type User,
  type Content,
  type ContentPage,
  type Learning,
  type Approval,
} from "./api";
import { Icon } from "./icon";
import styles from "./dashboard-fidelity.module.css";

type Reading = {
  id: string;
  content_id: string;
  title: string;
  acknowledged_at: string | null;
  due_at: string | null;
  is_current: boolean;
  version_number: number;
};
type Task = {
  id: string;
  title: string;
  category: string;
  href: string;
  due: string | null;
  icon: string;
};
export function PrintIllustration({ code = "OFFSET" }: { code?: string }) {
  return (
    <svg viewBox="0 0 200 100" fill="none" aria-hidden="true">
      <ellipse cx="100" cy="88" rx="80" ry="7" fill="#103958" opacity=".1" />
      {code === "PREPRESS" ? (
        <>
          <rect x="50" y="8" width="100" height="65" rx="5" fill="#183d60" />
          <rect x="56" y="14" width="88" height="51" rx="2" fill="#b6e7f3" />
          <path d="m56 58 29-35 28 24 31-32v50H56Z" fill="#ec37a3" />
          <path d="m56 63 35-15 53 17H56Z" fill="#ffc83d" />
          <path d="M94 73h12v12h20v4H74v-4h20Z" fill="#637f93" />
        </>
      ) : code === "FLEXO" ? (
        <>
          <path d="m48 43 46-17 45 17-45 18Z" fill="#e7bf78" />
          <path d="M48 43v38l46 10V61Z" fill="#c6a369" />
          <path d="m94 61 45-18v38L94 91Z" fill="#dfb875" />
          <path d="m71 35 45 18 1 15-14 5V58L60 39Z" fill="#f4d498" />
          <circle cx="153" cy="67" r="20" fill="#c99e50" />
          <circle cx="153" cy="67" r="8" fill="#243e50" />
          <circle cx="30" cy="68" r="15" fill="#e8c875" />
          <circle cx="30" cy="68" r="6" fill="#243e50" />
        </>
      ) : (
        <>
          <path d="M26 47 57 29h100l20 15v38H26Z" fill="#7199ad" />
          <path d="M26 47h151v35H26Z" fill="#375e77" />
          <path d="M38 39h105v28H38Z" fill="#b9d8df" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect
                x={43 + i * 29}
                y={code === "FINISHING" ? 30 : 20}
                width="24"
                height={code === "FINISHING" ? 39 : 49}
                rx="3"
                fill={
                  code === "FINISHING"
                    ? "#e1a652"
                    : code === "DIGITAL"
                      ? "#8caab8"
                      : "#2e6484"
                }
              />
              <rect
                x={48 + i * 29}
                y="27"
                width="14"
                height="21"
                rx="1"
                fill="#d9eced"
              />
              <circle cx={55 + i * 29} cy="57" r="4" fill="#173c56" />
            </g>
          ))}
          <path d="M18 66h23v13H18ZM145 62h37v17h-37Z" fill="#a2bac6" />
          <path d="M48 82v7m103-7v7" stroke="#203b50" strokeWidth="6" />
          <path d="m159 39 18 5v15h-18Z" fill="#aee4ed" />
        </>
      )}
    </svg>
  );
}
export function DashboardHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroSymbol} aria-hidden="true" />
      <div className={styles.heroText}>
        <h1>
          Chào anh/chị,
          <br />
          hôm nay bạn cần gì?
        </h1>
        <p>
          Tra cứu quy trình · Học hỏi kinh nghiệm · Giải quyết sự cố · Cùng nhau
          phát triển
        </p>
      </div>
      <div className={styles.heroArt}>
        <PrintIllustration />
        <span>
          Tri thức hôm nay
          <br />
          Chất lượng ngày mai
        </span>
      </div>
    </section>
  );
}
function href(item: Content) {
  return `${item.kind === "DOCUMENT" ? "/documents" : item.kind === "INCIDENT_GUIDE" ? "/incidents" : "/knowledge"}/${item.id}`;
}
function date(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}
function Featured({ item, index }: { item: Content; index: number }) {
  return (
    <Link className={styles.card} href={href(item)}>
      <div className={`${styles.cardArt} ${styles[`art${index % 3}`]}`}>
        <PrintIllustration
          code={
            index % 3 === 1 ? "PREPRESS" : index % 3 === 2 ? "FLEXO" : "OFFSET"
          }
        />
        <span>Minh họa DEMO</span>
      </div>
      <div className={styles.cardBody}>
        <h3>{item.title}</h3>
        <div className={styles.tags}>
          <span>{item.department_name || "Toàn công ty"}</span>
          <span>Đã duyệt · v{item.version_number}</span>
        </div>
        <small>
          <Icon name="clock" />
          Ngày tạo: {date(item.created_at)}
        </small>
      </div>
    </Link>
  );
}
export function DashboardFidelity({
  data,
  user,
}: {
  data: Dashboard;
  user: User;
}) {
  const router = useRouter();
  const [clock, setClock] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]),
    [documents, setDocuments] = useState<Content[]>([]),
    [loading, setLoading] = useState(true),
    [errors, setErrors] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const head = user.roles.some(
    (r) => r.code === "DEPARTMENT_HEAD" && r.scope_department_id,
  );
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (active) {
        setLoading(true);
        setClock(Date.now());
        setErrors([]);
      }
      const result = await Promise.allSettled([
        api<Reading[]>("/my/reading"),
        api<Learning[]>("/my/learning"),
        api<ContentPage>("/documents?pageSize=3"),
        ...(head ? [api<Approval[]>("/approvals")] : []),
      ]);
      if (!active) return;
      const next: Task[] = [],
        issues: string[] = [];
      const labels = ["nhiệm vụ đọc", "khóa học", "tài liệu", "phê duyệt"];
      result.forEach((r, index) => {
        if (r.status === "rejected") {
          if (r.reason instanceof ApiError && r.reason.status === 401)
            router.replace("/login");
          issues.push(`Không tải được ${labels[index]}.`);
        }
      });
      const reading = result[0];
      if (reading.status === "fulfilled")
        for (const r of reading.value as Reading[])
          if (!r.acknowledged_at && r.is_current)
            next.push({
              id: r.id,
              title: r.title,
              category: `Nội quy · v${r.version_number}`,
              href: `/documents/${r.content_id}`,
              due: r.due_at,
              icon: "document",
            });
      const learning = result[1];
      if (learning.status === "fulfilled")
        for (const c of learning.value as Learning[])
          if (!c.completed_at)
            next.push({
              id: c.id,
              title: c.title,
              category: "Đào tạo",
              href: `/learning/${c.id}`,
              due: c.due_at,
              icon: "learning",
            });
      const docs = result[2];
      setDocuments(
        docs.status === "fulfilled" ? (docs.value as ContentPage).items : [],
      );
      const approvals = result[3];
      if (approvals?.status === "fulfilled")
        for (const a of approvals.value as Approval[])
          if (a.status === "PENDING")
            next.push({
              id: a.id,
              title: a.title,
              category: "Phê duyệt",
              href: "/approvals",
              due: null,
              icon: "approval",
            });
      next.sort(
        (a, b) =>
          (a.due ? Date.parse(a.due) : Infinity) -
          (b.due ? Date.parse(b.due) : Infinity),
      );
      setTasks(next);
      setErrors(issues);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [head, router, revision]);
  const stages = data.processes;
  return (
    <div className={styles.dashboard}>
      <div className={styles.stats}>
        {[
          [
            "document",
            "Tài liệu được xem",
            data.documents,
            "blue",
            "/documents",
          ],
          [
            "learning",
            "Khóa học được giao",
            data.learning,
            "orange",
            "/learning",
          ],
          ["incident", "Hồ sơ sự cố", data.incidents, "pink", "/incidents"],
        ].map(([icon, label, count, color, url]) => (
          <Link
            href={String(url)}
            key={String(url)}
            className={`stat ${styles.stat}`}
          >
            <span className={`${styles.statIcon} ${styles[String(color)]}`}>
              <Icon name={String(icon)} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{count}</strong>
              <small>Trong phạm vi của bạn</small>
            </div>
            <Icon name="arrow" />
          </Link>
        ))}
      </div>
      <nav className={styles.mobileShortcuts} aria-label="Truy cập nhanh">
        <Link
          href={
            stages.find((s) => s.code === "OFFSET")
              ? `/knowledge?processId=${stages.find((s) => s.code === "OFFSET")!.id}`
              : "/knowledge"
          }
        >
          <Icon name="print" />
          Offset
        </Link>
        <Link href="/documents">
          <Icon name="document" />
          Nội quy
        </Link>
        <Link href="/incidents">
          <Icon name="incident" />
          Sự cố
        </Link>
        <Link href="/learning">
          <Icon name="learning" />
          Khóa học
        </Link>
      </nav>
      <div className={styles.grid}>
        <div className={styles.column}>
          <section className={styles.processes}>
            <div className={styles.heading}>
              <h2>Truy cập nhanh theo khu vực sản xuất</h2>
            </div>
            <div className={styles.processGrid}>
              {stages.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/knowledge?processId=${p.id}`}
                  className={`${styles.process} ${styles[`process${i % 5}`]}`}
                >
                  <PrintIllustration code={p.code} />
                  <b>{p.name}</b>
                </Link>
              ))}
            </div>
            {!stages.length && (
              <p className={styles.empty}>Chưa có danh mục công đoạn.</p>
            )}
          </section>
          <section className={styles.featured}>
            <div className={styles.heading}>
              <h2>Tri thức nổi bật</h2>
              <Link href="/knowledge">Xem thêm →</Link>
            </div>
            <div className={styles.cards}>
              {data.featured.map((c, i) => (
                <Featured key={c.id} item={c} index={i} />
              ))}
            </div>
            {!data.featured.length && (
              <p className={styles.empty}>
                Chưa có tri thức được duyệt trong phạm vi của bạn.
              </p>
            )}
          </section>
        </div>
        <div className={styles.column}>
          <section className={styles.tasks} id="dashboard-tasks">
            <div className={styles.heading}>
              <h2>
                Việc cần làm
                {!loading && !errors.length ? ` (${tasks.length})` : ""}
              </h2>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="task-list"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Thu gọn ↑" : "Xem tất cả →"}
              </button>
            </div>
            {loading ? (
              <p role="status">Đang tải nhiệm vụ…</p>
            ) : (
              <>
                {!!errors.length && (
                  <div className={styles.error} role="alert">
                    {errors.map((e) => (
                      <p key={e}>{e}</p>
                    ))}
                    <button onClick={() => setRevision((v) => v + 1)}>
                      Thử lại nhiệm vụ
                    </button>
                  </div>
                )}
                <div
                  id="task-list"
                  className={`${styles.taskList} ${expanded ? styles.expanded : ""}`}
                >
                  {tasks.map((t) => (
                    <Link className={styles.task} key={t.id} href={t.href}>
                      <span className={styles.taskIcon}>
                        <Icon name={t.icon} />
                      </span>
                      <span>
                        <b>{t.title}</b>
                        <span className={styles.taskMeta}>
                          <small>{t.category}</small>
                          {t.due && (
                            <time
                              dateTime={t.due}
                              className={
                                Date.parse(t.due) < clock ? styles.overdue : ""
                              }
                            >
                              Hạn: {date(t.due)}
                            </time>
                          )}
                        </span>
                      </span>
                      <Icon name="arrow" />
                    </Link>
                  ))}
                </div>
                {!tasks.length && !errors.length && (
                  <p className={styles.empty}>
                    Bạn đã hoàn thành các nhiệm vụ hiện có.
                  </p>
                )}
              </>
            )}
          </section>
          <section className={styles.recent}>
            <div className={styles.heading}>
              <h2>Tài liệu được xem</h2>
              <Link href="/documents">Xem thêm →</Link>
            </div>
            {loading ? (
              <p role="status">Đang tải tài liệu…</p>
            ) : documents.length ? (
              documents.map((c) => (
                <Link className={styles.document} key={c.id} href={href(c)}>
                  <span>
                    <Icon name="document" />
                  </span>
                  <div>
                    <b>{c.title}</b>
                    <small>
                      Phiên bản {c.version_number} ·{" "}
                      {c.department_name || "Toàn công ty"}
                    </small>
                  </div>
                </Link>
              ))
            ) : (
              <p className={styles.empty}>
                {errors.some((e) => e.includes("tài liệu"))
                  ? "Tài liệu tạm thời chưa tải được."
                  : "Chưa có tài liệu được quyền xem."}
              </p>
            )}
            <p className={styles.feedNote}>
              Hoạt động gần đây và thông báo sẽ hiển thị khi có nguồn dữ liệu
              được kết nối.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
