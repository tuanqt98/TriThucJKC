import { readFileSync } from "node:fs";
import { test, expect, request, type Page } from "@playwright/test";
import { createDocumentFixture, type FixtureOptions } from "./fixture";

type Task = {
  id: string;
  content_id: string;
  version_id: string;
  version_number: number;
  acknowledged_at: string | null;
  is_current: boolean;
};
const password = process.env.UI_DEMO_PASSWORD || "";
const uat = process.env.UI_UAT_FIXTURES
  ? JSON.parse(readFileSync(process.env.UI_UAT_FIXTURES, "utf8"))
  : null;

test.skip(
  !password || !uat?.hr,
  "Cần UI_DEMO_PASSWORD và UI_UAT_FIXTURES (HR + học viên DEMO).",
);

/** Reader/other user per viewport so runs on different projects do not share state. */
function people(project: string) {
  const mobile = project.startsWith("mobile");
  return {
    author: uat.api.username as string,
    approver: uat.hr.username as string,
    reader: (mobile ? uat.mobile : uat.desktop).username as string,
    other: (mobile ? uat.desktop : uat.mobile).username as string,
  };
}
function fixture(project: string, extra: Partial<FixtureOptions> = {}) {
  const p = people(project);
  return createDocumentFixture({
    request,
    password,
    author: p.author,
    approver: p.approver,
    reader: p.reader,
    ackV1: false,
    v2: false,
    title: `DEMO · Nội quy UI-04 ${project} ${Date.now()}`,
    ...extra,
  });
}
async function login(page: Page, username: string) {
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
async function open(page: Page, id: string) {
  await page.goto(`/documents/${id}`);
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
  await expect(page.locator("#doc-title")).toBeVisible();
}
const ackButton = (page: Page) =>
  page.getByRole("button", { name: "Xác nhận đã đọc" }).locator("visible=true");
const status = (page: Page) => page.getByTestId("reading-status");
async function myTasks(page: Page, contentId: string): Promise<Task[]> {
  const all: Task[] = await (
    await page.request.get("/api/v1/my/reading")
  ).json();
  return all.filter((t) => t.content_id === contentId);
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
const isMobile = (project: string) => project.startsWith("mobile");

test.afterEach(async ({ page }) => logout(page));

test("UI-04: hiển thị tài liệu, tệp đính kèm và xác nhận đọc phiên bản được giao", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const doc = await fixture(info.project.name);
  await login(page, people(info.project.name).reader);
  await open(page, doc.contentId);
  const detail = await (
    await page.request.get(`/api/v1/documents/${doc.contentId}`)
  ).json();
  await expect(page.locator("#doc-title")).toHaveText(detail.title);
  await expect(
    page.getByRole("navigation", { name: "Đường dẫn" }),
  ).toContainText(detail.code);
  await expect(status(page)).toHaveText("Chưa xác nhận");
  await expect(page.getByText("Bắt buộc", { exact: true })).toBeVisible();
  // Mục theo số thứ tự, không theo thứ tự khóa jsonb.
  await expect(page.locator("#panel-content h2")).toHaveText([
    /Mục đích/,
    /Phạm vi áp dụng/,
    /Quy định bắt buộc/,
    /Lưu ý an toàn/,
  ]);
  await noHorizontalOverflow(page);

  // Tệp đính kèm: đúng danh sách API, tải được file sạch theo quyền.
  if (isMobile(info.project.name))
    await page.getByRole("tab", { name: "Tệp đính kèm (2)" }).click();
  const files = page.locator("#panel-files");
  await expect(files.getByRole("link", { name: /^Tải / })).toHaveCount(2);
  const href = await files
    .getByRole("link", { name: /\.pdf$/ })
    .getAttribute("href");
  const download = await page.request.get(href!);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("application/pdf");
  if (isMobile(info.project.name)) {
    await expect(page.locator("#panel-content")).toBeHidden();
    await page.getByRole("tab", { name: "Lịch sử (1)" }).click();
    await expect(page.locator("#panel-history")).toContainText("v1");
    await page.getByRole("tab", { name: "Nội dung" }).click();
  }

  await ackButton(page).click();
  await expect(page.getByTestId("ack-receipt")).toContainText(
    "Đã xác nhận phiên bản v1",
  );
  await expect(status(page)).toHaveText("Đã xác nhận");
  await expect(ackButton(page)).toHaveCount(0);
  const [task] = await myTasks(page, doc.contentId);
  expect(task.acknowledged_at).not.toBeNull();
  expect(task.version_id).toBe(doc.versions[0]);
  // Gửi lại idempotent, không ghi đè thời điểm xác nhận đầu tiên.
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const again = await page.request.post(
    `/api/v1/reading-assignments/${task.id}/acknowledge`,
    {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-CSRF-Token": me.csrf_token,
      },
      data: { version_id: doc.versions[0] },
    },
  );
  expect(again.status()).toBe(200);
  expect((await myTasks(page, doc.contentId))[0].acknowledged_at).toBe(
    task.acknowledged_at,
  );
  await page.reload();
  await expect(page.getByTestId("ack-receipt")).toContainText("v1");
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("UI-04: phiên bản mới phải xác nhận riêng, lịch sử ACK cũ giữ nguyên, ACK bản cũ bị 409", async ({
  page,
}, info) => {
  const doc = await fixture(info.project.name, { ackV1: true, v2: true });
  await login(page, people(info.project.name).reader);
  const before = await myTasks(page, doc.contentId);
  const v1 = before.find((t) => t.version_id === doc.versions[0])!;
  expect(v1.acknowledged_at).not.toBeNull();
  await open(page, doc.contentId);
  await expect(
    page
      .getByRole("note")
      .locator("visible=true")
      .filter({ hasText: "Đã có phiên bản mới (v2)" }),
  ).toBeVisible();
  await expect(status(page)).toHaveText("Chưa xác nhận");
  if (isMobile(info.project.name))
    await page.getByRole("tab", { name: "Lịch sử (2)" }).click();
  const history = page.locator("#panel-history");
  await expect(history.locator("li")).toHaveCount(2);
  await expect(history.locator("li").nth(1)).toContainText("v1");
  await expect(history.locator("li").nth(1)).toContainText(
    "Bạn đã xác nhận lúc",
  );
  if (isMobile(info.project.name))
    await page.getByRole("tab", { name: "Nội dung" }).click();

  // ACK phiên bản cũ sau khi đã có bản mới: API từ chối, không đổi lịch sử.
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const headers = {
    Origin: new URL(page.url()).origin,
    "X-CSRF-Token": me.csrf_token,
  };
  const v2task = before.find((t) => t.version_id === doc.versions[1])!;
  const stale = await page.request.post(
    `/api/v1/reading-assignments/${v2task.id}/acknowledge`,
    {
      headers,
      data: { version_id: doc.versions[0] },
    },
  );
  expect(stale.status()).toBe(409);

  await ackButton(page).click();
  await expect(page.getByTestId("ack-receipt")).toContainText(
    "Đã xác nhận phiên bản v2",
  );
  await expect(
    page
      .getByRole("note")
      .locator("visible=true")
      .filter({ hasText: "phiên bản mới" }),
  ).toHaveCount(0);
  const after = await myTasks(page, doc.contentId);
  expect(
    after.find((t) => t.version_id === doc.versions[0])!.acknowledged_at,
  ).toBe(v1.acknowledged_at);
  expect(
    after.find((t) => t.version_id === doc.versions[1])!.acknowledged_at,
  ).not.toBeNull();
  await noHorizontalOverflow(page);
});

test("UI-04: không xác nhận hộ người khác, ACL tài liệu và tệp, session hết hạn", async ({
  page,
}, info) => {
  const doc = await fixture(info.project.name);
  const p = people(info.project.name);
  await login(page, p.reader);
  const [task] = await myTasks(page, doc.contentId);
  const files = await (
    await page.request.get(
      `/api/v1/content-versions/${doc.versions[0]}/attachments`,
    )
  ).json();
  await logout(page);

  // Cùng bộ phận nhưng không được giao: xem được, không có nút, API không nhận ACK hộ.
  await login(page, p.other);
  await open(page, doc.contentId);
  await expect(status(page)).toHaveText("Không được giao đọc");
  await expect(ackButton(page)).toHaveCount(0);
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const forged = await page.request.post(
    `/api/v1/reading-assignments/${task.id}/acknowledge`,
    {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-CSRF-Token": me.csrf_token,
      },
      data: { version_id: doc.versions[0] },
    },
  );
  expect(forged.status()).toBe(404);
  await logout(page);
  await login(page, p.reader);
  expect((await myTasks(page, doc.contentId))[0].acknowledged_at).toBeNull();
  await logout(page);

  // Khác bộ phận và TECH_ADMIN: không thấy tài liệu, không tải được tệp.
  for (const user of ["other", "admin"]) {
    await login(page, user);
    await page.goto(`/documents/${doc.contentId}`);
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy tài liệu" }),
    ).toBeVisible();
    await expect(page.locator("#doc-title")).toHaveCount(0);
    expect(
      (
        await page.request.get(`/api/v1/attachments/${files[0].id}/download`)
      ).status(),
    ).toBe(404);
    await logout(page);
  }

  // Session hết hạn khi bấm xác nhận: chuyển về đăng nhập, không ghi nhận.
  await login(page, p.reader);
  await open(page, doc.contentId);
  await page.route("**/api/v1/reading-assignments/*/acknowledge", (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: { code: "UNAUTHENTICATED", message: "Phiên đã hết hạn." },
      },
    }),
  );
  await ackButton(page).click();
  await expect(page).toHaveURL(/\/login/);
  await page.unroute("**/api/v1/reading-assignments/*/acknowledge");
  await login(page, p.reader);
  expect((await myTasks(page, doc.contentId))[0].acknowledged_at).toBeNull();
  await page.context().clearCookies();
  await page.goto(`/documents/${doc.contentId}`);
  await expect(page).toHaveURL(/\/login/);
});

