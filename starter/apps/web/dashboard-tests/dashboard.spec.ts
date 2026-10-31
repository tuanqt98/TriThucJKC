import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, username = "employee") {
  if (!process.env.UI_DEMO_PASSWORD)
    throw new Error("Cần credential DEMO từ env riêng.");
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.UI_DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Tri thức nổi bật", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Đang tải nhiệm vụ…", { exact: true }),
  ).toHaveCount(0);
}
test.afterEach(async ({ page }) => {
  const r = await page.request.get("/api/v1/auth/me");
  if (r.ok()) {
    const me = await r.json();
    await page.request.post("/api/v1/auth/logout", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-CSRF-Token": me.csrf_token,
      },
    });
  }
});
test("UI-02: dữ liệu thật, nhiệm vụ, điều hướng và responsive", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  for (const asset of [
    "offset",
    "prepress",
    "digital",
    "flexo",
    "finishing",
    "quality",
  ]) {
    const response = await page.request.get(
      `/images/dashboard-demo/${asset}.webp`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const data = await (await page.request.get("/api/v1/dashboard")).json();
  for (const [i, count] of [
    data.documents,
    data.learning,
    data.incidents,
  ].entries())
    await expect(page.locator(".stat strong").nth(i)).toHaveText(String(count));
  const reading = await (await page.request.get("/api/v1/my/reading")).json(),
    learning = await (await page.request.get("/api/v1/my/learning")).json();
  const total =
    reading.filter(
      (r: { acknowledged_at: string | null; is_current: boolean }) =>
        !r.acknowledged_at && r.is_current,
    ).length +
    learning.filter((l: { completed_at: string | null }) => !l.completed_at)
      .length;
  await expect(
    page.getByRole("heading", { name: `Việc cần làm (${total})`, exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng chính" })
      .getByRole("link", { name: "Phê duyệt", exact: true }),
  ).toHaveCount(0);
  const process = page
    .getByRole("heading", { name: "Truy cập nhanh theo khu vực sản xuất" })
    .locator("..")
    .locator("..");
  await expect(process.locator("a")).toHaveCount(5);
  expect((await page.request.get("/api/v1/approvals")).status()).toBe(403);
  await page.getByRole("button", { name: "Xem tất cả →", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Thu gọn ↑", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Thu gọn ↑", exact: true }).click();
  const desktop = info.project.name === "desktop",
    mobile = info.project.name.startsWith("mobile");
  if (desktop) {
    await page.getByRole("button", { name: "Thu gọn sidebar" }).click();
    await expect(
      page.getByRole("button", { name: "Mở rộng sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Mở rộng sidebar" }).click();
  }
  if (mobile) {
    await expect(
      page.getByRole("navigation", { name: "Điều hướng di động" }),
    ).toBeVisible();
    const tasks = await page.locator("#dashboard-tasks").boundingBox();
    const featured = await page
      .getByRole("heading", { name: "Tri thức nổi bật", exact: true })
      .boundingBox();
    expect(tasks!.y).toBeLessThan(featured!.y);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Thông báo", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Thông báo hệ thống" }),
  ).toContainText("chưa được kết nối");
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await page.getByLabel("Tìm trong kho tri thức").fill("khôngcókếtquảui02");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(page).toHaveURL(/\/knowledge\?q=/);
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy kết quả phù hợp." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("UI-02: lỗi Dashboard, retry và empty không bịa số liệu", async ({
  page,
}) => {
  await login(page);
  let fail = true;
  await page.route("**/api/v1/dashboard", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Dashboard tạm thời không khả dụng." },
          }),
        })
      : route.fulfill({
          json: {
            documents: 0,
            learning: 0,
            incidents: 0,
            articles: 0,
            pending_approvals: 0,
            processes: [],
            featured: [],
          },
        }),
  );
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "tạm thời không khả dụng",
  );
  fail = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByText("Chưa có tri thức được duyệt trong phạm vi của bạn."),
  ).toBeVisible();
  await expect(page.getByText("Chưa có danh mục công đoạn.")).toBeVisible();
  await expect(page.locator(".stat strong").first()).toHaveText("0");
});
test("UI-02: lỗi nhiệm vụ độc lập và session hết hạn", async ({ page }) => {
  await login(page);
  await page.route("**/api/v1/my/reading", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { message: "Không có quyền." } },
    }),
  );
  await page.reload();
  await expect(
    page.locator("#dashboard-tasks").getByRole("alert"),
  ).toContainText("Không tải được nhiệm vụ đọc.");
  await expect(
    page.getByRole("heading", { name: "Tri thức nổi bật", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/my/reading");
  await page.route("**/api/v1/dashboard", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { message: "Phiên đã hết hạn." } },
    }),
  );
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeEnabled();
});
test("UI-02: menu trưởng bộ phận và liên kết công đoạn", async ({
  page,
}, info) => {
  await login(page, "head");
  const mobile = info.project.name.startsWith("mobile");
  if (mobile)
    await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
  await expect(
    page
      .getByRole("navigation", {
        name: mobile ? "Menu di động" : "Điều hướng chính",
      })
      .getByRole("link", { name: "Phê duyệt", exact: true }),
  ).toHaveCount(1);
  if (mobile)
    await page.getByRole("button", { name: "Đóng menu điều hướng" }).click();
  const processes = page
    .getByRole("heading", { name: "Truy cập nhanh theo khu vực sản xuất" })
    .locator("..")
    .locator("..");
  await processes.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/knowledge\?processId=/);
  await expect(
    page.getByRole("heading", { name: "Kho tri thức", exact: true }),
  ).toBeVisible();
});
