import { test, expect, request, type Page } from "@playwright/test";
import { session } from "../knowledge-tests/fixture";

const password = process.env.UI_DEMO_PASSWORD || "";
test.skip(!password, "Cần UI_DEMO_PASSWORD (tài khoản DEMO).");

const isMobile = (project: string) => project.startsWith("mobile");
type R = { id: string; version_id: string; revision: number };

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
const list = (page: Page) =>
  page.getByRole("list", { name: "Danh sách bài viết của tôi" });
const card = (page: Page, title: string) =>
  list(page).getByRole("listitem").filter({ hasText: title });

/** Six articles of "employee" in every workflow state, through the real authoring API. */
async function seedStates(t: string) {
  const author = await session(request, "employee", password);
  const head = await session(request, "head", password);
  const ids: Record<string, string> = {};
  try {
    const processes: { id: string; code: string }[] = await (
      await author.ctx.get("/api/v1/processes")
    ).json();
    const flexo = processes.find((p) => p.code === "FLEXO")!.id;
    const make = (name: string) =>
      author.call("POST", "/workspace/contents", {
        kind: "ARTICLE",
        title: `DEMO · ${name} ${t}`,
        body: { "1. Mô tả vấn đề / kinh nghiệm": `DEMO ${t}` },
        visibility: "DEPARTMENT",
        process_id: flexo,
      });
    const ver = (r: R) => ({
      content_id: r.id,
      version_id: r.version_id,
      revision: r.revision,
    });
    const submit = (r: R) =>
      author.call("POST", "/workspace/contents/submit", {
        ...ver(r),
        remark: "",
      });
    const decide = (action: string, r: R, remark = "") =>
      head.call("POST", `/workspace/contents/${action}`, { ...ver(r), remark });

    ids.draft = (await make("Nháp")).id;
    ids.pending = (await submit(await make("Chờ duyệt"))).id;
    ids.changes = (
      await decide(
        "request-changes",
        await submit(await make("Cần sửa")),
        `Bổ sung ảnh ${t}`,
      )
    ).id;
    ids.rejected = (
      await decide(
        "reject",
        await submit(await make("Từ chối")),
        `Trùng nội dung ${t}`,
      )
    ).id;
    ids.approved = (
      await decide("approve", await submit(await make("Đã duyệt")))
    ).id;
    const live = await decide(
      "approve",
      await submit(await make("Đang sửa bản mới")),
    );
    await author.call("POST", "/workspace/contents/fork", {
      ...ver(live),
      remark: "",
    });
    ids.forked = live.id;
  } finally {
    await Promise.all([author.close(), head.close()]);
  }
  return ids;
}

test.afterEach(async ({ page }) => logout(page));

