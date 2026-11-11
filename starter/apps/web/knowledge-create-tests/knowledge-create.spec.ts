import { test, expect, request, type Page } from "@playwright/test";
import { session } from "../knowledge-tests/fixture";
import { demoPng } from "../document-detail-tests/fixture";

const password = process.env.UI_DEMO_PASSWORD || "";
test.skip(!password, "Cần UI_DEMO_PASSWORD (tài khoản DEMO).");

const isMobile = (project: string) => project.startsWith("mobile");
const token = (project: string) => `ui07${project}${Date.now()}`;
type Version = {
  id: string;
  version_id: string;
  revision: number;
  status: string;
  body: Record<string, string>;
  title: string;
  version_number: number;
};

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
  await expect(page.getByLabel(/^Tiêu đề/)).toBeVisible();
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
async function latest(page: Page, id: string): Promise<Version> {
  const all: Version[] = await (
    await page.request.get("/api/v1/workspace/contents")
  ).json();
  return all
    .filter((c) => c.id === id)
    .sort((a, b) => b.version_number - a.version_number)[0];
}
const field = (page: Page, label: string) =>
  page.getByLabel(new RegExp(`^${label}`)).first();
const action = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const tab = (page: Page, name: RegExp) => page.getByRole("tab", { name });

test.afterEach(async ({ page }) => logout(page));

