import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

// Read-only DEMO guides from scripts/ui-incident-detail/fixture.mjs (.local/ui06.json); reusable across runs.
const password = process.env.UI_DEMO_PASSWORD || "";
const fx = process.env.UI_INCIDENT_FIXTURES
  ? JSON.parse(readFileSync(process.env.UI_INCIDENT_FIXTURES, "utf8"))
  : null;
test.skip(
  !password || !fx?.main,
  "Cần UI_DEMO_PASSWORD và UI_INCIDENT_FIXTURES (.local/ui06.json).",
);

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
const notFound = (page: Page) =>
  page.getByRole("heading", { name: "Không tìm thấy sự cố" });

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
  await expect(page.locator("#incident-title")).toBeVisible();
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
const section = (page: Page, name: string) =>
  page.locator("main section").filter({
    has: page.getByRole("heading", { name: new RegExp(`^${name}`) }),
  });

test.afterEach(async ({ page }) => logout(page));

test("UI-06: dữ liệu thật từ API, thứ tự mục, giả thuyết chưa xác minh, ảnh + phóng to, tệp, trạng thái, tái diễn, cùng công đoạn", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mobile = isMobile(info.project.name);
  await login(page);
  await page.goto(`/incidents/${fx.main.id}`);
  await ready(page);
  const api = await (
    await page.request.get(`/api/v1/incidents/${fx.main.id}`)
  ).json();
  await expect(page.locator("#incident-title")).toHaveText(api.title);

  // Order from the numeric prefix, not jsonb key order.
  const titles = await page
    .locator("main section h2 [class*=sectionTitle]")
    .evaluateAll((els) =>
      els.map((e) => (e.firstChild?.textContent || "").trim()),
    );
  expect(titles).toEqual([
    "Hiện tượng",
    "Điều kiện xảy ra",
    "Nguyên nhân nghi ngờ",
    "Các bước kiểm tra",
    "Giải pháp xử lý",
    "Kết quả sau xử lý",
    "Lưu ý phòng ngừa",
    "Lưu ý an toàn",
  ]);
  // A suspected cause is labelled; nothing claims a field verification the API does not return.
  await expect(section(page, "Nguyên nhân nghi ngờ")).toContainText(
    "Giả thuyết · chưa xác minh",
  );
  await expect(page.getByText("Đã xác minh", { exact: true })).toHaveCount(0);
  const status = page.getByRole("region", {
    name: "Trạng thái duyệt & xác minh",
  });
  await expect(status).toContainText("Chưa liên kết hồ sơ");
  await expect(status).toContainText(api.approver_name);
  await expect(status).toContainText(day(api.approved_at));
  await expect(page.getByText("Hướng dẫn đã duyệt")).toBeVisible();

  if (mobile) {
    await expect(page.locator("main dl").first()).toBeHidden();
    const compact = page.getByTestId("meta-compact");
    await expect(compact).toContainText(api.department_name);
    await expect(compact).toContainText(`Duyệt ${day(api.approved_at)}`);
    // Accordions: symptom, cause, solution open; others closed and expandable (44px targets).
    for (const [name, open] of [
      ["Hiện tượng", true],
      ["Điều kiện xảy ra", false],
      ["Nguyên nhân nghi ngờ", true],
      ["Giải pháp xử lý", true],
      ["Kết quả sau xử lý", false],
    ] as const)
      await expect(
        page.getByRole("button", { name: new RegExp(`mục ${name}$`) }),
      ).toHaveAttribute("aria-expanded", String(open));
    const toggle = page.getByRole("button", {
      name: "Mở rộng mục Điều kiện xảy ra",
    });
    const box = await toggle.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expect(
      section(page, "Điều kiện xảy ra").getByText("Sau khi đổi lô", {
        exact: false,
      }),
    ).toBeHidden();
    await toggle.click();
    await expect(
      section(page, "Điều kiện xảy ra").getByText(
        "Xuất hiện sau khi đổi lô vật tư",
      ),
    ).toBeVisible();
  } else {
    const meta = page.locator("main dl").first();
    await expect(meta).toBeVisible();
    for (const v of [
      api.author_name,
      api.department_name,
      api.process_name,
      api.approver_name,
      day(api.approved_at),
    ])
      await expect(meta).toContainText(v);
    await expect(
      page.getByRole("button", { name: /^(Thu gọn|Mở rộng) mục/ }),
    ).toHaveCount(0);
  }
  await expect(page.getByText(api.code)).toBeVisible(); // DEMO-UI06-… is not a technical S1- code

  // Images: unplaced image under the title; step images inside their section; filename lines hidden.
  const strip = page.getByRole("group", { name: "Hình ảnh sự cố" });
  await expect(
    strip.getByRole("img", { name: "DEMO-anh-tong-quan.jpg" }),
  ).toBeVisible();
  await expect(
    section(page, "Hiện tượng").getByRole("img", {
      name: "DEMO-hien-tuong.jpg",
    }),
  ).toBeVisible();
  await expect(page.getByText("Ảnh: DEMO-hien-tuong.jpg")).toHaveCount(0);
  await strip
    .getByRole("button", { name: "Phóng to ảnh DEMO-anh-tong-quan.jpg" })
    .click();
  const viewer = page.getByRole("dialog", {
    name: "Ảnh DEMO-anh-tong-quan.jpg",
  });
  await expect(viewer).toBeVisible();
  expect(
    await viewer
      .getByRole("img")
      .evaluate((i: HTMLImageElement) => i.decode().then(() => i.naturalWidth)),
  ).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Đóng ảnh" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  const files = page.getByRole("region", { name: "Ảnh & tệp đính kèm (4)" });
  await expect(files.getByRole("listitem")).toHaveCount(4);
  const pdf = files.getByRole("link", { name: "Tải DEMO-phieu-su-co.pdf" });
  expect(
    (await page.request.get((await pdf.getAttribute("href"))!)).status(),
  ).toBe(200);

  const related = page.getByRole("region", { name: "Sự cố cùng công đoạn" });
  await expect(
    related.getByRole("link", { name: new RegExp(fx.related.title) }),
  ).toBeVisible();
  const allowed = new Set(
    (
      await (
        await page.request.get(
          `/api/v1/incidents?processId=${api.process_id}&pageSize=4`,
        )
      ).json()
    ).items.map((i: { id: string }) => `/incidents/${i.id}`),
  );
  for (const href of await related
    .getByRole("link")
    .evaluateAll((ls) => ls.map((l) => l.getAttribute("href"))))
    expect(allowed.has(href) && href !== `/incidents/${fx.main.id}`).toBe(true);

  const recurrence = page.getByRole("region", { name: "Tái diễn" });
  await expect(recurrence).toContainText("Chưa có dữ liệu tái diễn liên kết");
  const record = recurrence.getByRole("link", {
    name: "Ghi nhận tái diễn trong Hồ sơ sự cố",
  });
  expect((await record.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await noHorizontalOverflow(page);
  await record.click();
  await expect(page).toHaveURL(/\/incidents\/manage$/);
  expect(errors).toEqual([]);
});

test("UI-06: quay lại Kho tri thức giữ từ khóa, bộ lọc, trang, kiểu xem (reload, mở trực tiếp)", async ({
  page,
}) => {
  await login(page);
  const list = `/knowledge?q=${fx.token}&type=INCIDENT_GUIDE&sort=title&view=grid`;
  await page.goto(list);
  await expect(libraryCards(page).first()).toBeVisible();
  await page
    .getByRole("link", {
      name: new RegExp(`Lệch màu vùng nền đặc.*${fx.token}`),
    })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/incidents/${fx.main.id}$`));
  await ready(page);
  await backLink(page).click();
  await expect(page).toHaveURL(list);
  await expect(
    page.getByRole("searchbox", { name: "Từ khóa tìm tri thức" }),
  ).toHaveValue(fx.token);

  await page
    .getByRole("link", {
      name: new RegExp(`Lệch màu vùng nền đặc.*${fx.token}`),
    })
    .first()
    .click();
  await ready(page);
  await page.reload();
  await ready(page);
  await expect(backLink(page)).toHaveAttribute("href", list);
  await backLink(page).click();
  await expect(page).toHaveURL(list);

  const fresh = await page.context().newPage();
  await fresh.goto(`/incidents/${fx.main.id}`);
  await ready(fresh);
  await expect(backLink(fresh)).toHaveAttribute("href", "/knowledge");
  await fresh.close();
});

test("UI-06: chỉ hướng dẫn đã duyệt trong phạm vi; nháp, bộ phận khác, admin kỹ thuật và chưa đăng nhập bị chặn", async ({
  page,
}) => {
  await login(page);
  for (const g of [fx.draft, fx.technical]) {
    await page.goto(`/incidents/${g.id}`);
    await expect(notFound(page)).toBeVisible();
    await expect(page.getByText(g.title)).toHaveCount(0);
  }
  for (const user of ["other", "admin"]) {
    await logout(page);
    await login(page, user);
    await page.goto(`/incidents/${fx.main.id}`);
    await expect(notFound(page)).toBeVisible();
    await expect(page.getByText(fx.main.title)).toHaveCount(0);
    await expect(page.getByRole("img", { name: /DEMO-/ })).toHaveCount(0);
    expect(
      (
        await page.request.get(
          `/api/v1/content-versions/${fx.main.version_id}/attachments`,
        )
      ).status(),
    ).toBe(404);
  }
  // Positive control: the TECHNICAL guide is visible inside its own department.
  await page.goto(`/incidents/${fx.technical.id}`);
  await ready(page);
  await logout(page);
  await page.goto(`/incidents/${fx.main.id}`);
  await expect(page).toHaveURL(/\/login/);
});

test("UI-06: đang tải, lỗi + thử lại, 403, lỗi tệp không chặn nội dung, hướng dẫn không ảnh, không tồn tại", async ({
  page,
}, info) => {
  await login(page);
  const route = `**/api/v1/incidents/${fx.main.id}`;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(route, async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto(`/incidents/${fx.main.id}`);
  await expect(
    page.getByRole("status", { name: "Đang tải sự cố" }),
  ).toBeVisible();
  release();
  await ready(page);
  await page.unroute(route);

  await page.route(route, (r) =>
    r.fulfill({
      status: 500,
      json: { error: { code: "X", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto(`/incidents/${fx.main.id}`);
  await expect(
    page.getByRole("heading", { name: "Không thể tải sự cố" }),
  ).toBeVisible();
  await page.unroute(route);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await ready(page);

  await page.route(route, (r) =>
    r.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Không đủ quyền." } },
    }),
  );
  await page.goto(`/incidents/${fx.main.id}`);
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem sự cố này" }),
  ).toBeVisible();
  await page.unroute(route);

  await page.route("**/api/v1/content-versions/*/attachments", (r) =>
    r.fulfill({ status: 500, json: { error: { code: "X", message: "x" } } }),
  );
  await page.goto(`/incidents/${fx.main.id}`);
  await ready(page);
  await expect(section(page, "Hiện tượng")).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Không tải được ảnh và tệp đính kèm",
  );
  await page.unroute("**/api/v1/content-versions/*/attachments");

  await page.goto(`/incidents/${fx.plain.id}`);
  await ready(page);
  await expect(page.getByRole("group", { name: "Hình ảnh sự cố" })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Hướng dẫn không có ảnh hay tệp đính kèm."),
  ).toBeVisible();
  if (isMobile(info.project.name))
    await expect(page.locator("main dl").first()).toBeHidden();

  await page.goto("/incidents/00000000-0000-4000-8000-000000000000");
  await expect(notFound(page)).toBeVisible();
  await noHorizontalOverflow(page);
});
