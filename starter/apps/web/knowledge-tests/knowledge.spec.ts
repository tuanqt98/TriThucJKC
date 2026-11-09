import { readFileSync } from "node:fs";
import { test, expect, request, type Page } from "@playwright/test";
import { createArticles } from "./fixture";

const password = process.env.UI_DEMO_PASSWORD || "";
const uat = process.env.UI_UAT_FIXTURES
  ? JSON.parse(readFileSync(process.env.UI_UAT_FIXTURES, "utf8"))
  : null;
test.skip(
  !password || !uat?.api,
  "Cần UI_DEMO_PASSWORD và UI_UAT_FIXTURES (tác giả DEMO).",
);

const isMobile = (project: string) => project.startsWith("mobile");
const count = (page: Page) => page.locator("main p[role=status]");
const cards = (page: Page) =>
  page.getByRole("list", { name: "Danh sách kết quả" }).getByRole("link");
const searchBox = (page: Page) =>
  page.getByRole("searchbox", { name: "Từ khóa tìm tri thức" });

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
async function ready(page: Page) {
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
  await expect(count(page)).not.toHaveText("Đang tìm…");
}
async function total(page: Page, query: string) {
  let n = 0;
  for (const endpoint of ["/api/v1/articles", "/api/v1/incidents"])
    n += (
      await (await page.request.get(`${endpoint}?pageSize=1&${query}`)).json()
    ).total;
  return n;
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
/** Unique DEMO articles for this run; returns the token used in titles. */
async function seed(
  project: string,
  states: ("approved" | "draft" | "pending")[] = ["approved"],
) {
  const token = `ui05${project}${Date.now()}`;
  const created = await createArticles({
    request,
    password,
    author: uat.api.username,
    approver: "head",
    articles: states.map((state, i) => ({
      title: `DEMO · Tra cứu ${token} ${state} ${i}`,
      body: {
        "Ghi chú":
          "DEMO · bài kiểm thử tự động, không phải hướng dẫn vận hành.",
      },
      processCode: "FLEXO",
      state,
    })),
  });
  return { token, created };
}

test.afterEach(async ({ page }) => logout(page));

test("UI-05: dữ liệu thật, tìm kiếm có/không kết quả, URL và tìm kiếm phân biệt dấu", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { token } = await seed(info.project.name);
  await login(page);
  await page.goto("/knowledge");
  await ready(page);
  await expect(count(page)).toHaveText(`${await total(page, "")} bài đã duyệt`);
  await noHorizontalOverflow(page);

  // Debounced search without pressing Enter; URL is shareable.
  await searchBox(page).fill(token);
  await expect(count(page)).toHaveText(`Tìm thấy 1 kết quả cho “${token}”`);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Đã duyệt");
  await expect(cards(page).first()).toContainText("In flexo / Bao bì");
  await expect(page).toHaveURL(new RegExp(`[?&]q=${token}`));
  await page.reload();
  await ready(page);
  await expect(searchBox(page)).toHaveValue(token);
  await expect(cards(page)).toHaveCount(1);

  // Backend ILIKE is accent-sensitive: document the gap instead of claiming it works.
  await searchBox(page).fill("tra cuu " + token);
  await searchBox(page).press("Enter");
  await expect(count(page)).toHaveText(
    `Tìm thấy 0 kết quả cho “tra cuu ${token}”`,
  );
  await expect(
    page.getByText("Tìm kiếm hiện phân biệt dấu tiếng Việt"),
  ).toBeVisible();
  await searchBox(page).fill("Tra cứu " + token);
  await searchBox(page).press("Enter");
  await expect(cards(page)).toHaveCount(1);

  await searchBox(page).fill(`khongtontai${Date.now()}`);
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy kết quả phù hợp" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa từ khóa" }).click();
  await expect(count(page)).toHaveText(/bài đã duyệt$/);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("UI-05: bộ lọc công đoạn + loại + bộ phận, xóa bộ lọc, phân trang và quay lại từ bài viết", async ({
  page,
}, info) => {
  await seed(info.project.name);
  await login(page);
  const processes: { id: string; code: string }[] = await (
    await page.request.get("/api/v1/processes")
  ).json();
  const flexo = processes.find((p) => p.code === "FLEXO")!.id;
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  await page.goto("/knowledge");
  await ready(page);
  const mobile = isMobile(info.project.name);
  if (mobile) await page.getByRole("button", { name: /^Bộ lọc/ }).click();
  const scope = mobile
    ? page.getByRole("dialog", { name: "Bộ lọc" })
    : page.locator("main");
  await scope.getByLabel("Lọc công đoạn").selectOption(flexo);
  await scope.getByLabel("Lọc bộ phận").selectOption(me.department_id);
  if (mobile)
    await page.getByRole("button", { name: /^Xem \d+ kết quả/ }).click();
  await page.getByRole("button", { name: "Bài tri thức", exact: true }).click();
  await ready(page);
  const expected = (
    await (
      await page.request.get(`/api/v1/articles?pageSize=1&processId=${flexo}`)
    ).json()
  ).total;
  await expect(count(page)).toHaveText(`${expected} bài đã duyệt`);
  for (const card of await cards(page).all())
    await expect(card).toContainText("In flexo / Bao bì");
  await expect(page).toHaveURL(/processId=.*type=ARTICLE.*department=/);
  if (mobile)
    await expect(
      page.getByRole("button", { name: "Bộ lọc (3)" }),
    ).toBeVisible();

  await page.getByRole("button", { name: "Xóa bộ lọc" }).first().click();
  await ready(page);
  const all = await total(page, "");
  await expect(count(page)).toHaveText(`${all} bài đã duyệt`);
  await expect(page).toHaveURL(/\/knowledge$/);

  // Page 2, open an article, Back restores page + list.
  test.skip(all <= 8, "Cần hơn 8 bài để kiểm tra phân trang.");
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.getByText(/^Trang 2\//)).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  const first = cards(page).first();
  const href = await first.getAttribute("href");
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await page.goBack();
  await ready(page);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/^Trang 2\//)).toBeVisible();
  await expect(cards(page).first()).toHaveAttribute("href", href!);
  await noHorizontalOverflow(page);
});

test("UI-05: chỉ bài đã duyệt trong phạm vi; nháp, chờ duyệt và ngoài phạm vi bị ẩn", async ({
  page,
}, info) => {
  const { token, created } = await seed(info.project.name, [
    "approved",
    "draft",
    "pending",
  ]);
  await login(page);
  await page.goto(`/knowledge?q=${token}`);
  await ready(page);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("approved");
  await expect(
    page.getByRole("link", { name: "Chia sẻ kiến thức" }).first(),
  ).toBeVisible();
  for (const c of created.filter((x) => x.state !== "approved"))
    expect((await page.request.get(`/api/v1/articles/${c.id}`)).status()).toBe(
      404,
    );
  await logout(page);
  for (const user of ["other", "admin"]) {
    await login(page, user);
    await page.goto(`/knowledge?q=${token}`);
    await ready(page);
    await expect(cards(page)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy kết quả phù hợp" }),
    ).toBeVisible();
    expect(
      (await page.request.get(`/api/v1/articles/${created[0].id}`)).status(),
    ).toBe(404);
    await logout(page);
  }
  await page.goto("/knowledge");
  await expect(page).toHaveURL(/\/login/);
});

test("UI-05: loading, rỗng, lỗi + thử lại, 403 và gõ nhanh không hiện kết quả cũ", async ({
  page,
}, info) => {
  const { token } = await seed(info.project.name);
  await login(page);

  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/articles?q=*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/knowledge");
  await expect(
    page.getByRole("status", { name: "Đang tải kho tri thức" }),
  ).toBeVisible();
  release();
  await ready(page);
  await page.unroute("**/api/v1/articles?q=*");

  const empty = (route: import("@playwright/test").Route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 100 } });
  await page.route("**/api/v1/articles?q=*", empty);
  await page.route("**/api/v1/incidents?q=*", empty);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Chưa có bài tri thức được duyệt" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/articles?q=*");
  await page.unroute("**/api/v1/incidents?q=*");

  let fail = true;
  await page.route("**/api/v1/articles?q=*", (route) =>
    fail
      ? route.fulfill({
          status: 500,
          json: { error: { code: "X", message: "Lỗi kết nối (giả lập)." } },
        })
      : route.continue(),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Không thể tải kho tri thức" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await ready(page);
  await expect(count(page)).toHaveText(/bài đã duyệt$/);
  await page.unroute("**/api/v1/articles?q=*");

  await page.route("**/api/v1/articles?q=*", (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Không đủ quyền." } },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem kho tri thức" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/articles?q=*");

  // Rapid typing: the slow response for the first keyword must not replace the newer result.
  await page.goto("/knowledge");
  await ready(page);
  await page.route("**/api/v1/articles?q=*", async (route) => {
    if (route.request().url().includes("cham-cham"))
      await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await searchBox(page).fill("cham-cham");
  await page.waitForTimeout(500); // debounce fired, slow request in flight
  await searchBox(page).fill(token);
  await expect(count(page)).toHaveText(`Tìm thấy 1 kết quả cho “${token}”`);
  await page.waitForTimeout(1600); // let the stale response arrive
  await expect(count(page)).toHaveText(`Tìm thấy 1 kết quả cho “${token}”`);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(token);
  await noHorizontalOverflow(page);
});