test("UI-07: tạo nháp → sửa → đính kèm → xem trước → gửi duyệt → trưởng bộ phận duyệt → hiện trong Kho tri thức", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mobile = isMobile(info.project.name);
  const t = token(info.project.name);
  const title = `DEMO · Chia sẻ ${t}`;
  await login(page);
  await page.goto("/knowledge/new");
  await ready(page);
  await noHorizontalOverflow(page);

  // Fill out of order; stored keys carry the number so the order survives jsonb.
  await field(page, "Tiêu đề").fill(title);
  await field(page, "Công đoạn").selectOption({ label: "In flexo / Bao bì" });
  await field(page, "Lưu ý an toàn").fill(
    `- Dừng máy trước khi vệ sinh\n- DEMO ${t}`,
  );
  await field(page, "Mô tả vấn đề").fill(`Mô tả DEMO ${t}.`);
  await field(page, "Các bước kiểm tra").fill(
    "1. So sánh với mẫu\n2. Kiểm tra nhãn lô",
  );
  await expect(page.getByText("Có thay đổi chưa lưu")).toHaveCount(
    mobile ? 1 : 1,
  );
  await action(page, "Lưu nháp").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu bản nháp" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/knowledge\/new\?id=[0-9a-f-]{36}$/);
  const id = new URL(page.url()).searchParams.get("id")!;
  let v = await latest(page, id);
  expect(v.status).toBe("DRAFT");
  expect(Object.keys(v.body).sort()).toEqual([
    "1. Mô tả vấn đề / kinh nghiệm",
    "4. Các bước kiểm tra",
    "7. Lưu ý an toàn và phạm vi áp dụng",
  ]);

  // Reload restores every field; edit and save again (revision-checked PUT).
  await page.reload();
  await ready(page);
  await expect(field(page, "Tiêu đề")).toHaveValue(title);
  await expect(field(page, "Mô tả vấn đề")).toHaveValue(`Mô tả DEMO ${t}.`);
  await expect(field(page, "Lưu ý an toàn")).toHaveValue(
    `- Dừng máy trước khi vệ sinh\n- DEMO ${t}`,
  );
  await field(page, "Giải pháp").fill(
    `Báo trưởng ca.\nẢnh: DEMO-buoc-${t}.png`,
  );
  await action(page, "Lưu nháp").click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu bản nháp" }),
  ).toBeVisible();
  const before = v.revision;
  v = await latest(page, id);
  expect(v.revision).toBeGreaterThan(before);

  // Upload: valid PNG (server scan) + rejected types, with clear states.
  if (mobile) await tab(page, /^Đính kèm/).click();
  await page.getByLabel("Chọn tệp đính kèm").setInputFiles([
    {
      name: `DEMO-buoc-${t}.png`,
      mimeType: "image/png",
      buffer: demoPng(120, 80),
    },
    { name: "ghi-chu.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
  ]);
  const list = page.getByRole("list", { name: "Danh sách tệp" });
  await expect(
    list.getByRole("listitem").filter({ hasText: `DEMO-buoc-${t}.png` }),
  ).toContainText("đã quét an toàn");
  await expect(
    list.getByRole("listitem").filter({ hasText: "ghi-chu.txt" }),
  ).toContainText("Chỉ hỗ trợ ảnh PNG, JPEG");
  await page.getByLabel("Chọn tệp đính kèm").setInputFiles({
    name: "gia-mao.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a png"),
  });
  await expect(
    list.getByRole("listitem").filter({ hasText: "gia-mao.png" }),
  ).toContainText("Lỗi:");
  const files = await (
    await page.request.get(
      `/api/v1/content-versions/${v.version_id}/attachments`,
    )
  ).json();
  expect(files.map((f: { filename: string }) => f.filename)).toEqual([
    `DEMO-buoc-${t}.png`,
  ]);

  // Preview: numbered order and the referenced image inside its section.
  if (mobile) await tab(page, /^Xem trước/).click();
  else await action(page, "Xem trước").click();
  const preview = page.getByRole("article", { name: "Xem trước bài viết" });
  await expect(preview.locator("h3")).toHaveText([
    "1Mô tả vấn đề / kinh nghiệm",
    "2Các bước kiểm tra",
    "3Giải pháp / quy trình thao tác",
    "4Lưu ý an toàn và phạm vi áp dụng",
  ]);
  await expect(
    preview.getByRole("img", { name: `DEMO-buoc-${t}.png` }),
  ).toBeVisible();

  // Submit: server confirms PENDING; form locks; not in the library yet.
  await action(page, "Gửi duyệt").click();
  await expect(page.getByTestId("draft-status")).toContainText(
    "Đang chờ duyệt",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Đã gửi trưởng bộ phận duyệt" }),
  ).toBeVisible();
  await expect(action(page, "Gửi duyệt")).toBeDisabled();
  await expect(action(page, "Lưu nháp")).toBeDisabled();
  v = await latest(page, id);
  expect(v.status).toBe("PENDING");
  expect(
    (await (await page.request.get(`/api/v1/articles?q=${t}`)).json()).total,
  ).toBe(0);
  expect((await page.request.get(`/api/v1/articles/${id}`)).status()).toBe(404);
  // The author cannot approve their own article.
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const self = await page.request.post("/api/v1/workspace/contents/approve", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": me.csrf_token,
    },
    data: {
      content_id: id,
      version_id: v.version_id,
      revision: v.revision,
      remark: "",
    },
  });
  expect([403, 404]).toContain(self.status());

  // Department head approves through the real workflow; the article appears in the library.
  const head = await session(request, "head", password);
  try {
    await head.call("POST", "/workspace/contents/approve", {
      content_id: id,
      version_id: v.version_id,
      revision: v.revision,
      remark: "",
    });
  } finally {
    await head.close();
  }
  await page.goto(`/knowledge?q=${t}`);
  await expect(
    page.getByRole("list", { name: "Danh sách kết quả" }).getByRole("link"),
  ).toHaveCount(1);
  await page
    .getByRole("list", { name: "Danh sách kết quả" })
    .getByRole("link")
    .first()
    .click();
  await expect(page.locator("#article-title")).toHaveText(title);
  const headings = await page.locator("#panel-content h2").allTextContents();
  expect(headings.map((h) => h.replace(/^\d+/, ""))).toEqual([
    "Mô tả vấn đề / kinh nghiệm",
    "Các bước kiểm tra",
    "Giải pháp / quy trình thao tác",
    "Lưu ý an toàn và phạm vi áp dụng",
  ]);
  await expect(
    page
      .getByRole("region", { name: "Giải pháp / quy trình thao tác" })
      .getByRole("img", { name: `DEMO-buoc-${t}.png` }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("UI-07: lỗi nhập tại trường, chống bấm trùng, mất mạng, xung đột phiên bản, cảnh báo rời trang", async ({
  page,
}, info) => {
  const mobile = isMobile(info.project.name);
  const t = token(info.project.name);
  await login(page);
  await page.goto("/knowledge/new");
  await ready(page);
  let writes = 0;
  page.on("request", (r) => {
    if (
      r.url().endsWith("/api/v1/workspace/contents") &&
      ["POST", "PUT"].includes(r.method())
    )
      writes++;
  });

  // Empty submit: errors at fields, nothing sent.
  await action(page, "Gửi duyệt").click();
  await expect(field(page, "Tiêu đề")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Nhập tiêu đề bài chia sẻ.")).toBeVisible();
  await expect(
    page.getByText("Chọn công đoạn trước khi gửi duyệt."),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert").first()).toBeVisible();
  expect(writes).toBe(0);

  // Network failure: no success message, no draft created.
  await field(page, "Tiêu đề").fill(`DEMO · Kiểm thử lỗi ${t}`);
  await page.route("**/api/v1/workspace/contents", (r) =>
    r.abort("internetdisconnected"),
  );
  await action(page, "Lưu nháp").click();
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .filter({ hasText: "chưa được ghi nhận" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/knowledge\/new$/);
  await page.unroute("**/api/v1/workspace/contents");

  // Double click creates exactly one draft.
  writes = 0;
  await page.route("**/api/v1/workspace/contents", async (r) => {
    await new Promise((res) => setTimeout(res, 400));
    await r.continue();
  });
  await action(page, "Lưu nháp").dblclick();
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu bản nháp" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/workspace/contents");
  expect(writes).toBe(1);
  const id = new URL(page.url()).searchParams.get("id")!;
  expect(
    (
      await (await page.request.get("/api/v1/workspace/contents")).json()
    ).filter((c: { title: string }) => c.title.includes(t)),
  ).toHaveLength(1);

  // Stale revision (saved elsewhere) -> 409 message, not a success.
  const v = await latest(page, id);
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  await page.request.put("/api/v1/workspace/contents", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": me.csrf_token,
    },
    data: {
      content_id: id,
      version_id: v.version_id,
      revision: v.revision,
      title: `DEMO · Kiểm thử lỗi ${t}`,
      body: { "1. Mô tả vấn đề / kinh nghiệm": "sửa ở tab khác" },
      process_id: null,
    },
  });
  await field(page, "Mô tả vấn đề").fill("sửa ở tab này");
  await action(page, "Lưu nháp").click();
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .filter({ hasText: "Tải lại trang" }),
  ).toBeVisible();

  // Leaving with unsaved changes asks first; dismiss keeps the page.
  let asked = "";
  page.once("dialog", (d) => {
    asked = d.message();
    void d.dismiss();
  });
  await page
    .getByRole("link", { name: mobile ? "Trang chủ" : "Trang chủ" })
    .first()
    .click();
  expect(asked).toContain("chưa lưu");
  await expect(page).toHaveURL(/\/knowledge\/new/);
});

test("UI-07: quyền — chưa đăng nhập, tài khoản chưa có bộ phận, mở bản nháp của người khác", async ({
  page,
}, info) => {
  await page.goto("/knowledge/new");
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  // A draft that belongs to employee cannot be opened by the department head.
  const author = await session(request, "employee", password);
  let id = "";
  try {
    id = (
      await author.call("POST", "/workspace/contents", {
        kind: "ARTICLE",
        title: `DEMO · Nháp riêng ${token(info.project.name)}`,
        body: { "1. Mô tả vấn đề / kinh nghiệm": "x" },
        visibility: "DEPARTMENT",
      })
    ).id;
  } finally {
    await author.close();
  }
  await logout(page);
  await login(page, "head");
  await page.goto(`/knowledge/new?id=${id}`);
  await expect(
    page.getByRole("heading", { name: "Không mở được bài viết" }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Tiêu đề/)).toHaveCount(0);
  // Account without a department (mocked /auth/me) sees no form.
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({ json: { ...me, department_id: null } }),
  );
  await page.goto("/knowledge/new");
  await expect(
    page.getByRole("heading", { name: "Chưa tạo được bài chia sẻ" }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Tiêu đề/)).toHaveCount(0);
  await page.unroute("**/api/v1/auth/me");
});

