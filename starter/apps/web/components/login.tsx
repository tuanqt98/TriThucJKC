"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type User } from "./api";
import { Icon } from "./icon";
export function Login({ reset = false }: { reset?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <Link className="brand" href="/login">
          <strong className="brand-mark">
            JKC
            <span />
          </strong>
          <b>TRI THỨC JKC</b>
          <small>Cổng tri thức nội bộ ngành in</small>
        </Link>
        <div>
          <p className="eyebrow">CHIA SẺ TRI THỨC · NÂNG TẦM CHẤT LƯỢNG</p>
          <h1>
            Kiến thức hôm nay.
            <br />
            Giá trị ngày mai.
          </h1>
          <p>
            Kết nối kinh nghiệm tại xưởng.
            <br />
            Cùng học hỏi, cùng phát triển.
          </p>
          <div className="cmyk">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <small>Dành cho nhân viên JKC · Truy cập qua mạng nội bộ / VPN</small>
      </section>
      <section className="login-form-wrap">
        <div className="login-form">
          <span className="badge">TÀI KHOẢN NỘI BỘ JKC</span>
          <h2>{reset ? "Đặt lại mật khẩu" : "Chào mừng trở lại"}</h2>
          <p className="subtle">
            {reset
              ? "Nhập mã được quản trị viên cung cấp qua kênh an toàn."
              : "Đăng nhập để tra cứu, học tập và chia sẻ tri thức."}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                if (reset) {
                  await api("/auth/reset", {
                    method: "POST",
                    body: JSON.stringify({
                      token: f.get("token"),
                      new_password: f.get("password"),
                    }),
                  });
                  setMessage("Đã đặt lại mật khẩu. Vui lòng đăng nhập.");
                } else {
                  const me = await api<User>("/auth/login", {
                    method: "POST",
                    body: JSON.stringify({
                      username: f.get("username"),
                      password: f.get("password"),
                    }),
                  });
                  router.replace(me.must_change_password ? "/account" : "/");
                }
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {reset ? (
              <label>
                Mã đặt lại mật khẩu
                <input
                  name="token"
                  required
                  minLength={32}
                  maxLength={200}
                  autoComplete="off"
                />
              </label>
            ) : (
              <label>
                Tên đăng nhập
                <input
                  name="username"
                  required
                  maxLength={100}
                  autoComplete="username"
                  placeholder="Tên đăng nhập JKC"
                />
              </label>
            )}
            <label>
              {reset ? "Mật khẩu mới (tối thiểu 12 ký tự)" : "Mật khẩu"}
              <input
                type="password"
                name="password"
                required
                minLength={reset ? 12 : 1}
                maxLength={256}
                autoComplete={reset ? "new-password" : "current-password"}
                placeholder="Nhập mật khẩu của bạn"
              />
            </label>
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
            <button className="button" disabled={busy}>
              {busy ? "Đang xử lý…" : reset ? "Đặt lại mật khẩu" : "Đăng nhập"}
              <Icon name="arrow" />
            </button>
          </form>
          <Link href={reset ? "/login" : "/reset"}>
            {reset
              ? "Quay lại đăng nhập"
              : "Quên mật khẩu? Liên hệ quản trị viên để nhận mã."}
          </Link>
          <p className="login-note">
            Tài khoản JKC độc lập. Mật khẩu không đồng bộ với Odoo.
          </p>
          <p className="demo-notice">Sprint 0 · Môi trường kiểm thử DEMO</p>
        </div>
      </section>
    </main>
  );
}
