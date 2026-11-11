import { readFileSync } from "node:fs";
import { test, expect, request, type Page } from "@playwright/test";
import { submitForReview } from "./fixture";

const password = process.env.UI_DEMO_PASSWORD || "";
const uat = process.env.UI_UAT_FIXTURES
  ? JSON.parse(readFileSync(process.env.UI_UAT_FIXTURES, "utf8"))
  : null;
test.skip(!password, "Cần UI_DEMO_PASSWORD (tài khoản DEMO).");
const isMobile = (p: string) => p.startsWith("mobile");
const narrow = (p: string) => p !== "desktop"; // tablet + mobile use the bottom sheet
const token = (p: string) => `ui09${p}${Date.now()}`;

async function login(page: Page, username = "head") {
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
const queue = (page: Page) =>
  page.getByRole("list", { name: "Hàng đợi chờ duyệt" }).getByRole("listitem");
const detail = (page: Page) => page.getByTestId("approval-detail");
async function ready(page: Page) {
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
}
async function search(page: Page, text: string) {
  await page
    .getByRole("searchbox", { name: "Tìm trong hàng đợi duyệt" })
    .fill(text);
}
async function headers(page: Page) {
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  return { Origin: new URL(page.url()).origin, "X-CSRF-Token": me.csrf_token };
}

test.afterEach(async ({ page }) => logout(page));

test("UI-09: hàng đợi theo mockup 08 — người gửi, bộ phận, nội dung, tệp; phê duyệt bằng API workflow và bài được công bố", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t = token(info.project.name);
  const v = await submitForReview(request, password, "employee", [
    { title: `DEMO · Chờ duyệt ${t}`, file: true },
    { title: `DEMO · Thứ hai ${t}` },
  ]);
  await login(page);
  await page.goto("/approvals");
  await ready(page);
  await expect(page.getByRole("note")).toContainText(
    "Không tự duyệt nội dung do chính mình tạo",
  );
  const pending = (
    await (await page.request.get("/api/v1/workspace/contents")).json()
  ).filter(
    (i: { can_review: boolean; status: string }) =>
      i.can_review && i.status === "PENDING",
  ).length;
  await expect(
    page
      .getByRole("group", { name: "Thống kê phê duyệt" })
      .getByRole("button", { name: /^Chờ duyệt/ }),
  ).toContainText(String(pending));
  await search(page, t);
  await expect(queue(page)).toHaveCount(2);
  await expect(queue(page).first()).toContainText(`DEMO · Thứ hai ${t}`); // newest first
  await queue(page)
    .filter({ hasText: `DEMO · Chờ duyệt ${t}` })
    .getByRole("button")
    .click();
  const d = detail(page);
  await expect(d).toBeVisible();
  await expect(
    d.getByRole("heading", { name: `DEMO · Chờ duyệt ${t}` }),
  ).toBeVisible();
  for (const text of [
    "Nhân viên demo",
    "Sản xuất (DEMO)",
    "In flexo / Bao bì",
    "v1",
  ])
    await expect(d).toContainText(text);
  await expect(d.getByLabel("Nội dung cần duyệt")).toContainText(
    "Mô tả vấn đề / kinh nghiệm",
  );
  await d.getByRole("tab", { name: /Tệp đính kèm/ }).click();
  await expect(
    d.getByRole("link", { name: "Tải DEMO-phieu-duyet.pdf" }),
  ).toBeVisible();
  for (const name of ["Phê duyệt", "Yêu cầu chỉnh sửa", "Từ chối"])
    expect(
      (await d.getByRole("button", { name, exact: true }).boundingBox())!
        .height,
    ).toBeGreaterThanOrEqual(44);

  await d.getByRole("button", { name: "Phê duyệt", exact: true }).click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    `Đã phê duyệt “DEMO · Chờ duyệt ${t}” v1`,
  );
  await expect(queue(page)).toHaveCount(1);
  const id = v[`DEMO · Chờ duyệt ${t}`].id;
  const published = await page.request.get(`/api/v1/articles/${id}`);
  expect(published.status()).toBe(200);
  expect((await published.json()).approver_name).toBe("Trưởng bộ phận demo");
  await page.getByRole("button", { name: /^Đã duyệt/ }).click();
  await expect(
    page.getByRole("region", { name: "Đã duyệt gần đây" }),
  ).toContainText(`DEMO · Chờ duyệt ${t}`);
  expect(errors).toEqual([]);
});