test("UI-04: xung đột phiên bản, loading, error, permission-denied và lỗi trạng thái đọc", async ({
  page,
}, info) => {
  const doc = await fixture(info.project.name);
  await login(page, people(info.project.name).reader);

  // 409 từ API: báo xung đột, tải lại, chưa ghi nhận.
  await open(page, doc.contentId);
  await page.route("**/api/v1/reading-assignments/*/acknowledge", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: { code: "VERSION_CONFLICT", message: "Phiên bản đã thay đổi." },
      },
    }),
  );
  await ackButton(page).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Phiên bản đã thay đổi hoặc chưa có hiệu lực",
  );
  await expect(status(page)).toHaveText("Chưa xác nhận");
  await page.unroute("**/api/v1/reading-assignments/*/acknowledge");
  expect((await myTasks(page, doc.contentId))[0].acknowledged_at).toBeNull();

  // Loading
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(`**/api/v1/documents/${doc.contentId}`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/documents/${doc.contentId}`);
  await expect(
    page.getByRole("status", { name: "Đang tải tài liệu" }),
  ).toBeVisible();
  release();
  await expect(page.locator("#doc-title")).toBeVisible();
  await page.unroute(`**/api/v1/documents/${doc.contentId}`);

  // Error + thử lại
  await page.route(`**/api/v1/documents/${doc.contentId}`, (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "X", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto(`/documents/${doc.contentId}`);
  await expect(
    page.getByRole("heading", { name: "Không thể tải tài liệu" }),
  ).toBeVisible();
  await page.unroute(`**/api/v1/documents/${doc.contentId}`);
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.locator("#doc-title")).toBeVisible();

  // Permission-denied
  await page.route(`**/api/v1/documents/${doc.contentId}`, (route) =>
    route.fulfill({
      status: 403,
      json: { error: { code: "FORBIDDEN", message: "Không đủ quyền." } },
    }),
  );
  await page.goto(`/documents/${doc.contentId}`);
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền xem tài liệu này" }),
  ).toBeVisible();
  await page.unroute(`**/api/v1/documents/${doc.contentId}`);

  // Không tồn tại (thật)
  await page.goto("/documents/00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy tài liệu" }),
  ).toBeVisible();

  // Không tải được trạng thái đọc: vẫn đọc được, không cho xác nhận.
  await page.route("**/api/v1/my/reading", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "X", message: "x" } },
    }),
  );
  await open(page, doc.contentId);
  await expect(status(page)).toHaveText("Chưa tải trạng thái");
  await expect(ackButton(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tải lại trạng thái" }),
  ).toBeVisible();
  await noHorizontalOverflow(page);
});