test("UI-07: bố cục — mobile 3 bước + thanh thao tác cố định, vùng chạm ≥ 44px, không tràn ngang", async ({
  page,
}, info) => {
  const mobile = isMobile(info.project.name);
  await login(page);
  await page.goto("/knowledge/new");
  await ready(page);
  await noHorizontalOverflow(page);
  for (const name of ["Lưu nháp", "Gửi duyệt"]) {
    const box = (await action(page, name).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (mobile)
      expect(box.y + box.height).toBeLessThanOrEqual(
        page.viewportSize()!.height,
      );
  }
  if (mobile) {
    await expect(tab(page, /^Nội dung/)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: /Tệp đính kèm/ }),
    ).toBeHidden();
    await tab(page, /^Đính kèm/).click();
    await expect(
      page.getByRole("heading", { name: /Tệp đính kèm/ }),
    ).toBeVisible();
    await expect(page.getByLabel(/^Tiêu đề/)).toBeHidden();
    await expect(page.getByRole("button", { name: "chọn tệp" })).toBeVisible();
    expect(
      (await page.getByRole("button", { name: "chọn tệp" }).boundingBox())!
        .height,
    ).toBeGreaterThanOrEqual(44);
  } else {
    await expect(
      page.getByRole("tablist", { includeHidden: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: /Tệp đính kèm/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mẫu bài viết tốt" }),
    ).toBeVisible();
  }
  await noHorizontalOverflow(page);
});
