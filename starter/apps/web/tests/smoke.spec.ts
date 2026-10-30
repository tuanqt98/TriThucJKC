import { test, expect } from "@playwright/test";
const password = process.env.UI_DEMO_PASSWORD;
test.beforeEach(async ({ page }) => {
  if (!password) throw new Error("Đặt UI_DEMO_PASSWORD khớp demo seed.");
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("employee");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chào anh/chị, hôm nay bạn cần gì?" }),
  ).toBeVisible();
});
test("8 màn hình, dữ liệu thật và responsive", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "/",
    "/documents",
    "/knowledge",
    "/incidents",
    "/knowledge/new",
    "/learning",
  ]) {
    await page.goto(route);
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('.error[role="alert"]')).toHaveCount(0);
    await page.screenshot({
      path: `../../../docs/reports/ui-${route === "/" ? "dashboard" : route.slice(1).replaceAll("/", "-")}-${testInfo.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/documents");
  await page
    .locator(".content-card:visible, .table-action:visible")
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "DEMO · Tài liệu giới thiệu cổng tri thức",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/incidents");
  await page
    .locator(".content-card:visible, .table-action:visible")
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "DEMO · Hồ sơ sự cố để thực hành tra cứu",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/approvals");
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "Chỉ trưởng bộ phận",
  );
  await page.goto("/");
  await expect(page.locator(".stat").first()).toContainText("1");
  await page.screenshot({
    path: `../../../docs/reports/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("tìm kiếm, trạng thái rỗng, lưu nháp và gửi duyệt", async ({ page }) => {
  await page
    .getByRole("textbox", { name: "Tìm trong kho tri thức" })
    .fill("khôngcókếtquảnày");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy kết quả phù hợp." }),
  ).toBeVisible();
  await page.goto("/knowledge/new");
  await page.getByLabel("Tiêu đề").fill("DEMO · Bài học kiểm thử giao diện");
  await page
    .getByLabel("Mô tả vấn đề")
    .fill("Dữ liệu minh họa cho kiểm thử, không dùng trong vận hành.");
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu bản nháp");
  await page.getByRole("button", { name: "Gửi trưởng bộ phận duyệt" }).click();
  await expect(page.getByRole("status")).toContainText("Đã gửi phê duyệt");
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Đăng xuất khỏi thiết bị này" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại" }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
test("trưởng bộ phận xem trước và duyệt", async ({ page }, testInfo) => {
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Đăng xuất khỏi thiết bị này" })
    .click();
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("head");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Chào anh/chị");
  await page.goto("/approvals");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  const pending = page
    .locator(".approval-row")
    .filter({ hasText: "Chờ duyệt" })
    .first();
  await pending.click();
  await expect(page.locator(".approval-preview")).toContainText(
    "Dữ liệu minh họa",
  );
  await page.screenshot({
    path: `../../../docs/reports/ui-approvals-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Phê duyệt phiên bản này" }).click();
  await expect(page.getByRole("status")).toContainText("Đã phê duyệt");
});
