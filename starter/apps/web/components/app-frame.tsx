"use client";
import Link from "next/link";
import { useState, type ReactNode, type FormEvent } from "react";
import { Icon } from "./icon";
import type { User } from "./api";
import styles from "./app-frame.module.css";

export function Bell() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4M18 3l2 2M4 5l2-2" />
    </svg>
  );
}
const links = [
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
export function AppFrame({
  user,
  path,
  title,
  onSearch,
  children,
}: {
  user: User | null;
  path: string;
  title: string;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const head = !!user?.roles.some(
    (r) => r.code === "DEPARTMENT_HEAD" && r.scope_department_id,
  );
  const nav = user
    ? links.filter(
        ([href]) =>
          (href !== "/approvals" || head) &&
          (!["/workspace", "/incidents/manage", "/learning/manage"].includes(
            href,
          ) ||
            !!user.department_id),
      )
    : [];
  const active = (href: string) =>
    href === "/"
      ? path === "/"
      : path === href ||
        (path.startsWith(href + "/") &&
          !nav.some(
            ([other]) =>
              other !== href &&
              other.startsWith(href + "/") &&
              path.startsWith(other),
          ));
  const toggleNotice = () => setNotifications((v) => !v);
  return (
    <div className={`${styles.frame} ${collapsed ? styles.collapsed : ""}`}>
      <a className="skip" href="#main">
        Chuyển đến nội dung
      </a>
      <aside className={styles.sidebar}>
        <Link
          className={styles.brand}
          href="/"
          aria-label="Tri Thức JKC — Trang chủ"
        >
          <strong className={styles.mark}>JKC</strong>
          <span>
            <b>TRI THỨC JKC</b>
            <small>Cổng tri thức nội bộ ngành in</small>
          </span>
        </Link>
        <nav aria-label="Điều hướng chính">
          {nav.map(([href, label, icon]) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              aria-current={active(href) ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sideMessage}>
          <div className={styles.ribbon} />
          <p>
            KIẾN THỨC
            <br />
            TẠO NÊN GIÁ TRỊ
            <br />
            BỀN VỮNG
          </p>
          <small>Chia sẻ tri thức · Cùng phát triển</small>
        </div>
        <Link
          className={styles.account}
          href="/account"
          aria-label="Tài khoản & bảo mật"
        >
          <Icon name="user" />
          <span>Tài khoản & bảo mật</span>
        </Link>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <button
            className={styles.mobileToggle}
            aria-label={
              menuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <button
            className={styles.collapse}
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((v) => !v)}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M3 5h18M3 12h10M3 19h18m-5-10 3 3-3 3" />
            </svg>
          </button>
          <Link className={styles.mobileBrand} href="/">
            <strong className={styles.mark}>JKC</strong>
            <span>
              <b>Tri Thức JKC</b>
              <small>Cổng tri thức nội bộ ngành in</small>
            </span>
          </Link>
          <span className={styles.pageTitle}>{title}</span>
          <form className={styles.search} onSubmit={onSearch}>
            <Icon name="search" />
            <input
              name="q"
              aria-label="Tìm trong kho tri thức"
              placeholder="Tìm lỗi, quy trình, kinh nghiệm…"
            />
            <button aria-label="Tìm kiếm">
              <Icon name="arrow" />
            </button>
          </form>
          <button
            className={styles.bell}
            aria-label="Thông báo"
            aria-expanded={notifications}
            aria-controls="notification-panel"
            onClick={toggleNotice}
          >
            <Bell />
          </button>
          <Link href="/account" className={styles.user}>
            <span className={styles.avatar}>
              {user?.full_name.charAt(0) || "J"}
            </span>
            <span>
              <b>{user?.full_name || "Đang tải…"}</b>
              <small>
                {head
                  ? "Trưởng bộ phận"
                  : user?.roles.some((r) => r.code === "HR")
                    ? "Nhân sự"
                    : user?.roles.some((r) => r.code === "TECH_ADMIN")
                      ? "Quản trị kỹ thuật"
                      : "Tài khoản nội bộ"}
              </small>
            </span>
            <span aria-hidden="true">⌄</span>
          </Link>
        </header>
        {menuOpen && (
          <nav
            id="mobile-menu"
            className={styles.mobileMenu}
            aria-label="Menu di động"
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenuOpen(false);
            }}
          >
            {nav.map(([href, label, icon]) => (
              <Link
                href={href}
                key={href}
                aria-current={active(href) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={icon} />
                {label}
              </Link>
            ))}
          </nav>
        )}
        {notifications && (
          <section
            id="notification-panel"
            className={styles.notifications}
            aria-label="Thông báo hệ thống"
          >
            <div>
              <h2>Thông báo</h2>
              <button
                aria-label="Đóng thông báo"
                onClick={() => setNotifications(false)}
              >
                ×
              </button>
            </div>
            <p>
              Luồng thông báo chưa được kết nối. Xem nhiệm vụ đọc và học tập của
              bạn tại Trang chủ.
            </p>
            <Link href="/" onClick={() => setNotifications(false)}>
              Xem việc cần làm →
            </Link>
          </section>
        )}
        {children}
      </div>
      <nav className={styles.bottom} aria-label="Điều hướng di động">
        {[
          ["/", "Trang chủ", "home"],
          ["/knowledge", "Tra cứu", "search"],
          ["/learning", "Học tập", "learning"],
        ].map(([href, label, icon]) => (
          <Link
            href={href}
            key={href}
            aria-current={active(href) ? "page" : undefined}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          aria-label="Thông báo"
          aria-expanded={notifications}
          aria-controls="notification-panel"
          onClick={toggleNotice}
        >
          <Bell />
          <span>Thông báo</span>
        </button>
        <Link
          href="/account"
          aria-current={path === "/account" ? "page" : undefined}
        >
          <Icon name="user" />
          <span>Tài khoản</span>
        </Link>
      </nav>
    </div>
  );
}
