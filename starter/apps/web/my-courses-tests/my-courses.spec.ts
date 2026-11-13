import { test, expect, request, type Page } from "@playwright/test";
import { createCourses, QUESTIONS } from "./fixture";

const password = process.env.UI_DEMO_PASSWORD || "";
test.skip(!password, "Cần UI_DEMO_PASSWORD (tài khoản DEMO).");
const token = (p: string) => `ui08${p}${Date.now()}`;
type Item = {
  id: string;
  title: string;
  status: string;
  completed_lessons: number;
  total_lessons: number;
  due_at: string | null;
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
const cards = (page: Page) =>
  page.getByRole("list", { name: "Danh sách khóa học" }).getByRole("listitem");
const card = (page: Page, title: string) =>
  cards(page).filter({ hasText: title });
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
async function listReady(page: Page) {
  await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
}

test.afterEach(async ({ page }) => logout(page));

test("UI-08: danh sách theo mockup 07 — thống kê, tab, tìm kiếm, tiến độ từ backend, hạn, kết quả gần đây", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const t = token(info.project.name);
  const c = await createCourses(request, password, t, [
    { name: "Chưa học", dueDays: 10, learner: "none" },
    { name: "Đang học", dueDays: 5, learner: "one-lesson" },
    { name: "Đã đạt", dueDays: 3, learner: "pass" },
    { name: "Không đạt", dueDays: 8, learner: "fail", maxAttempts: 1 },
    { name: "Quá hạn", dueDays: -2, learner: "none" },
  ]);
  await login(page);
  await page.goto("/learning");
  await listReady(page);
  const api: Item[] = await (
    await page.request.get("/api/v1/my/learning")
  ).json();
  // Stat cards equal backend statuses.
  for (const [label, s] of [
    ["Chưa bắt đầu", "NOT_STARTED"],
    ["Đang học", "IN_PROGRESS"],
    ["Hoàn thành", "COMPLETED"],
    ["Quá hạn", "OVERDUE"],
  ])
    await expect(
      page
        .getByRole("group", { name: "Thống kê khóa học" })
        .getByRole("button", { name: new RegExp(`^${label}`) }),
    ).toContainText(String(api.filter((i) => i.status === s).length));

  await page.getByRole("searchbox", { name: "Tìm khóa học được giao" }).fill(t);
  await expect(page).toHaveURL(new RegExp(`q=${t}`));
  await expect(cards(page)).toHaveCount(5);
  const expectCard = async (name: string, status: string, cta: string) => {
    const it = api.find((i) => i.title === c[name].title)!;
    const el = card(page, c[name].title);
    await expect(el).toContainText(status);
    await expect(el).toContainText(
      `${it.completed_lessons}/${it.total_lessons} bài học`,
    );
    await expect(el).toContainText(
      `${Math.round((it.completed_lessons / it.total_lessons) * 100)}%`,
    );
    const link = el.getByRole("link");
    await expect(link).toHaveText(cta);
    await expect(link).toHaveAttribute("href", `/learning/${it.id}`);
    return el;
  };
  await expectCard("Chưa học", "Chưa bắt đầu", "Bắt đầu học");
  await expectCard("Đang học", "Đang học", "Tiếp tục học");
  await expect(
    await expectCard("Đã đạt", "Hoàn thành", "Xem lại khóa học"),
  ).toContainText("Hoàn thành ");
  await expectCard("Không đạt", "Không đạt", "Xem kết quả");
  await expect(
    (await expectCard("Quá hạn", "Quá hạn", "Bắt đầu học")).getByText(/^Hạn:/),
  ).toBeVisible();

  // Tabs and stat cards filter; state in the URL survives reload.
  await page
    .getByRole("group", { name: "Lọc theo trạng thái học" })
    .getByRole("button", { name: /^Quá hạn/ })
    .click();
  await expect(page).toHaveURL(/status=OVERDUE/);
  await expect(cards(page)).toHaveCount(1);
  await page.reload();
  await listReady(page);
  await expect(cards(page)).toHaveCount(1);
  await page
    .getByRole("group", { name: "Thống kê khóa học" })
    .getByRole("button", { name: /^Hoàn thành/ })
    .click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText(c["Đã đạt"].title);

  // Side panels: real due dates and real submitted attempts (server scores).
  // Due panel = the 5 nearest real due dates of unfinished courses (staging keeps older test courses).
  const nearest = api
    .filter((i) => i.status !== "COMPLETED" && i.due_at)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
    .slice(0, 5)
    .map((i) => i.title);
  const dueLinks = page
    .getByRole("region", { name: "Hạn hoàn thành sắp tới" })
    .getByRole("link");
  await expect(dueLinks).toHaveCount(nearest.length);
  for (const [n, title] of nearest.entries())
    await expect(dueLinks.nth(n)).toContainText(title);
  const results = page.getByRole("region", {
    name: "Kết quả kiểm tra gần đây",
  });
  await expect(
    results.getByRole("listitem").filter({ hasText: c["Đã đạt"].title }),
  ).toContainText("100/100");
  await expect(
    results.getByRole("listitem").filter({ hasText: c["Không đạt"].title }),
  ).toContainText("Chưa đạt");
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("UI-08: học khóa học — bài học, điều kiện kiểm tra, không lộ đáp án, máy chủ chấm điểm, lịch sử, hoàn thành", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const t = token(info.project.name);
  const c = await createCourses(request, password, t, [
    { name: "Học thử", dueDays: 7, learner: "none" },
    { name: "Một lần", dueDays: 7, learner: "none", maxAttempts: 1 },
  ]);
  await login(page);
  const id = c["Học thử"].assignment;
  // The learner API never sends answer keys.
  const raw = await (
    await page.request.get(`/api/v1/my/learning/${id}`)
  ).text();
  expect(raw).not.toContain("is_correct");
  await page.goto("/learning");
  await page.getByRole("searchbox", { name: "Tìm khóa học được giao" }).fill(t);
  await card(page, c["Học thử"].title)
    .getByRole("link", { name: "Bắt đầu học" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/learning/${id}$`));
  await expect(
    page.getByRole("heading", { name: c["Học thử"].title, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Hoàn thành các bài học trước khi bắt đầu kiểm tra."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bắt đầu kiểm tra", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("progressbar", { name: "Tiến độ bài học" }),
  ).toHaveAttribute("aria-valuenow", "0");

  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Tôi đã hoàn thành bài học này" })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Đã hoàn thành bài học", exact: true }),
    ).toHaveCount(i + 1);
  }
  await expect(
    page.getByRole("progressbar", { name: "Tiến độ bài học" }),
  ).toHaveAttribute("aria-valuenow", "100");
  await page
    .getByRole("button", { name: "Bắt đầu kiểm tra", exact: true })
    .click();
  const submit = page.getByRole("button", {
    name: "Nộp bài kiểm tra",
    exact: true,
  });
  await expect(submit).toBeDisabled(); // every question needs an answer
  await page.getByLabel(QUESTIONS[0].correct, { exact: true }).check();
  await expect(submit).toBeDisabled();
  await page.getByLabel(QUESTIONS[1].correct, { exact: true }).check();
  const box = (await page
    .getByText(QUESTIONS[1].correct, { exact: true })
    .boundingBox())!;
  expect(box.height).toBeGreaterThan(0);
  expect(
    (await page
      .locator("main label")
      .filter({ hasText: QUESTIONS[1].correct })
      .boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Đã nộp bài: 100/100 · Đạt",
  );
  await expect(
    page.getByRole("table", { name: "Lịch sử làm bài" }),
  ).toContainText("100");
  await expect(page.getByText(/Đã hoàn thành khóa học này/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bắt đầu kiểm tra", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Lịch sử làm bài" }),
  ).toContainText("Đạt");
  expect(
    (await (await page.request.get("/api/v1/my/learning")).json()).find(
      (i: Item) => i.id === id,
    ).status,
  ).toBe("COMPLETED");

  // One attempt, wrong answers: server says "Chưa đạt", no more attempts, status FAILED.
  const one = c["Một lần"].assignment;
  await page.goto(`/learning/${one}`);
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Tôi đã hoàn thành bài học này" })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Đã hoàn thành bài học", exact: true }),
    ).toHaveCount(i + 1);
  }
  await page
    .getByRole("button", { name: "Bắt đầu kiểm tra", exact: true })
    .click();
  await page.getByLabel(QUESTIONS[0].wrong, { exact: true }).check();
  await page.getByLabel(QUESTIONS[1].wrong, { exact: true }).check();
  await page
    .getByRole("button", { name: "Nộp bài kiểm tra", exact: true })
    .click();
  await expect(page.locator("main").getByRole("status")).toContainText(
    "Chưa đạt",
  );
  await expect(
    page.getByText("Bạn đã dùng hết số lần làm bài cho phiên bản này."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đã hết số lần làm bài" }),
  ).toBeDisabled();
  expect(
    (await (await page.request.get("/api/v1/my/learning")).json()).find(
      (i: Item) => i.id === one,
    ).status,
  ).toBe("FAILED");
  await expect(page.getByText("Đã hoàn thành khóa học này")).toHaveCount(0);
});

test("UI-08: quyền và phiên — chỉ khóa được giao, không sửa điểm, hết phiên chuyển đăng nhập", async ({
  page,
}, info) => {
  const t = token(info.project.name);
  const c = await createCourses(request, password, t, [
    { name: "Riêng", dueDays: 7, learner: "pass" },
  ]);
  const id = c["Riêng"].assignment;
  // Another user cannot open or act on employee's assignment.
  await login(page, "other");
  await page.goto(`/learning/${id}`);
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy khóa học" }),
  ).toBeVisible();
  await expect(page.getByText(c["Riêng"].title)).toHaveCount(0);
  const me = await (await page.request.get("/api/v1/auth/me")).json();
  const h = {
    Origin: new URL(page.url()).origin,
    "X-CSRF-Token": me.csrf_token,
  };
  expect(
    (
      await page.request.post(`/api/v1/my/learning/${id}/quiz-attempts`, {
        headers: h,
      })
    ).status(),
  ).toBe(404);
  await page.goto("/learning");
  await page.getByRole("searchbox", { name: "Tìm khóa học được giao" }).fill(t);
  await expect(
    page.getByRole("heading", {
      name: /Không có khóa học phù hợp|Bạn chưa được giao khóa học nào/,
    }),
  ).toBeVisible();
  await logout(page);

  // DATA-39: once passed, the API refuses a new attempt and keeps history.
  await login(page);
  {
    const me0 = await (await page.request.get("/api/v1/auth/me")).json();
    const h0 = {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": me0.csrf_token,
    };
    const again = await page.request.post(
      `/api/v1/my/learning/${id}/quiz-attempts`,
      { headers: h0 },
    );
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe("QUIZ_ALREADY_PASSED");
    const detail = await (
      await page.request.get(`/api/v1/my/learning/${id}`)
    ).json();
    expect(detail.attempts).toHaveLength(1);
    expect(detail.attempts[0].passed).toBe(true);
  }
  // The learner has no endpoint to change a score or status (grading lives in jkc_submit_quiz).
  const me2 = await (await page.request.get("/api/v1/auth/me")).json();
  const h2 = {
    Origin: new URL(page.url()).origin,
    "X-CSRF-Token": me2.csrf_token,
  };
  for (const method of ["put", "patch"] as const)
    expect([404, 405]).toContain(
      (
        await page.request[method](`/api/v1/my/learning/${id}`, {
          headers: h2,
          data: { status: "COMPLETED", score: 100 },
        })
      ).status(),
    );
  // UI never offers a new attempt once the course is passed.
  await page.goto(`/learning/${id}`);
  await expect(page.getByText("Đã hoàn thành khóa học này")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bắt đầu kiểm tra", exact: true }),
  ).toHaveCount(0);

  // Session expired while using the page -> login with the UI-01 message.
  await page.route("**/api/v1/my/learning", (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: "AUTH_REQUIRED", message: "x" } },
    }),
  );
  await page.goto("/learning");
  await expect(page).toHaveURL(/\/login\?reason=session-expired/);
  await page.unroute("**/api/v1/my/learning");
  await logout(page);
  await page.goto(`/learning/${id}`);
  await expect(page).toHaveURL(/\/login/);
});

test("UI-08: đang tải, rỗng, lỗi + thử lại, lỗi mạng khi nộp bài, bố cục ≥ 44px và không tràn", async ({
  page,
}, info) => {
  const t = token(info.project.name);
  const c = await createCourses(request, password, t, [
    { name: "Trạng thái", dueDays: 7, learner: "none" },
  ]);
  await login(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/my/learning", async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto("/learning");
  await expect(
    page.getByRole("status", { name: "Đang tải khóa học" }),
  ).toBeVisible();
  release();
  await listReady(page);
  await page.unroute("**/api/v1/my/learning");

  await page.route("**/api/v1/my/learning", (r) => r.fulfill({ json: [] }));
  await page.goto("/learning");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa được giao khóa học nào" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/my/learning");

  await page.route("**/api/v1/my/learning", (r) =>
    r.fulfill({
      status: 500,
      json: { error: { code: "X", message: "Lỗi máy chủ (giả lập)." } },
    }),
  );
  await page.goto("/learning");
  await expect(
    page.getByRole("heading", { name: "Không tải được khóa học" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/my/learning");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    page.getByRole("list", { name: "Danh sách khóa học" }),
  ).toBeVisible();

  // Network failure on a learner action: no success message.
  const id = c["Trạng thái"].assignment;
  await page.goto(`/learning/${id}`);
  await page.route("**/lessons/*/complete", (r) =>
    r.abort("internetdisconnected"),
  );
  await page
    .getByRole("button", { name: "Tôi đã hoàn thành bài học này" })
    .first()
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "chưa được ghi nhận",
  );
  await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  await page.unroute("**/lessons/*/complete");

  await page.goto("/learning/00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy khóa học" }),
  ).toBeVisible();

  await page.goto(`/learning?q=${t}`);
  await listReady(page);
  await noOverflow(page);
  for (const l of await page
    .getByRole("list", { name: "Danh sách khóa học" })
    .getByRole("link")
    .all())
    expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const b of await page
    .getByRole("group", { name: "Lọc theo trạng thái học" })
    .getByRole("button")
    .all())
    if (await b.isVisible())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.goto(`/learning/${id}`);
  await noOverflow(page);
});
