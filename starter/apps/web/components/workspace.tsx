"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type User,
  type Content,
  type ContentPage,
  type Dashboard,
  type Learning,
  type Approval,
} from "./api";
import { Icon } from "./icon";
import { AttachmentsPanel, ReadingPanel, CoursePlayer } from "./sprint01";

const navigation = [
  ["/", "Trang chủ", "home"],
  ["/documents", "Nội quy", "document"],
  ["/knowledge", "Kho tri thức", "knowledge"],
  ["/incidents", "Sự cố", "incident"],
  ["/learning", "Đào tạo", "learning"],
  ["/approvals", "Phê duyệt", "approval"],
  ["/workspace", "Biên soạn / phiên bản", "document"],
  ["/incidents/manage", "Hồ sơ / tái diễn", "incident"],
  ["/learning/manage", "Quản lý đào tạo", "learning"],
];
const titles: Record<string, string> = {
  "/": "Chào anh/chị,\nhôm nay bạn cần gì?",
  "/documents": "Thư viện nội quy & quy trình",
  "/knowledge": "Kho tri thức",
  "/incidents": "Sự cố & bài học",
  "/learning": "Khóa học của tôi",
  "/approvals": "Phê duyệt nội dung",
  "/knowledge/new": "Tạo bài chia sẻ kinh nghiệm",
  "/account": "Tài khoản của tôi",
};
const descriptions: Record<string, string> = {
  "/": "Tra cứu quy trình · Học hỏi kinh nghiệm · Cùng nhau phát triển",
  "/documents":
    "Tra cứu tài liệu theo phiên bản, bộ phận và phạm vi được cấp quyền.",
  "/knowledge": "Kinh nghiệm thực tế, bài học được chia sẻ và phê duyệt.",
  "/incidents": "Tra cứu hồ sơ minh họa. Không dùng làm hướng dẫn vận hành.",
  "/learning": "Học hôm nay, vững tay nghề ngày mai.",
  "/approvals": "Chỉ duyệt trong phạm vi bộ phận. Không tự duyệt bài của mình.",
  "/knowledge/new":
    "Ghi lại bài học từ công việc hằng ngày để cùng nâng cao chất lượng.",
  "/account": "Quản lý phiên đăng nhập và mật khẩu JKC độc lập.",
};
function routeFor(content: Content) {
  return `${content.kind === "DOCUMENT" ? "/documents" : content.kind === "INCIDENT_GUIDE" ? "/incidents" : "/knowledge"}/${content.id}`;
}
function ContentCard({ item, index = 0 }: { item: Content; index?: number }) {
  return (
    <Link className="content-card" href={routeFor(item)}>
      <div className={`card-art art-${index % 3}`}>
        <Icon
          name={
            item.kind === "DOCUMENT"
              ? "document"
              : item.kind === "INCIDENT_GUIDE"
                ? "incident"
                : "knowledge"
          }
        />
        <span>TRI THỨC / JKC</span>
        <div className="paper-stack" />
      </div>
      <div className="card-body">
        <span className="badge success">Đã duyệt · v{item.version_number}</span>
        <h3>{item.title}</h3>
        <p>{item.department_name || "Toàn công ty"}</p>
        <span className="card-link">
          Xem nội dung <Icon name="arrow" />
        </span>
      </div>
    </Link>
  );
}
function Empty({
  message = "Chưa có nội dung trong phạm vi của bạn.",
}: {
  message?: string;
}) {
  return (
    <div className="empty">
      <Icon name="document" />
      <h3>{message}</h3>
      <p>Thử thay đổi từ khóa hoặc quay lại sau.</p>
    </div>
  );
}