test("DATA-33: Bài viết của tôi — đủ 5 trạng thái, đếm, lọc trên URL, hành động hợp lệ theo trạng thái", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t = `ui07m${info.project.name}${Date.now()}`;
  const ids = await seedStates(t);
  await login(page);

  // Entry point from the create form.
  await page.goto("/knowledge/new");
  await page.getByRole("link", { name: "Bài viết của tôi" }).click();
  await expect(page).toHaveURL(/\/knowledge\/mine$/);
  await expect(
    page.getByRole("heading", { name: "Bài viết của tôi", level: 1 }),
  ).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Tìm bài viết của tôi theo tiêu đề" })
    .fill(t);
  await expect(page).toHaveURL(new RegExp(`q=${t}`));
  await expect(list(page).getByRole("listitem")).toHaveCount(6);

  const expectCard = async (
    title: string,
    status: string,
    actions: [string, string][],
  ) => {
    const c = card(page, `${title} ${t}`);
    await expect(c).toContainText(status);
    const links = c.getByRole("link");
    await expect(links).toHaveCount(actions.length);
    for (const [i, [label, href]] of actions.entries()) {
      await expect(links.nth(i)).toHaveText(label);
      await expect(links.nth(i)).toHaveAttribute("href", href);
    }
  };
  const form = (k: string) => `/knowledge/new?id=${ids[k]}`;
  const live = (k: string) => `/knowledge/${ids[k]}`;
  await expectCard("Nháp", "Bản nháp", [["Tiếp tục soạn", form("draft")]]);
  await expectCard("Chờ duyệt", "Chờ duyệt", [
    ["Xem bài đang chờ duyệt", form("pending")],
  ]);
  await expectCard("Cần sửa", "Cần chỉnh sửa", [
    ["Xem ý kiến và tạo bản sửa", form("changes")],
  ]);
  await expect(card(page, `Cần sửa ${t}`)).toContainText(
    `Ý kiến người duyệt: Bổ sung ảnh ${t}`,
  );
  await expectCard("Từ chối", "Bị từ chối", [
    ["Xem ý kiến và tạo bản sửa", form("rejected")],
  ]);
  await expect(card(page, `Từ chối ${t}`)).toContainText(`Trùng nội dung ${t}`);
  await expectCard("Đã duyệt", "Đã duyệt", [
    ["Xem trong Kho tri thức", live("approved")],
    ["Tạo bản sửa mới", form("approved")],
  ]);
  await expectCard("Đang sửa bản mới", "Bản nháp", [
    ["Tiếp tục soạn", form("forked")],
    ["Xem bản v1 đang hiển thị", live("forked")],
  ]);
  await expect(card(page, `Đang sửa bản mới ${t}`)).toContainText(
    "Phiên bản v2",
  );

  // Status chip filters; state survives reload through the URL.
  await page
    .getByRole("group", { name: "Lọc theo trạng thái" })
    .getByRole("button", { name: /^Cần chỉnh sửa/ })
    .click();
  await expect(page).toHaveURL(/status=CHANGES_REQUESTED/);
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
  await page.reload();
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^Cần chỉnh sửa/ }),
  ).toHaveAttribute("aria-pressed", "true");

  // Open the draft: the UI-07 form loads it for editing.
  await page.goto(`/knowledge/mine?q=${t}&status=DRAFT`);
  await card(page, `Nháp ${t}`)
    .getByRole("link", { name: "Tiếp tục soạn" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/knowledge/new\\?id=${ids.draft}$`));
  await expect(page.getByLabel(/^Tiêu đề/)).toHaveValue(`DEMO · Nháp ${t}`);
  await expect(
    page.getByRole("button", { name: "Lưu nháp", exact: true }),
  ).toBeEnabled();
  // A pending article opens read-only.
  await page.goto(form("pending"));
  await expect(page.getByTestId("draft-status")).toContainText(
    "Đang chờ duyệt",
  );
  await expect(
    page.getByRole("button", { name: "Gửi duyệt", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("DATA-33: chỉ bài của chính mình; trống, không khớp, lỗi + thử lại; bố cục không tràn, vùng chạm ≥ 44px", async ({
  page,
}, info) => {
  const t = `ui07m${info.project.name}${Date.now()}`;
  await seedStates(t);
  // The department head reviews employee's pending articles but they are not "his" articles.
  await login(page, "head");
  await page.goto(`/knowledge/mine?q=${t}`);
  await expect(
    page.getByRole("heading", {
      name: /Không có bài phù hợp|Bạn chưa có bài viết nào/,
    }),
  ).toBeVisible();
  await logout(page);

  await login(page);
  await page.goto("/knowledge/mine?q=khongcobainay");
  await expect(
    page.getByRole("heading", { name: "Không có bài phù hợp" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page).toHaveURL(/\/knowledge\/mine$/);

  await page.route("**/api/v1/workspace/contents", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.goto("/knowledge/mine");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có bài viết nào" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Tạo bài chia sẻ đầu tiên" }),
  ).toHaveAttribute("href", "/knowledge/new");
  await page.unroute("**/api/v1/workspace/contents");

  await page.route("**/api/v1/workspace/contents", (r) =>
    r.fulfill({
      status: 500,
      json: { error: { code: "X", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto("/knowledge/mine");
  await expect(
    page.getByRole("heading", { name: "Không tải được bài viết của bạn" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/workspace/contents");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    page.getByRole("list", { name: "Danh sách bài viết của tôi" }),
  ).toBeVisible();

  await page.goto(`/knowledge/mine?q=${t}`);
  await expect(list(page).getByRole("listitem")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  for (const l of await list(page).getByRole("link").all())
    expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  if (isMobile(info.project.name))
    expect(
      (await page.getByRole("button", { name: /^Tất cả/ }).boundingBox())!
        .height,
    ).toBeGreaterThanOrEqual(44);
});
