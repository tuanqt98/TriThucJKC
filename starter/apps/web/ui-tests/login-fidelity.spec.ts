import { test, expect } from "@playwright/test";
test("UI-01: assets thật, bố cục, nhớ tên và viewport bàn phím", async ({
  page,
}, info) => {
  await page.goto("/login");
  const user = page.getByLabel("Tên đăng nhập", { exact: true });
  await expect(user).toBeEnabled();
  const logo = page.getByRole("img", { name: "IN NHAT THAN — Tri Thức JKC" });
  await expect(logo).toBeVisible();
  const ratio = await logo.evaluate((e) => {
    const i = e as HTMLImageElement;
    return {
      render: i.width / i.height,
      natural: i.naturalWidth / i.naturalHeight,
    };
  });
  expect(Math.abs(ratio.render - ratio.natural)).toBeLessThan(0.02);
  await expect(page.locator(".login-story")).toHaveCSS(
    "background-image",
    /login-approved\/background\.jpg/,
  );
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toHaveCSS("background-color", "rgb(201, 35, 49)");
  const hero = await page.locator(".login-story").boundingBox(),
    form = await user.boundingBox(),
    brand = await logo.boundingBox();
  if (info.project.name === "desktop")
    expect(hero!.x + hero!.width).toBeLessThan(form!.x);
  else {
    expect(brand!.y + brand!.height).toBeLessThan(hero!.y + 1);
    expect(hero!.y + hero!.height).toBeLessThan(form!.y);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Real browser storage; no password/token/session is persisted by this feature.
  await user.fill("ui01-demo-remember");
  await page.getByLabel("Ghi nhớ đăng nhập", { exact: true }).check();
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("synthetic-only-input");
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Tài khoản hoặc mật khẩu không đúng." },
      }),
    }),
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "mật khẩu không đúng",
  );
  expect(await page.evaluate(() => Object.entries(localStorage))).toEqual([
    ["jkc.login.username.v1", "ui01-demo-remember"],
  ]);
  await page.reload();
  await expect(user).toHaveValue("ui01-demo-remember");
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveValue("");
  await page.getByLabel("Ghi nhớ đăng nhập", { exact: true }).uncheck();
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("synthetic-only-input");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("jkc.login.username.v1")),
  ).toBeNull();
  if (info.project.name !== "desktop") {
    await page.setViewportSize({
      width: info.project.use.viewport!.width,
      height: 430,
    });
    await page.getByLabel("Mật khẩu", { exact: true }).focus();
    await page
      .getByRole("button", { name: "Đăng nhập", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Đăng nhập", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("UI-01: loading, mạng lỗi và thông báo phiên hết hạn", async ({
  page,
}) => {
  await page.goto("/login?reason=session-expired");
  await expect(page.getByRole("status")).toContainText(
    "Phiên đăng nhập đã hết hạn",
  );
  await page
    .getByLabel("Tên đăng nhập", { exact: true })
    .fill("ui01-demo-error");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("synthetic-only-input");
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/auth/login", async (route) => {
    await pending;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Đang xử lý…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toBeDisabled();
  release();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Không thể kết nối máy chủ",
  );
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeEnabled();
});
test("UI-01: đăng nhập DEMO thật, cookie và session giữ nguyên", async ({
  page,
}) => {
  const password = process.env.UI_DEMO_PASSWORD;
  if (!password)
    throw new Error(
      "Cần UI_DEMO_PASSWORD từ env riêng; không commit credential.",
    );
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("employee");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/auth/login" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  const me = await page.request.get("/api/v1/auth/me");
  expect(me.status()).toBe(200);
  expect((await me.json()).username).toBe("employee");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "jkc_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.path).toBe("/api");
  // Session cleanup through the existing API only. Dashboard source is untouched.
  const csrf = (await me.json()).csrf_token;
  const result = await page.request.post("/api/v1/auth/logout", {
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf },
  });
  expect(result.status()).toBe(200);
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
});