test("UI-09: yêu cầu chỉnh sửa và từ chối cần lý do; tác giả nhận đúng trạng thái và ý kiến; xung đột phiên bản", async ({
  page,
}, info) => {
  const t = token(info.project.name);
  const v = await submitForReview(request, password, "employee", [
    { title: `DEMO · Cần sửa ${t}` },
    { title: `DEMO · Từ chối ${t}` },
    { title: `DEMO · Xung đột ${t}` },
  ]);
  await login(page);
  await page.goto("/approvals");
  await ready(page);
  await search(page, t);

  await queue(page)
    .filter({ hasText: `Cần sửa ${t}` })
    .getByRole("button")
    .click();
  let writes = 0;
  page.on("request", (r) => {
    if (
      /\/workspace\/contents\/(approve|request-changes|reject)$/.test(r.url())
    )
      writes++;
  });
  await detail(page)
    .getByRole("button", { name: "Yêu cầu chỉnh sửa", exact: true })
    .click();
  await expect(
    detail(page).getByText('Nhập lý do trước khi chọn "Yêu cầu chỉnh sửa".'),
  ).toBeVisible();
  expect(writes).toBe(0);
  await detail(page)
    .getByRole("textbox", { name: /Nhận xét của bạn/ })
    .fill(`DEMO · Bổ sung ảnh hiện tượng ${t}`);
  await detail(page)
    .getByRole("button", { name: "Yêu cầu chỉnh sửa", exact: true })
    .click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Đã gửi yêu cầu chỉnh sửa",
  );

  await queue(page)
    .filter({ hasText: `Từ chối ${t}` })
    .getByRole("button")
    .click();
  await detail(page)
    .getByRole("textbox", { name: /Nhận xét của bạn/ })
    .fill(`DEMO · Trùng nội dung ${t}`);
  page.once("dialog", (dlg) => void dlg.dismiss()); // cancel first: nothing sent
  await detail(page)
    .getByRole("button", { name: "Từ chối", exact: true })
    .click();
  await expect(queue(page).filter({ hasText: `Từ chối ${t}` })).toHaveCount(1);
  page.once("dialog", (dlg) => void dlg.accept());
  await detail(page)
    .getByRole("button", { name: "Từ chối", exact: true })
    .click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Đã từ chối",
  );

  // Someone else decided first -> 409 message, queue reloads, nothing claimed.
  await queue(page)
    .filter({ hasText: `Xung đột ${t}` })
    .getByRole("button")
    .click();
  const x = v[`DEMO · Xung đột ${t}`];
  expect(
    (
      await page.request.post("/api/v1/workspace/contents/approve", {
        headers: await headers(page),
        data: {
          content_id: x.id,
          version_id: x.version_id,
          revision: x.revision,
          remark: "",
        },
      })
    ).status(),
  ).toBe(200);
  await detail(page)
    .getByRole("button", { name: "Phê duyệt", exact: true })
    .click();
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .filter({ hasText: "đã được xử lý" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  await expect(queue(page)).toHaveCount(0);

  // Author sees the real outcome and the reviewer's remark.
  await logout(page);
  await login(page, "employee");
  const mine = await (
    await page.request.get("/api/v1/workspace/contents")
  ).json();
  const pick = (title: string) =>
    mine.filter((i: { title: string }) => i.title === title)[0];
  expect(pick(`DEMO · Cần sửa ${t}`).status).toBe("CHANGES_REQUESTED");
  expect(pick(`DEMO · Cần sửa ${t}`).remark).toBe(
    `DEMO · Bổ sung ảnh hiện tượng ${t}`,
  );
  expect(pick(`DEMO · Từ chối ${t}`).status).toBe("REJECTED");
});

