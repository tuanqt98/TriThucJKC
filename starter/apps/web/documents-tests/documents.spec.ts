import { test, expect, type Page } from "@playwright/test";

type Doc = { id: string; code: string; title: string; version_id: string };
type Task = {
  content_id: string;
  version_id: string;
  acknowledged_at: string | null;
  due_at: string | null;
  is_current: boolean;
};

async function login(page: Page, username = "employee") {
  if (!process.env.UI_DEMO_PASSWORD)
    throw new Error("Cần credential DEMO từ env riêng.");
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.UI_DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function openLibrary(page: Page) {
  await page.goto("/documents");
  await expect(
    page.getByRole("heading", { name: /nội quy & quy trình/i }).first(),
  ).toBeVisible();
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
}
async function allDocuments(page: Page): Promise<Doc[]> {
  const items: Doc[] = [];
  for (let p = 1; ; p++) {
    const r = await page.request.get(
      `/api/v1/documents?page=${p}&pageSize=100`,
    );
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    items.push(...body.items);
    if (items.length >= body.total) return items;
  }
}
const isMobile = (w: number) => w < 768;
const resultCount = (page: Page) =>
  page.getByRole("status").filter({ hasText: "tài liệu phù hợp" });
async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
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

test("UI-03: dữ liệu API, trạng thái đọc và responsive", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await openLibrary(page);
  const docs = await allDocuments(page);
  const tasks: Task[] = await (
    await page.request.get("/api/v1/my/reading")
  ).json();
  await expect(resultCount(page)).toContainText(
    `${docs.length} tài liệu phù hợp`,
  );
  const overview = page.getByRole("complementary", {
    name: "Tổng quan tài liệu",
  });
  await expect(overview.getByRole("button").first()).toContainText(
    String(docs.length),
  );
  // Chờ xác nhận = nhiệm vụ hiện hành, chưa ACK, chưa quá hạn, khớp phiên bản ban hành.
  const versions = new Set(docs.map((d) => `${d.id}:${d.version_id}`));
  const current = tasks.filter(
    (t) => t.is_current && versions.has(`${t.content_id}:${t.version_id}`),
  );
  const now = Date.now();
  const pending = current.filter(
    (t) => !t.acknowledged_at && !(t.due_at && Date.parse(t.due_at) < now),
  ).length;
  const acked = current.filter((t) => t.acknowledged_at).length;
  await expect(
    overview.getByRole("button", { name: /Chờ xác nhận/ }),
  ).toContainText(String(pending));
  await expect(
    overview.getByRole("button", { name: /Đã xác nhận/ }),
  ).toContainText(String(acked));
  await expect(
    page.getByRole("complementary", { name: "Tài liệu bắt buộc của tôi" }),
  ).toContainText(`${acked}/${current.length}`);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("UI-03: tìm kiếm, bộ lọc và xem tài liệu", async ({ page }, info) => {
  await login(page);
  await openLibrary(page);
  const docs = await allDocuments(page);
  const target = docs[0];
  const mobile = isMobile(info.project.use.viewport!.width);

  await page.getByLabel("Lọc theo tiêu đề").fill(target.code);
  await page
    .getByRole("button", { name: "Tìm kiếm", exact: true })
    .last()
    .click();
  await expect(resultCount(page)).toContainText("1 tài liệu phù hợp");

  await page.getByLabel("Lọc theo tiêu đề").fill("khong-ton-tai-zzz-ui03");
  await page
    .getByRole("button", { name: "Tìm kiếm", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy kết quả phù hợp." }),
  ).toBeVisible();
  await page
    .locator("main")
    .getByRole("button", { name: "Xóa bộ lọc" })
    .last()
    .click();
  await expect(resultCount(page)).toContainText(
    `${docs.length} tài liệu phù hợp`,
  );

  // Trạng thái đọc: "Không được giao" + "Được giao" phải cộng lại bằng tổng.
  await page.getByLabel("Lọc trạng thái đọc").selectOption("NOT_ASSIGNED");
  const notAssigned = Number(
    (await resultCount(page).textContent())!.match(/\d+/)![0],
  );
  await page.getByLabel("Lọc trạng thái đọc").selectOption("");
  const toggle = page.getByRole("button", { name: /Bộ lọc khác/ });
  if (mobile) {
    await expect(page.getByLabel("Lọc phiên bản")).toBeHidden();
    await toggle.click();
    await expect(
      page.getByRole("button", { name: /Thu gọn bộ lọc/ }),
    ).toHaveAttribute("aria-expanded", "true");
  } else await expect(toggle).toBeHidden();
  await page.getByLabel("Lọc yêu cầu đọc").selectOption("yes");
  const assigned = Number(
    (await resultCount(page).textContent())!.match(/\d+/)![0],
  );
  expect(assigned + notAssigned).toBe(docs.length);
  await page.getByLabel("Lọc yêu cầu đọc").selectOption("");
  await page.getByLabel("Lọc phiên bản").selectOption("1");
  await expect(resultCount(page)).toContainText("tài liệu phù hợp");
  await noHorizontalOverflow(page);

  // Xem chi tiết
  await page.getByLabel("Lọc phiên bản").selectOption("");
  await page.getByLabel("Lọc theo tiêu đề").fill(target.code);
  await page
    .getByRole("button", { name: "Tìm kiếm", exact: true })
    .last()
    .click();
  const link = mobile
    ? page.locator(`a[href="/documents/${target.id}"]:visible`).first()
    : page.getByRole("link", { name: "Xem tài liệu" }).first();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/documents/${target.id}$`));
  await expect(page.getByText(target.title).first()).toBeVisible();
});

test("UI-03: phân quyền theo ACL, admin không bypass", async ({ page }) => {
  const seen: Record<string, Set<string>> = {};
  for (const user of ["employee", "other", "admin"]) {
    await login(page, user);
    await openLibrary(page);
    const docs = await allDocuments(page);
    seen[user] = new Set(docs.map((d) => d.id));
    await expect(resultCount(page)).toContainText(
      `${docs.length} tài liệu phù hợp`,
    );
    const me = await (await page.request.get("/api/v1/auth/me")).json();
    await page.request.post("/api/v1/auth/logout", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-CSRF-Token": me.csrf_token,
      },
    });
  }
  // TECH_ADMIN không có bypass: chỉ thấy tập con của phạm vi nhân viên sản xuất.
  expect(seen.admin.size).toBeLessThan(seen.employee.size);
  for (const id of seen.admin) expect(seen.employee.has(id)).toBeTruthy();
  await page.goto("/documents");
  await expect(page).toHaveURL(/\/login/);
});

test("UI-03: loading, empty, error và permission-denied", async ({ page }) => {
  await login(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/documents?**", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/documents");
  await expect(
    page.getByRole("status", { name: "Đang tải thư viện tài liệu" }),
  ).toBeVisible();
  release();
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
  await page.unroute("**/api/v1/documents?**");

  await page.route("**/api/v1/documents?**", (route) =>
    route.fulfill({
      json: { items: [], total: 0, page: 1, pageSize: 100 },
    }),
  );
  await openLibrary(page);
  await expect(
    page.getByRole("heading", { name: "Chưa có tài liệu được quyền xem." }),
  ).toBeVisible();
  await page.unroute("**/api/v1/documents?**");

  await page.route("**/api/v1/documents?**", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "INTERNAL", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto("/documents");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Không thể tải tài liệu",
  );
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await page.unroute("**/api/v1/documents?**");

  await page.route("**/api/v1/documents?**", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Không đủ quyền." } },
    }),
  );
  await page.goto("/documents");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Bạn không có quyền xem danh sách này",
  );
  await page.unroute("**/api/v1/documents?**");

  await page.route("**/api/v1/my/reading", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "X", message: "x" } },
    }),
  );
  await openLibrary(page);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Không tải được trạng thái xác nhận đọc",
  );
  await expect(page.getByLabel("Lọc trạng thái đọc")).toBeDisabled();
});
