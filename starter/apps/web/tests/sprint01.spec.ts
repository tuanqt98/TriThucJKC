import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Sprint 0.1 UAT: đọc đúng phiên bản, file an toàn, học và quiz", async ({
  page,
}, info) => {
  test.skip(
    !process.env.UI_UAT_FIXTURES,
    "Chỉ chạy với tài khoản tổng hợp riêng ở staging.",
  );
  const fixtures = JSON.parse(
    readFileSync(process.env.UI_UAT_FIXTURES!, "utf8"),
  );
  const fixture = fixtures[info.project.name];
  const password = process.env.UI_DEMO_PASSWORD;
  if (!password) throw new Error("Thiếu mật khẩu DEMO qua môi trường.");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page
    .getByLabel("Tên đăng nhập", { exact: true })
    .fill(fixture.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Chào anh/chị");
  await page.goto("/documents");
  await page
    .locator(".content-card:visible, .table-action:visible")
    .first()
    .click();
  await page.getByRole("button", { name: "Tôi đã đọc phiên bản này" }).click();
  await expect(
    page
      .locator(".feature-panel")
      .filter({ has: page.getByRole("heading", { name: "Xác nhận đã đọc" }) }),
  ).toContainText("Đã xác nhận");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../../../docs/reports/sprint01/reading-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/knowledge/new");
  await page
    .getByLabel("Tiêu đề")
    .fill("DEMO · UAT file " + info.project.name + " " + Date.now());
  await page
    .getByLabel("Mô tả vấn đề")
    .fill("Nội dung giả lập để kiểm thử file riêng tư và quét mã độc.");
  await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu bản nháp");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGNk+P+fAQaY4Cy8HABjoQIGrQ8XLQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Chọn ảnh hoặc PDF minh họa").setInputFiles({
    name: "uat-demo.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Tải lên và quét mã độc" }).click();
  await expect(page.locator(".attachment-list")).toContainText(
    "Đã quét an toàn",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tải xuống", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("uat-demo.png");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../../../docs/reports/sprint01/upload-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Gửi trưởng bộ phận duyệt" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã gửi phê duyệt" }),
  ).toBeVisible();
  await page.goto("/learning/" + fixture.assignment);
  await expect(
    page.getByRole("heading", { name: "DEMO · Học và kiểm tra Sprint 0.1" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tôi đã hoàn thành bài học này" })
    .click();
  await expect(
    page.getByRole("button", { name: "Đã hoàn thành bài học", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Bắt đầu kiểm tra", exact: true })
    .click();
  await page
    .getByLabel("Đúng phiên bản nội quy được giao", { exact: true })
    .check();
  await page
    .getByLabel("Gửi người phụ trách xác minh trước khi áp dụng", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Nộp bài kiểm tra", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("100");
  await expect(page.locator(".history-table")).toContainText("100");
  await expect(page.locator(".course-player")).toContainText(
    "Đã hoàn thành khóa học này",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `../../../docs/reports/sprint01/quiz-${info.project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".history-table")).toContainText("100");
  expect(errors).toEqual([]);
});
