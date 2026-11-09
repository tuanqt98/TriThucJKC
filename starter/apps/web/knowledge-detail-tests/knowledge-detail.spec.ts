import { test, expect, request, type Page } from "@playwright/test";
import { createArticleWithFiles } from "./fixture";

const password = process.env.UI_DEMO_PASSWORD || "";
test.skip(!password, "Cần UI_DEMO_PASSWORD (tài khoản DEMO).");

const isMobile = (project: string) => project.startsWith("mobile");
const TZ = "Asia/Ho_Chi_Minh";
const day = (v: string) =>
  new Date(v).toLocaleDateString("vi-VN", { timeZone: TZ });
const backLink = (page: Page) =>
  page
    .getByRole("navigation", { name: "Đường dẫn" })
    .getByRole("link", { name: "Kho tri thức" });
const libraryCards = (page: Page) =>
  page.getByRole("list", { name: "Danh sách kết quả" }).getByRole("link");

async function login(page: Page, username = "employee") {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function logout(page: Page) {
  const r = await page.request.get("/api/v1/auth/me");
  if (!r.ok()) return;
  const me = await r.json();
  await page.request.post("/api/v1/auth/logout", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": me.csrf_token,
    },
  });
}
async function detailReady(page: Page) {
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
  await expect(page.locator("#article-title")).toBeVisible();
}
async function libraryReady(page: Page) {
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
  await expect(page.locator("main p[role=status]")).not.toHaveText("Đang tìm…");
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
const token = (project: string) => `ui05b${project}${Date.now()}`;

test.afterEach(async ({ page }) => logout(page));

test("UI-05B: dữ liệu thật từ API, thứ tự mục, ảnh đại diện + ảnh theo bước, tệp, người duyệt, ẩn mã kỹ thuật", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mobile = isMobile(info.project.name);
  const a = await createArticleWithFiles({
    request,
    password,
    token: token(info.project.name),
  });
  await login(page);
  await page.goto(`/knowledge/${a.id}`);
  await detailReady(page);
  const api = await (await page.request.get(`/api/v1/articles/${a.id}`)).json();

  await expect(page.locator("#article-title")).toHaveText(api.title);
  // jsonb key order is not the display order: 1, 2, 3, 6, 10.
  const headings = await page.locator("#panel-content h2").allTextContents();
  expect(headings.map((h) => h.replace(/^\d+/, ""))).toEqual([
    "Mô tả vấn đề",
    "Điều kiện phát sinh",
    "Các bước đã kiểm tra",
    "Lưu ý an toàn",
    "Phụ lục",
  ]);
  const steps = page.getByRole("region", { name: "Các bước đã kiểm tra" });
  await expect(steps.locator("ol > li")).toHaveText([
    "So sánh với mẫu",
    "Kiểm tra nhãn lô",
  ]);
  // Metadata only from the API; technical S1- code and old placeholders are not shown.
  const meta = page.locator("main dl").first();
  for (const v of [
    api.author_name,
    api.department_name,
    api.process_name,
    day(api.approved_at),
    `v${api.version_number} · hiện hành`,
  ])
    await expect(meta).toContainText(v);
  expect(api.code).toMatch(/^S1-/);
  await expect(page.getByText(api.code)).toHaveCount(0);
  await expect(page.getByText("Nội dung DEMO để kiểm thử")).toHaveCount(0);
  await expect(page.getByText(/Lịch sử xác nhận/)).toHaveCount(0);

  // Cover = first image not referenced by a step; step 2 shows its image in place of the filename line.
  const cover = page.getByRole("img", { name: "DEMO-anh-dai-dien.png" });
  await expect(cover.first()).toBeVisible();
  expect(
    await cover
      .first()
      .evaluate((i: HTMLImageElement) => i.decode().then(() => i.naturalWidth)),
  ).toBeGreaterThan(0);
  const step2 = page.getByRole("region", { name: "Điều kiện phát sinh" });
  await expect(
    step2.getByRole("img", { name: "DEMO-buoc-2.png" }),
  ).toBeVisible();
  await expect(step2.getByText("Ảnh: DEMO-buoc-2.png")).toHaveCount(0);

  // Related: same process, approved, in scope, never the current article.
  const related = page.getByRole("region", { name: "Cùng công đoạn" });
  await expect(related).toBeVisible();
  const allowed = new Set(
    (
      await (
        await page.request.get(
          `/api/v1/articles?processId=${api.process_id}&pageSize=4`,
        )
      ).json()
    ).items.map((i: { id: string }) => `/knowledge/${i.id}`),
  );
  for (const href of await related
    .getByRole("link")
    .evaluateAll((ls) => ls.map((l) => l.getAttribute("href"))))
    expect(allowed.has(href) && href !== `/knowledge/${a.id}`).toBe(true);

  if (mobile) {
    await expect(page.getByRole("region", { name: /Ảnh & tệp/ })).toBeHidden();
    await page.getByRole("tab", { name: "Ảnh & tệp (3)" }).click();
    await expect(page.locator("#panel-content")).toBeHidden();
  } else
    await expect(
      page.getByRole("tablist", { includeHidden: true }),
    ).toBeHidden(); // tabs are mobile-only
  const files = page.getByRole("region", { name: "Ảnh & tệp đính kèm (3)" });
  await expect(files.getByRole("listitem")).toHaveCount(3);
  const pdf = files.getByRole("link", { name: "Tải DEMO-phieu.pdf" });
  expect(
    (await page.request.get((await pdf.getAttribute("href"))!)).status(),
  ).toBe(200);

  if (mobile) await page.getByRole("tab", { name: "Phê duyệt" }).click();
  const approval = page.getByRole("region", { name: "Phê duyệt & phiên bản" });
  expect(api.approver_name).toBeTruthy();
  await expect(approval).toContainText(api.approver_name);
  await expect(approval).toContainText(`v${api.version_number}`);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("UI-05B: quay lại Kho tri thức giữ từ khóa, bộ lọc, trang, kiểu xem (cả sau reload, mở trực tiếp, nhiều tab)", async ({
  page,
}, info) => {
  await login(page);
  const list = "/knowledge?q=DEMO&type=ARTICLE&sort=title&page=2&view=grid";
  await page.goto(list);
  await libraryReady(page);
  const first = await libraryCards(page).first().getAttribute("href");
  await libraryCards(page).first().click();
  await expect(page).toHaveURL(new RegExp(`${first}$`));
  await detailReady(page);
  await backLink(page).click();
  await expect(page).toHaveURL(list);
  await libraryReady(page);
  await expect(
    page.getByRole("searchbox", { name: "Từ khóa tìm tri thức" }),
  ).toHaveValue("DEMO");
  await expect(libraryCards(page).first()).toHaveAttribute("href", first!);

  // Reload the article, then go back: still the same list.
  await libraryCards(page).first().click();
  await detailReady(page);
  await page.reload();
  await detailReady(page);
  await expect(backLink(page)).toHaveAttribute("href", list);
  await backLink(page).click();
  await expect(page).toHaveURL(list);

  // Library → article A → related article B → "Kho tri thức" returns to the saved list (not to A).
  const t = token(info.project.name);
  await createArticleWithFiles({ request, password, token: t });
  await createArticleWithFiles({ request, password, token: t });
  const own = `/knowledge?q=${t}&view=grid`;
  await page.goto(own);
  await libraryReady(page);
  await libraryCards(page).first().click();
  await detailReady(page);
  await page
    .getByRole("region", { name: "Cùng công đoạn" })
    .getByRole("link", { name: new RegExp(t) })
    .click();
  await detailReady(page);
  await backLink(page).click();
  await expect(page).toHaveURL(own);

  // A second tab has its own state; a direct open in a fresh tab falls back to the default library.
  await libraryCards(page).first().click();
  await detailReady(page);
  const other = await page.context().newPage();
  await other.goto(`/knowledge/${page.url().split("/").pop()}`);
  await detailReady(other);
  await expect(backLink(other)).toHaveAttribute("href", "/knowledge");
  await other.goto("/knowledge?q=khac&sort=oldest");
  await libraryReady(other);
  await other.close();
  await expect(backLink(page)).toHaveAttribute("href", own);
});

test("UI-05B: chỉ bài đã duyệt trong phạm vi; nháp, chờ duyệt, ngoài phạm vi và chưa đăng nhập bị chặn", async ({
  page,
}, info) => {
  const t = token(info.project.name);
  const [approved, draft, pending] = await Promise.all(
    (["approved", "draft", "pending"] as const).map((state) =>
      createArticleWithFiles({ request, password, token: t, state }),
    ),
  );
  const notFound = page.getByRole("heading", {
    name: "Không tìm thấy bài viết",
  });
  await login(page);
  for (const a of [draft, pending]) {
    await page.goto(`/knowledge/${a.id}`);
    await expect(notFound).toBeVisible();
    await expect(page.getByText(a.title)).toHaveCount(0);
  }
  await page.goto(`/knowledge/${approved.id}`);
  await detailReady(page);
  for (const user of ["other", "admin"]) {
    await logout(page);
    await login(page, user);
    await page.goto(`/knowledge/${approved.id}`);
    await expect(notFound).toBeVisible();
    await expect(page.getByText(approved.title)).toHaveCount(0);
    await expect(page.getByRole("img", { name: /DEMO-/ })).toHaveCount(0);
    expect(
      (
        await page.request.get(
          `/api/v1/content-versions/${approved.version_id}/attachments`,
        )
      ).status(),
    ).toBe(404);
  }
  await logout(page);
  await page.goto(`/knowledge/${approved.id}`);
  await expect(page).toHaveURL(/\/login/);
});

test("UI-05B: trạng thái đang tải, lỗi + thử lại, 403, lỗi tệp không chặn nội dung, không tồn tại", async ({
  page,
}, info) => {
  const a = await createArticleWithFiles({
    request,
    password,
    token: token(info.project.name),
  });
  await login(page);
  const route = `**/api/v1/articles/${a.id}`;

  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(route, async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto(`/knowledge/${a.id}`);
  await expect(
    page.getByRole("status", { name: "Đang tải bài viết" }),
  ).toBeVisible();
  release();
  await detailReady(page);
  await page.unroute(route);

  await page.route(route, (r) =>
    r.fulfill({
      status: 500,
      json: { error: { code: "X", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto(`/knowledge/${a.id}`);
  await expect(
    page.getByRole("heading", { name: "Không thể tải bài viết" }),
  ).toBeVisible();
  await page.unroute(route);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await detailReady(page);

  await page.route(route, (r) =>
    r.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Không đủ quyền." } },
    }),
  );
  await page.goto(`/knowledge/${a.id}`);
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem bài viết này" }),
  ).toBeVisible();
  await page.unroute(route);

  await page.route("**/api/v1/content-versions/*/attachments", (r) =>
    r.fulfill({ status: 500, json: { error: { code: "X", message: "x" } } }),
  );
  await page.goto(`/knowledge/${a.id}`);
  await detailReady(page);
  await expect(page.locator("#panel-content h2").first()).toBeVisible();
  if (isMobile(info.project.name))
    await page.getByRole("tab", { name: /Ảnh & tệp/ }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Không tải được ảnh và tệp đính kèm",
  );
  await page.unroute("**/api/v1/content-versions/*/attachments");

  await page.goto("/knowledge/00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy bài viết" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
