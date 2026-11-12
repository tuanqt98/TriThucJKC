"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type FormEvent } from "react";
import { Icon } from "./icon";
import styles from "./login-fidelity.module.css";

const rememberedNameKey = "jkc.login.username.v1";
const serverReason = () => false;
const expiredReason = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("reason") ===
    "session-expired";
const subscribeLocation = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};

function FieldIcon({ name }: { name: "lock" | "eye" | "support" }) {
  const paths = {
    lock: "M6 10V7a6 6 0 0 1 12 0v3M5 10h14v12H5ZM12 15v3",
    eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    support:
      "M4 13V9a8 8 0 0 1 16 0v4M4 11H2v7h4v-7ZM20 11h2v7h-4v-7M20 18c0 4-4 4-7 4h-2",
  };
  return (
    <svg
      width="22"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function ValueIcon({ name }: { name: "quality" | "people" | "growth" }) {
  const paths = {
    quality:
      "M3 9 16 3l13 6-13 6ZM3 14l13 6 13-6M3 19l13 6 13-6M3 24l13 6 13-6",
    people:
      "M20 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM8 28v-4a8 8 0 0 1 16 0v4M8 7a4 4 0 0 0-2 7M3 25v-4a6 6 0 0 1 5-6M24 7a4 4 0 0 1 2 7M29 25v-4a6 6 0 0 0-5-6",
    growth:
      "M4 23h5v7H4ZM14 18h5v12h-5ZM24 12h5v18h-5ZM3 17l9-8 7 2L29 2M22 2h7v7",
  };
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function LoginFidelity({
  ready,
  busy,
  error,
  showPassword,
  togglePassword,
  onSubmit,
}: {
  ready: boolean;
  busy: boolean;
  error: string;
  showPassword: boolean;
  togglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const username = useRef<HTMLInputElement>(null);
  const remember = useRef<HTMLInputElement>(null);
  const expired = useSyncExternalStore(
    subscribeLocation,
    expiredReason,
    serverReason,
  );
  const errorMessage = /failed to fetch|networkerror|load failed/i.test(error)
    ? "Không thể kết nối máy chủ. Kiểm tra mạng và thử đăng nhập lại."
    : error;
  useEffect(() => {
    if (!ready) return;
    try {
      const saved = localStorage.getItem(rememberedNameKey);
      if (saved && username.current && remember.current) {
        username.current.value = saved;
        remember.current.checked = true;
      }
    } catch {
      /* Storage can be disabled on shared/private browsers. Login still works. */
    }
  }, [ready]);

  return (
    <main className={styles.page}>
      <section
        className={`login-story ${styles.hero}`}
        aria-label="Phong cảnh từ thiết kế đăng nhập được duyệt"
      >
        <div className={styles.heroCopy}>
          <p className={styles.quote}>
            Cùng nhau kiến tạo
            <br />
            những giá trị bền vững
          </p>
          <p className={styles.tagline}>IN ẤN KẾT NỐI TƯƠNG LAI</p>
          <span className={styles.redRule} />
        </div>
        <div className={styles.values}>
          <div>
            <ValueIcon name="quality" />
            <p>
              Chất lượng<span>Tạo niềm tin</span>
            </p>
          </div>
          <div>
            <ValueIcon name="people" />
            <p>
              Con người<span>Làm nên giá trị</span>
            </p>
          </div>
          <div>
            <ValueIcon name="growth" />
            <p>
              Phát triển<span>Cùng nhau vươn xa</span>
            </p>
          </div>
        </div>
        <svg
          className={styles.desktopWave}
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 30Q450 170 1000 10V100H0Z" fill="#b71e3a" />
          <path d="M0 45Q480 180 1000 35V100H0Z" fill="#242a78" />
        </svg>
        <svg
          className={styles.mobileWave}
          viewBox="0 0 390 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 21Q75 1 151 22T390 5V32H0Z" fill="#c92331" />
          <path d="M0 14Q75 0 151 21T390 12V32H0Z" fill="#fff" />
        </svg>
      </section>
      <section className={styles.panel} aria-label="Đăng nhập Tri Thức JKC">
        <div className={styles.brand}>
          <Image
            src="/images/login-approved/logo.jpg"
            alt="IN NHAT THAN — Tri Thức JKC"
            width={959}
            height={339}
            priority
            unoptimized
          />
        </div>
        <div className={styles.formSection}>
          <header className={styles.welcome}>
            <h1>Chào mừng trở lại</h1>
            <p className={styles.subtitle}>Hệ thống quản trị nội bộ</p>
            <p className={styles.description}>
              Kết nối con người – Tối ưu vận hành –<br />
              Kiến tạo giá trị bền vững.
            </p>
          </header>
          <form
            method="post"
            aria-busy={!ready || busy}
            className={styles.form}
            onSubmit={(event) => {
              try {
                if (remember.current?.checked && username.current?.value)
                  localStorage.setItem(
                    rememberedNameKey,
                    username.current.value,
                  );
                else localStorage.removeItem(rememberedNameKey);
              } catch {
                /* Never make authentication depend on browser storage. */
              }
              return onSubmit(event);
            }}
          >
            <div className={styles.field}>
              <label className={styles.srOnly} htmlFor="login-username">
                Tên đăng nhập
              </label>
              <Icon name="user" />
              <input
                ref={username}
                id="login-username"
                name="username"
                autoComplete="username"
                placeholder="Tên đăng nhập"
                disabled={!ready || busy}
                required
                maxLength={100}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.srOnly} htmlFor="login-password">
                Mật khẩu
              </label>
              <FieldIcon name="lock" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Mật khẩu"
                disabled={!ready || busy}
                required
                maxLength={256}
              />
              <button
                className={styles.reveal}
                type="button"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={showPassword}
                disabled={!ready || busy}
                onClick={togglePassword}
              >
                <FieldIcon name="eye" />
              </button>
            </div>
            <div className={styles.options}>
              <label title="Chỉ lưu tên đăng nhập trên thiết bị; không lưu mật khẩu hoặc kéo dài phiên.">
                <input
                  ref={remember}
                  name="remember_username"
                  type="checkbox"
                  disabled={!ready || busy}
                />
                Ghi nhớ đăng nhập
              </label>
              <Link href="/reset">Quên mật khẩu?</Link>
            </div>
            {expired && (
              <p role="status" className={styles.sessionNotice}>
                Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
              </p>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {errorMessage}
              </p>
            )}
            <button
              className={`button ${styles.submit}`}
              disabled={!ready || busy}
            >
              {busy ? "Đang xử lý…" : "Đăng nhập"}
              <Icon name="arrow" />
            </button>
          </form>
          <div className={styles.support}>
            <FieldIcon name="support" />
            <p>Liên hệ IT nếu bạn cần hỗ trợ truy cập hệ thống.</p>
          </div>
          <footer className={styles.footer}>
            © Nhat Han Printing Company Limited
            <span>Tri Thức JKC · Môi trường DEMO</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
