import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const evidence = process.env.UI_EVIDENCE_DIR || "../../../docs/reports/sprint1";
test.use({ actionTimeout: 10000 });
async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill(name);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.UI_DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Chào anh/chị");
}
async function logout(page: Page) {
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Đăng xuất khỏi thiết bị này" })
    .click();
  await expect(page).toHaveURL(/\/login/);
}
async function screenshot(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
test("Login thiết kế 09: hero hiện trên mobile, nút đỏ và hiện mật khẩu", async ({
  page,
}, info) => {
  await page.goto("/login");
  const asset = await page.request.get("/images/login-hero.png");
  expect(asset.status()).toBe(200);
  expect((await asset.body()).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const hero = page.locator(".login-story");
  await expect(hero).toBeVisible();
  await expect(hero).toHaveCSS("background-image", /login-hero\.png/);
  expect(
    await hero.evaluate((e) => (e as HTMLElement).offsetHeight),
  ).toBeGreaterThan(150);
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toHaveCSS("background-color", "rgb(201, 35, 49)");
  await page.getByLabel("Hiện mật khẩu").check();
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByLabel("Hiện mật khẩu").uncheck();
  await screenshot(page, `login-${info.project.name}`);
  await page.getByRole("link", { name: /Quên mật khẩu/ }).click();
  await expect(
    page.getByRole("heading", { name: "Đặt lại mật khẩu" }),
  ).toBeVisible();
});
test("Sprint 1: HR ban hành/giao đọc, sửa tri thức, hồ sơ sự cố và biên soạn đào tạo", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  test.skip(!process.env.UI_UAT_FIXTURES, "Cần fixture DEMO riêng.");
  const fixtures = JSON.parse(
    readFileSync(process.env.UI_UAT_FIXTURES!, "utf8"),
  );
  test.skip(!fixtures.hr, "Cần fixture HR tổng hợp Sprint 1.");
  const learner = fixtures[info.project.name],
    hr = fixtures.hr;
  const suffix = `${info.project.name} ${Date.now()}`;
  const document = `DEMO · Nội quy UAT ${suffix}`;
  const article = `DEMO · Tri thức UAT ${suffix}`;
  const incident = `DEMO · Sự cố UAT ${suffix}`;
  const course = `DEMO · Đào tạo UAT ${suffix}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, learner.username);
  await page.goto("/workspace");
  const create = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Tạo tài liệu / bài viết" }),
  });
  await create.getByLabel("Loại nội dung").selectOption("DOCUMENT");
  await create.getByLabel("Tiêu đề", { exact: true }).fill(document);
  await create
    .getByLabel("Nội dung", { exact: true })
    .fill("Nội quy DEMO dùng kiểm thử, chưa phải quy định thực tế.");
  await create
    .getByRole("button", { name: "Tạo bản nháp", exact: true })
    .click();
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: document }) })
    .click();
  await page
    .getByRole("button", { name: "Gửi duyệt bản đã lưu", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" }),
  ).toBeVisible();
  await logout(page);
  await login(page, hr.username);
  await page.goto("/workspace");
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: document }) })
    .click();
  await page
    .getByRole("button", { name: "Phê duyệt và ban hành", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" }),
  ).toBeVisible();
  // Reading manager refreshes independently after a page reload.
  await page.reload();
  await page
    .getByLabel("Nội quy đã ban hành")
    .selectOption({ label: `${document} · v1` });
  await page.getByLabel("Nhân viên hoặc bộ phận").selectOption(learner.user_id);
  await page
    .getByRole("button", { name: "Giao đọc bắt buộc", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã giao đọc đúng phiên bản" }),
  ).toBeVisible();
  await screenshot(page, `reading-manager-${info.project.name}`);
  await logout(page);
  await login(page, learner.username);
  await page.goto("/documents");
  if (info.project.name === "mobile")
    await page
      .locator(".content-card:visible")
      .filter({ hasText: document })
      .click();
  else
    await page
      .locator("tr")
      .filter({ hasText: document })
      .getByRole("link", { name: "Xem tài liệu", exact: true })
      .click();
  await page.getByRole("button", { name: "Tôi đã đọc phiên bản này" }).click();
  await expect(
    page
      .locator(".feature-panel")
      .filter({ has: page.getByRole("heading", { name: "Xác nhận đã đọc" }) }),
  ).toContainText("Đã xác nhận");
  await page.goto("/workspace");
  const form = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Tạo tài liệu / bài viết" }),
  });
  await form.getByLabel("Loại nội dung").selectOption("ARTICLE");
  await form.getByLabel("Tiêu đề", { exact: true }).fill(article);
  await form.getByLabel("Nội dung", { exact: true }).fill("Bản đầu DEMO");
  await form.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: article }) })
    .click();
  await page.getByLabel("Nội dung phiên bản").fill("Bản sửa DEMO");
  await page
    .getByRole("combobox", { name: "Công đoạn", exact: true })
    .selectOption({ label: "In offset" });
  await page
    .getByRole("button", { name: "Lưu chỉnh sửa", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Gửi duyệt bản đã lưu", exact: true })
    .click();
  await screenshot(page, `authoring-${info.project.name}`);
  await logout(page);
  await login(page, "head");
  await page.goto("/workspace");
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: article }) })
    .click();
  await page.getByLabel("Lý do / phản hồi").fill("Bổ sung bằng chứng DEMO");
  await page
    .getByRole("button", { name: "Yêu cầu chỉnh sửa", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu thay đổi" }),
  ).toBeVisible();
  await logout(page);
  await login(page, learner.username);
  await page.goto("/workspace");
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: article }) })
    .click();
  await page
    .getByRole("button", {
      name: "Tạo phiên bản mới để chỉnh sửa",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: `${article} · v2`, exact: true }),
  ).toBeVisible();
  await page.goto("/incidents/manage");
  await page.getByLabel("Tiêu đề sự cố").fill(incident);
  await page
    .getByRole("combobox", { name: "Công đoạn", exact: true })
    .selectOption({ label: "In offset" });
  await page
    .getByLabel("Hiện tượng", { exact: true })
    .fill("Hiện tượng giả lập, không áp dụng vận hành");
  await page.getByLabel("Điều kiện phát sinh").fill("Điều kiện DEMO");
  await page
    .getByRole("button", { name: "Lưu hồ sơ sự cố", exact: true })
    .click();
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: incident }) })
    .click();
  await page
    .getByLabel("Nguyên nhân giả thuyết", { exact: true })
    .fill("Giả thuyết DEMO");
  await page
    .getByLabel("Các bước đề xuất (mỗi dòng một bước)")
    .fill("Ghi nhận bằng chứng\nGửi người phụ trách");
  await page.getByLabel("Kết quả thực hiện").fill("Kết quả thử DEMO");
  await page
    .getByRole("button", { name: "Lưu phương án đề xuất", exact: true })
    .click();
  await page.getByLabel("Ghi nhận tái diễn").fill("Tình huống mẫu tái diễn");
  await page
    .getByRole("button", { name: "Ghi nhận tái diễn", exact: true })
    .click();
  await expect(
    page.getByText("Tình huống mẫu tái diễn", { exact: true }),
  ).toBeVisible();
  await screenshot(page, `incident-manager-${info.project.name}`);
  let releaseAuth!: () => void;
  const authGate = new Promise<void>((resolve) => {
    releaseAuth = resolve;
  });
  await page.route(
    "**/api/v1/auth/me",
    async (route) => {
      await authGate;
      await route.continue();
    },
    { times: 1 },
  );
  await page.goto("/learning/manage");
  await expect(
    page.getByRole("button", { name: "Tạo khóa nháp", exact: true }),
  ).toBeDisabled();
  releaseAuth();
  await expect(
    page.getByRole("button", { name: "Tạo khóa nháp", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Tên khóa học", { exact: true }).fill(course);
  await page
    .getByRole("button", { name: "Tạo khóa nháp", exact: true })
    .click();
  await page.getByLabel("Tên bài học 1", { exact: true }).fill("Bài học UAT");
  await page
    .getByRole("textbox", { name: "Nội dung bài 1", exact: true })
    .fill("Kiểm chứng trước vận hành");
  await page
    .getByLabel("Câu hỏi 1", { exact: true })
    .fill("Có áp dụng DEMO ngay không?");
  await page
    .getByLabel("Đáp án 1.1", { exact: true })
    .fill("Không, cần xác nhận");
  await page.getByLabel("Đáp án 1.2", { exact: true }).fill("Dùng ngay");
  await page.getByRole("button", { name: "Lưu khóa học", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu dữ liệu");
  // Reopen a saved draft: database lesson IDs must not be sent as input fields.
  await page.reload();
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: course }) })
    .click();
  await page
    .getByRole("textbox", { name: "Nội dung bài 1", exact: true })
    .fill("Kiểm chứng DEMO sau khi tải lại");
  await page.getByRole("button", { name: "Lưu khóa học", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu dữ liệu");
  await page
    .getByRole("button", { name: "Gửi duyệt khóa đã lưu", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Đã lưu dữ liệu");
  await logout(page);
  await login(page, "head");
  await page.goto("/learning/manage");
  await page
    .getByRole("button")
    .filter({ has: page.locator("strong", { hasText: course }) })
    .click();
  await page
    .getByRole("button", { name: "Phê duyệt khóa học", exact: true })
    .click();
  await page.getByLabel("Người học hoặc bộ phận").selectOption(learner.user_id);
  await page
    .getByRole("button", { name: "Giao khóa đã ban hành", exact: true })
    .click();
  await expect(
    page.locator("section").filter({
      has: page.getByRole("heading", {
        name: "Tiến độ đào tạo trong phạm vi",
      }),
    }),
  ).toContainText(course);
  await expect(
    page.getByRole("heading", { name: "Tiến độ đào tạo trong phạm vi" }),
  ).toBeVisible();
  await screenshot(page, `training-manager-${info.project.name}`);
  await logout(page);
  await login(page, learner.username);
  await page.goto("/learning");
  await page
    .locator("article")
    .filter({ hasText: course })
    .getByRole("link", { name: "Mở khóa học" })
    .click();
  await page
    .getByRole("button", { name: "Tôi đã hoàn thành bài học này" })
    .click();
  await page
    .getByRole("button", { name: "Bắt đầu kiểm tra", exact: true })
    .click();
  await page.getByLabel("Không, cần xác nhận", { exact: true }).check();
  await page
    .getByRole("button", { name: "Nộp bài kiểm tra", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("100");
  await page.reload();
  await expect(page.locator(".history-table")).toContainText("100");
  expect(errors).toEqual([]);
});