test("UI-09: quyền — không tự duyệt, ngoài phạm vi, nhân viên không có quyền, HR duyệt tài liệu", async ({
  page,
}, info) => {
  const t = token(info.project.name);
  const own = await submitForReview(request, password, "head", [
    { title: `DEMO · Bài của trưởng bộ phận ${t}` },
  ]);
  await submitForReview(request, password, "employee", [
    { title: `DEMO · Ngoài phạm vi ${t}` },
  ]);
  await login(page);
  await page.goto("/approvals");
  await ready(page);
  await search(page, t);
  await expect(queue(page)).toHaveCount(1);
  await expect(queue(page)).not.toContainText("Bài của trưởng bộ phận");
  const o = own[`DEMO · Bài của trưởng bộ phận ${t}`];
  expect([403, 404]).toContain(
    (
      await page.request.post("/api/v1/workspace/contents/approve", {
        headers: await headers(page),
        data: {
          content_id: o.id,
          version_id: o.version_id,
          revision: o.revision,
          remark: "",
        },
      })
    ).status(),
  );
  await logout(page);

  // Head of another department: nothing from Sản xuất.
  await login(page, "other");
  await page.goto("/approvals");
  await ready(page);
  await search(page, t);
  await expect(queue(page)).toHaveCount(0);
  await logout(page);

  // Employee: no reviewer role.
  await login(page, "employee");
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "Bạn không có quyền phê duyệt" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Chỉ trưởng bộ phận",
  );
  await logout(page);

  test.skip(
    !uat?.hr?.username,
    "Cần UI_UAT_FIXTURES có tài khoản HR tổng hợp.",
  );
  const doc = await submitForReview(request, password, "employee", [
    { title: `DEMO · Tài liệu chờ HR ${t}`, kind: "DOCUMENT" },
  ]);
  await login(page, uat.hr.username);
  await page.goto("/approvals");
  await ready(page);
  await expect(page.getByRole("button", { name: /^Đã duyệt/ })).toHaveCount(0); // article history is head-only
  await page
    .getByRole("group", { name: "Lọc loại nội dung" })
    .getByRole("button", { name: /^Tài liệu/ })
    .click();
  await search(page, t);
  await expect(queue(page)).toHaveCount(1);
  await queue(page).getByRole("button").click();
  await expect(detail(page)).toContainText("Tài liệu");
  await detail(page)
    .getByRole("button", { name: "Phê duyệt", exact: true })
    .click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Đã phê duyệt",
  );
  expect(
    (
      await page.request.get(
        `/api/v1/documents/${doc[`DEMO · Tài liệu chờ HR ${t}`].id}`,
      )
    ).status(),
  ).toBe(200);
});

test("UI-09: đang tải, rỗng, lỗi + thử lại, hết phiên, mất mạng khi duyệt; bố cục và bottom sheet", async ({
  page,
}, info) => {
  const t = token(info.project.name);
  await submitForReview(request, password, "employee", [
    { title: `DEMO · Bố cục ${t}` },
  ]);
  await login(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/workspace/contents", async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto("/approvals");
  await expect(
    page.getByRole("status", { name: "Đang tải hàng đợi duyệt" }),
  ).toBeVisible();
  release();
  await ready(page);
  await page.unroute("**/api/v1/workspace/contents");

  await page.route("**/api/v1/workspace/contents", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "Không còn nội dung chờ duyệt" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/workspace/contents");

  await page.route("**/api/v1/workspace/contents", (r) =>
    r.fulfill({
      status: 500,
      json: { error: { code: "X", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto("/approvals");
  await expect(
    page.getByRole("heading", { name: "Không tải được hàng đợi duyệt" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/workspace/contents");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    page.getByRole("list", { name: "Hàng đợi chờ duyệt" }),
  ).toBeVisible();

  await search(page, t);
  await queue(page).getByRole("button").click();
  await expect(detail(page)).toBeVisible();
  if (narrow(info.project.name)) {
    // Bottom sheet: decision buttons pinned inside the viewport; Escape closes.
    const box = (await detail(page)
      .getByRole("button", { name: "Phê duyệt", exact: true })
      .boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.keyboard.press("Escape");
    await expect(detail(page)).toBeHidden();
    await queue(page).getByRole("button").click();
  }
  await page.route("**/api/v1/workspace/contents/approve", (r) =>
    r.abort("internetdisconnected"),
  );
  await detail(page)
    .getByRole("button", { name: "Phê duyệt", exact: true })
    .click();
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .filter({ hasText: "chưa được ghi nhận" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  await page.unroute("**/api/v1/workspace/contents/approve");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  if (isMobile(info.project.name)) await page.keyboard.press("Escape");
  for (const b of await page
    .getByRole("group", { name: "Lọc loại nội dung" })
    .getByRole("button")
    .all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(40);

  await page.route("**/api/v1/workspace/contents", (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: "AUTH_REQUIRED", message: "x" } },
    }),
  );
  await page.goto("/approvals");
  await expect(page).toHaveURL(/\/login\?reason=session-expired/);
  await page.unroute("**/api/v1/workspace/contents");
});