export function Workspace({
  initialQuery = "",
  initialProcess = "",
}: {
  initialQuery?: string;
  initialProcess?: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [list, setList] = useState<ContentPage | null>(null);
  const [detail, setDetail] = useState<Content | null>(null);
  const [courses, setCourses] = useState<Learning[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [process, setProcess] = useState(initialProcess);
  const [processes, setProcesses] = useState<Dashboard["processes"]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const isList = ["/documents", "/knowledge", "/incidents"].includes(path);
  const isDetail =
    /^\/(documents|knowledge|incidents)\/[^/]+$/.test(path) &&
    path != "/knowledge/new";
  const title = titles[path] || "Chi tiết nội dung";
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const me = await api<User>("/auth/me");
        if (!active) return;
        setUser(me);
        if (me.must_change_password && path != "/account") {
          router.replace("/account");
          return;
        }
        if (path === "/") {
          const data = await api<Dashboard>("/dashboard");
          if (active) setDashboard(data);
        } else if (isList) {
          const endpoint = path === "/knowledge" ? "/articles" : path;
          const data = await api<ContentPage>(
            `${endpoint}?q=${encodeURIComponent(query)}&page=${page}&pageSize=9${process ? `&processId=${encodeURIComponent(process)}` : ""}`,
          );
          const processOptions =
            await api<Dashboard["processes"]>("/processes");
          if (active) {
            setList(data);
            setProcesses(processOptions);
          }
        } else if (isDetail) {
          const data = await api<Content>(
            path.replace("/knowledge/", "/articles/"),
          );
          if (active) setDetail(data);
        } else if (path === "/learning") {
          const data = await api<Learning[]>("/my/learning");
          if (active) setCourses(data);
        } else if (path === "/approvals") {
          const data = await api<Approval[]>("/approvals");
          if (active) setApprovals(data);
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
        else if (active)
          setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [path, isList, isDetail, query, page, process, revision, router]);
  async function logout() {
    if (!user) return;
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" }, user.csrf_token);
      router.replace("/login");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!user || !selected) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/approvals/${selected.id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ expectedVersion: selected.version_number }),
        },
        user.csrf_token,
      );
      setNotice("Đã phê duyệt phiên bản bài viết.");
      setSelected(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canApprove = user?.roles.some((r) => r.code === "DEPARTMENT_HEAD");
  const nav = navigation.filter(([href]) => href != "/approvals" || canApprove);
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Chuyển đến nội dung
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <strong className="brand-mark">
            JKC
            <span />
          </strong>
          <b>TRI THỨC JKC</b>
          <small>Cổng tri thức nội bộ ngành in</small>
        </Link>
        <div className="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
        <nav aria-label="Điều hướng chính">
          {nav.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (href === "/" ? path === "/" : path.startsWith(href))
                  ? "page"
                  : undefined
              }
            >
              <Icon name={icon} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="cmyk">
            <i />
            <i />
            <i />
            <i />
          </div>
          <b>
            Kiến thức tạo nên
            <br />
            giá trị bền vững.
          </b>
          <p>
            Chia sẻ hôm nay,
            <br />
            nâng tầm chất lượng ngày mai.
          </p>
        </div>
        <Link className="account-link" href="/account">
          <Icon name="user" />
          Tài khoản & bảo mật
        </Link>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            JKC <b>Tri Thức JKC</b>
          </Link>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              const value =
                new FormData(e.currentTarget).get("q")?.toString() || "";
              if (path === "/knowledge") {
                setPage(1);
                setQuery(value);
              } else router.push("/knowledge?q=" + encodeURIComponent(value));
            }}
          >
            <Icon name="search" />
            <input
              name="q"
              aria-label="Tìm trong kho tri thức"
              placeholder="Tìm bài, quy trình, kinh nghiệm…"
            />
            <button aria-label="Tìm kiếm">
              <Icon name="arrow" />
            </button>
          </form>
          <Link href="/account" className="user-chip">
            <span className="avatar">{user?.full_name.charAt(0) || "J"}</span>
            <span>
              <b>{user?.full_name || "Đang tải…"}</b>
              <small>
                {canApprove
                  ? "Trưởng bộ phận"
                  : user?.roles.some((r) => r.code === "TECH_ADMIN")
                    ? "Quản trị kỹ thuật"
                    : "Tài khoản nội bộ"}
              </small>
            </span>
          </Link>
        </header>
        <main id="main">
          <div className="demo-notice">
            <span className="demo-dot" /> Môi trường DEMO · Nội dung minh họa,
            chưa phải tài liệu vận hành được ban hành.
          </div>
          <section className="hero">
            <div className="hero-icon">
              <Icon
                name={
                  navigation.find(([href]) => href === path)?.[2] || "document"
                }
              />
            </div>
            <div>
              <p className="eyebrow">
                TRI THỨC JKC /{" "}
                {path === "/" ? "TỔNG QUAN" : "KHÔNG GIAN TRI THỨC"}
              </p>
              <h1>{title}</h1>
              <p>
                {descriptions[path] ||
                  "Đọc nội dung và kiểm tra đúng phiên bản."}
              </p>
            </div>
            <div className="hero-decoration" aria-hidden="true">
              <span />
              <span />
              <span />
              <b>
                Chia sẻ tri thức.
                <br />
                Cùng phát triển.
              </b>
            </div>
          </section>
          <nav className="management-links" aria-label="Quản lý nội dung">
            <Link href="/workspace">Biên soạn / phiên bản</Link>
            <Link href="/incidents/manage">Hồ sơ sự cố / tái diễn</Link>
            <Link href="/learning/manage">Quản lý đào tạo</Link>
          </nav>
          {error && (
            <div className="error" role="alert">
              {error}{" "}
              <button onClick={() => setRevision((v) => v + 1)}>Thử lại</button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
            </div>
          )}
          {loading ? (
            <div
              aria-busy="true"
              aria-label="Đang tải dữ liệu"
              className="skeleton-grid"
            >
              {[1, 2, 3].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : (
            !error && (
              <>
                {path === "/" && dashboard && (
                  <>
                    <div className="stats">
                      {[
                        [
                          "document",
                          "Tài liệu được xem",
                          dashboard.documents,
                          "blue",
                          "/documents",
                        ],
                        [
                          "learning",
                          "Khóa học được giao",
                          dashboard.learning,
                          "orange",
                          "/learning",
                        ],
                        [
                          "incident",
                          "Hồ sơ sự cố",
                          dashboard.incidents,
                          "pink",
                          "/incidents",
                        ],
                      ].map(([icon, label, count, color, href]) => (
                        <Link
                          href={String(href)}
                          className="stat panel"
                          key={String(label)}
                        >
                          <span className={`stat-icon ${color}`}>
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
                    <div className="dashboard-grid">
                      <div>
                        <div className="section-heading">
                          <h2>Truy cập nhanh theo công đoạn</h2>
                          <span className="subtle">5 công đoạn sản xuất</span>
                        </div>
                        <div className="process-grid">
                          {dashboard.processes.map((p, i) => (
                            <Link
                              href={`/knowledge?processId=${p.id}`}
                              className={`process process-${i}`}
                              key={p.id}
                            >
                              <span className="process-number">0{i + 1}</span>
                              <Icon name="print" />
                              <b>{p.name}</b>
                            </Link>
                          ))}
                        </div>
                        <div className="section-heading">
                          <h2>Tri thức nổi bật</h2>
                          <Link href="/knowledge">
                            Xem thêm <Icon name="arrow" />
                          </Link>
                        </div>
                        <div className="cards">
                          {dashboard.featured.length ? (
                            dashboard.featured.map((c, i) => (
                              <ContentCard key={c.id} item={c} index={i} />
                            ))
                          ) : (
                            <Empty />
                          )}
                        </div>
                      </div>
                      <aside className="dashboard-aside">
                        <section className="panel">
                          <div className="section-heading">
                            <h2>Việc cần làm</h2>
                            <span className="badge">Của bạn</span>
                          </div>
                          <Link className="task" href="/learning">
                            <span className="task-icon orange">
                              <Icon name="learning" />
                            </span>
                            <span>
                              <b>{dashboard.learning} khóa học được giao</b>
                              <small>Xem tiến độ học tập</small>
                            </span>
                            <Icon name="arrow" />
                          </Link>
                          {canApprove && (
                            <Link className="task" href="/approvals">
                              <span className="task-icon blue">
                                <Icon name="approval" />
                              </span>
                              <span>
                                <b>
                                  {dashboard.pending_approvals} bài đang chờ
                                  duyệt
                                </b>
                                <small>Trong phạm vi bộ phận</small>
                              </span>
                              <Icon name="arrow" />
                            </Link>
                          )}
                          <Link href="/documents">
                            Xem nội quy và xác nhận đã đọc
                          </Link>
                        </section>
                        <section className="share-panel">
                          <span className="badge">CÙNG NHAU TỐT HƠN</span>
                          <h2>
                            Mỗi bài học nhỏ,
                            <br />
                            một giá trị lớn.
                          </h2>
                          <p>
                            Ghi lại kinh nghiệm và gửi trưởng bộ phận xác minh.
                          </p>
                          <Link className="button" href="/knowledge/new">
                            <Icon name="plus" />
                            Chia sẻ kinh nghiệm
                          </Link>
                        </section>
                      </aside>
                    </div>
                  </>
                )}
                {isList && (
                  <>
                    <div className="toolbar">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setPage(1);
                          setQuery(
                            new FormData(e.currentTarget)
                              .get("filter")
                              ?.toString() || "",
                          );
                        }}
                        className="filter-search"
                      >
                        <Icon name="search" />
                        <input
                          name="filter"
                          defaultValue={query}
                          placeholder="Nhập từ khóa trong tiêu đề…"
                          aria-label="Lọc theo tiêu đề"
                        />
                        <button className="button">Tìm kiếm</button>
                      </form>
                      {path === "/knowledge" && (
                        <Link className="button" href="/knowledge/new">
                          <Icon name="plus" />
                          Tạo bài chia sẻ
                        </Link>
                      )}
                    </div>
                    <label className="process-filter">
                      Công đoạn
                      <select
                        aria-label="Lọc công đoạn"
                        value={process}
                        onChange={(e) => {
                          setProcess(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">Tất cả công đoạn</option>
                        {processes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="section-heading">
                      <h2>{list?.total || 0} nội dung được quyền xem</h2>
                      <span className="subtle">
                        Đã duyệt · Phiên bản hiện hành
                      </span>
                    </div>
                    {list?.items.length ? (
                      <div
                        className={`library-view ${path === "/documents" ? "documents-view" : "knowledge-view"}`}
                      >
                        {path === "/documents" && (
                          <div className="document-table">
                            <table>
                              <caption className="visually-hidden">
                                Danh sách tài liệu đã duyệt trong phạm vi của
                                bạn
                              </caption>
                              <thead>
                                <tr>
                                  <th>Mã tài liệu</th>
                                  <th>Tên tài liệu</th>
                                  <th>Bộ phận</th>
                                  <th>Phiên bản</th>
                                  <th>Trạng thái</th>
                                  <th>Thao tác</th>
                                </tr>
                              </thead>
                              <tbody>
                                {list.items.map((c) => (
                                  <tr key={c.id}>
                                    <td>{c.code}</td>
                                    <td>
                                      <Link href={routeFor(c)}>{c.title}</Link>
                                    </td>
                                    <td>{c.department_name}</td>
                                    <td>v{c.version_number}</td>
                                    <td>
                                      <span className="badge success">
                                        Đã duyệt
                                      </span>
                                    </td>
                                    <td>
                                      <Link
                                        className="secondary table-action"
                                        href={routeFor(c)}
                                      >
                                        Xem tài liệu
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="cards library">
                          {list.items.map((c, i) => (
                            <ContentCard key={c.id} item={c} index={i} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <Empty
                        message={
                          query ? "Không tìm thấy kết quả phù hợp." : undefined
                        }
                      />
                    )}
                    <div className="pagination">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((v) => v - 1)}
                      >
                        Trang trước
                      </button>
                      <span>Trang {page}</span>
                      <button
                        disabled={page * 9 >= (list?.total || 0)}
                        onClick={() => setPage((v) => v + 1)}
                      >
                        Trang sau
                      </button>
                    </div>
                  </>
                )}
                {isDetail && detail && (
                  <>
                    <Link
                      className="back-link"
                      href={
                        path.startsWith("/documents")
                          ? "/documents"
                          : path.startsWith("/incidents")
                            ? "/incidents"
                            : "/knowledge"
                      }
                    >
                      ← Quay lại thư viện
                    </Link>
                    <div className="detail-grid">
                      <article className="panel document-body">
                        <div className="badge-row">
                          <span className="badge success">Đã duyệt</span>
                          <span className="badge">
                            Phiên bản {detail.version_number}
                          </span>
                          <span className="badge">
                            {detail.department_name}
                          </span>
                        </div>
                        <h2>{detail.title}</h2>
                        <p className="subtle">Mã: {detail.code}</p>
                        {Object.entries(detail.body).map(([key, value], i) => (
                          <section key={key}>
                            <h3>
                              <span className="number">{i + 1}</span>
                              {key}
                            </h3>
                            <p>{value}</p>
                          </section>
                        ))}
                      </article>
                      <aside className="panel">
                        <h2>Thông tin phiên bản</h2>
                        <p>Nội dung DEMO để kiểm thử.</p>
                        {user && (
                          <>
                            {detail.kind === "DOCUMENT" && (
                              <ReadingPanel
                                user={user}
                                contentId={detail.id}
                                versionId={detail.version_id}
                              />
                            )}
                            <AttachmentsPanel
                              user={user}
                              versionId={detail.version_id}
                            />
                          </>
                        )}
                        <p className="subtle">
                          Lịch sử xác nhận được giữ riêng theo phiên bản được
                          giao.
                        </p>
                      </aside>
                    </div>
                  </>
                )}
                {path === "/learning" && (
                  <>
                    <div className="section-heading">
                      <h2>Được giao ({courses.length})</h2>
                      <span className="badge">Theo phiên bản khóa học</span>
                    </div>
                    {courses.length ? (
                      courses.map((c) => (
                        <article className="panel course-row" key={c.id}>
                          <span className="course-art">
                            <Icon name="learning" />
                          </span>
                          <div>
                            <span className="badge">
                              DEMO · v{c.version_number}
                            </span>
                            <h3>{c.title}</h3>
                            <p className="subtle">
                              {c.completed_lessons}/{c.total_lessons} bài học ·{" "}
                              {(
                                {
                                  NOT_STARTED: "Chưa học",
                                  IN_PROGRESS: "Đang học",
                                  COMPLETED: "Hoàn thành",
                                  FAILED: "Không đạt",
                                  OVERDUE: "Quá hạn",
                                } as Record<string, string>
                              )[c.status] || c.status}
                            </p>
                            <progress
                              max={c.total_lessons || 1}
                              value={c.completed_lessons}
                              aria-label={`Tiến độ ${c.title}`}
                            />
                          </div>
                          <Link className="button" href={`/learning/${c.id}`}>
                            Mở khóa học
                          </Link>
                        </article>
                      ))
                    ) : (
                      <Empty message="Bạn chưa được giao khóa học." />
                    )}
                  </>
                )}
                {path.startsWith("/learning/") && user && (
                  <CoursePlayer user={user} assignmentId={path.split("/")[2]} />
                )}
                {path === "/approvals" && (
                  <>
                    <p className="notice">
                      Xem và duyệt bài tri thức trong phạm vi. Để yêu cầu chỉnh
                      sửa, từ chối hoặc ban hành nội quy theo quyền HR, mở{" "}
                      <Link href="/workspace">Biên soạn / phiên bản</Link>.
                    </p>
                    <div className="approval-grid">
                      <div>
                        {approvals.length ? (
                          approvals.map((a) => (
                            <button
                              className={`panel approval-row ${selected?.id === a.id ? "selected" : ""}`}
                              key={a.id}
                              onClick={() => setSelected(a)}
                            >
                              <span
                                className={`badge ${a.status === "APPROVED" ? "success" : "warning"}`}
                              >
                                {a.status === "APPROVED"
                                  ? "Đã duyệt"
                                  : "Chờ duyệt"}
                              </span>
                              <h3>{a.title}</h3>
                              <p>
                                {a.author} · v{a.version_number}
                              </p>
                              <small>
                                {new Date(a.requested_at).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </small>
                            </button>
                          ))
                        ) : (
                          <Empty message="Không có yêu cầu trong phạm vi của bạn." />
                        )}
                      </div>
                      <aside className="panel approval-preview">
                        {selected ? (
                          <>
                            <h2>{selected.title}</h2>
                            <p className="subtle">
                              Người gửi: {selected.author} · v
                              {selected.version_number}
                            </p>
                            {Object.entries(selected.body).map(([k, v]) => (
                              <section key={k}>
                                <h3>{k}</h3>
                                <p>{v}</p>
                              </section>
                            ))}
                            <button
                              className="button"
                              onClick={approve}
                              disabled={busy || selected.status !== "PENDING"}
                            >
                              <Icon name="check" />
                              {busy
                                ? "Đang phê duyệt…"
                                : "Phê duyệt phiên bản này"}
                            </button>
                          </>
                        ) : (
                          <p className="subtle">
                            Chọn một bài để đọc nội dung trước khi duyệt.
                          </p>
                        )}
                      </aside>
                    </div>
                  </>
                )}
                {path === "/knowledge/new" && user && <DraftForm user={user} />}
                {path === "/account" && user && (
                  <section className="panel account-panel">
                    <h2>{user.full_name}</h2>
                    <p>Tên đăng nhập: {user.username}</p>
                    <p className="subtle">
                      {user.roles.map((r) => r.code).join(" · ")}
                    </p>
                    {user.must_change_password && (
                      <p className="notice">
                        Bạn cần đổi mật khẩu lần đầu trước khi truy cập nội
                        dung.
                      </p>
                    )}
                    <PasswordForm user={user} />
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={logout}
                    >
                      <Icon name="logout" />
                      Đăng xuất khỏi thiết bị này
                    </button>
                  </section>
                )}
              </>
            )
          )}
          <footer className="footer">
            Tri Thức JKC · Môi trường DEMO{" "}
            <span>Chia sẻ tri thức · Nâng tầm chất lượng</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng di động">
        {[
          ["/", "Trang chủ", "home"],
          ["/documents", "Nội quy", "document"],
          ["/knowledge", "Tra cứu", "search"],
          ["/learning", "Học tập", "learning"],
          ["/account", "Tài khoản", "user"],
        ].map(([href, label, icon]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              (href === "/" ? path === "/" : path.startsWith(href))
                ? "page"
                : undefined
            }
          >
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function DraftForm({ user }: { user: User }) {
  const [id, setId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const key of [
      "Mô tả vấn đề",
      "Điều kiện phát sinh",
      "Các bước kiểm tra",
      "Giải pháp đề xuất",
      "Kết quả",
      "Lưu ý an toàn",
    ])
      body[key] = String(form.get(key) || "");
    try {
      const result = await api<{ id: string; version_id: string }>(
        "/articles",
        {
          method: "POST",
          body: JSON.stringify({ title: form.get("title"), body }),
        },
        user.csrf_token,
      );
      setId(result.id);
      setVersionId(result.version_id);
      setDirty(false);
      setMessage("Đã lưu bản nháp. Bạn có thể gửi trưởng bộ phận phê duyệt.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api(`/articles/${id}/submit`, { method: "POST" }, user.csrf_token);
      setSent(true);
      setMessage(
        "Đã gửi phê duyệt. Bài chỉ được công bố sau khi trưởng bộ phận duyệt.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="detail-grid">
      <form
        className="panel draft-form"
        onSubmit={save}
        onChange={() => setDirty(true)}
      >
        <h2>
          <span className="number">1</span>Thông tin & nội dung bài chia sẻ
        </h2>
        <p className="subtle">
          Bài được gán vào bộ phận của bạn. Bản nháp riêng cho tác giả; chưa có
          tính năng sửa bản nháp sau khi lưu.
        </p>
        <fieldset disabled={!!id || busy}>
          <label>
            Tiêu đề <span>*</span>
            <input
              name="title"
              required
              minLength={5}
              maxLength={200}
              placeholder="Ví dụ: Bài học từ việc ghi nhận sự cố"
            />
          </label>
          <div className="form-grid">
            {[
              "Mô tả vấn đề",
              "Điều kiện phát sinh",
              "Các bước kiểm tra",
              "Giải pháp đề xuất",
              "Kết quả",
              "Lưu ý an toàn",
            ].map((label, i) => (
              <label key={label}>
                {label}
                {i === 0 && " *"}
                <textarea
                  name={label}
                  required={i === 0}
                  maxLength={5000}
                  rows={4}
                />
              </label>
            ))}
          </div>
        </fieldset>
        {versionId && !sent && (
          <AttachmentsPanel user={user} versionId={versionId} canUpload />
        )}
        {!versionId && (
          <p className="subtle">
            Lưu bản nháp trước để đính kèm ảnh/PDF và quét mã độc.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="form-actions">
          <button className="secondary" disabled={busy || !!id}>
            Lưu bản nháp
          </button>
          <button
            type="button"
            className="button"
            disabled={busy || !id || sent}
            onClick={submit}
          >
            {busy
              ? "Đang xử lý…"
              : sent
                ? "Đã gửi duyệt"
                : "Gửi trưởng bộ phận duyệt"}
          </button>
        </div>
      </form>
      <aside className="panel tips">
        <h2>Một bài chia sẻ tốt</h2>
        {[
          "Nêu rõ vấn đề và mức độ ảnh hưởng",
          "Ghi điều kiện và bằng chứng thực tế",
          "Liệt kê những gì đã kiểm tra",
          "Phân biệt giả thuyết và nguyên nhân đã xác minh",
          "Ghi kết quả và phạm vi áp dụng",
        ].map((t, i) => (
          <p key={t}>
            <span className="number">{i + 1}</span>
            {t}
          </p>
        ))}
      </aside>
    </div>
  );
}
function PasswordForm({ user }: { user: User }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="password-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await api(
            "/auth/password",
            {
              method: "POST",
              body: JSON.stringify({
                current_password: f.get("current"),
                new_password: f.get("new"),
              }),
            },
            user.csrf_token,
          );
          router.replace("/login?changed=1");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Đổi mật khẩu</h3>
      <label>
        Mật khẩu hiện tại
        <input
          type="password"
          name="current"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      <label>
        Mật khẩu mới (ít nhất 12 ký tự)
        <input
          type="password"
          name="new"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        Đổi mật khẩu & thu hồi mọi phiên
      </button>
    </form>
  );
}
