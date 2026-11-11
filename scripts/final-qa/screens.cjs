// Final QA: screenshot every approved screen (UI-01..UI-09) at the four review viewports, with the right role,
// and record basic layout checks (horizontal overflow, smallest interactive target, JS errors) as JSON.
// UI_DEMO_PASSWORD required. Read-only: opens pages, never submits forms.
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/reports/final-qa/screens');
fs.mkdirSync(out, { recursive: true });
const pw = process.env.UI_DEMO_PASSWORD;
const views = [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile390', 390, 844], ['mobile375', 375, 812]];

async function login(page, user) {
  await page.goto('/login');
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(user);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(pw);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}
(async () => {
  const browser = await chromium.launch();
  const ctx0 = await browser.newContext({ baseURL: base, ignoreHTTPSErrors: true });
  const p0 = await ctx0.newPage();
  await login(p0, 'employee');
  const j = async (u) => (await p0.request.get(u)).json();
  const doc = (await j('/api/v1/documents?pageSize=1')).items[0];
  const art = (await j('/api/v1/articles?pageSize=1')).items[0];
  const inc = JSON.parse(fs.readFileSync(path.join(root, '.local/ui06.json'), 'utf8')).main.id;
  const course = (await j('/api/v1/my/learning')).find((c) => c.status === 'COMPLETED') || (await j('/api/v1/my/learning'))[0];
  await ctx0.close();
  const screens = [
    ['ui01-login', null, '/login'],
    ['ui02-dashboard', 'employee', '/'],
    ['ui03-documents', 'employee', '/documents'],
    ['ui04-document-detail', 'employee', `/documents/${doc.id}`],
    ['ui05-knowledge', 'employee', '/knowledge'],
    ['ui05b-knowledge-detail', 'employee', `/knowledge/${art.id}`],
    ['ui06-incident-detail', 'employee', `/incidents/${inc}`],
    ['ui07-knowledge-create', 'employee', '/knowledge/new'],
    ['ui07-my-articles', 'employee', '/knowledge/mine'],
    ['ui08-my-courses', 'employee', '/learning'],
    ['ui08-course', 'employee', `/learning/${course.id}`],
    ['ui09-approvals', 'head', '/approvals'],
  ];
  const results = [];
  for (const [name, w, h] of views) {
    const mobile = w < 768;
    const sessions = {};
    for (const [key, user, url] of screens) {
      if (!sessions[user || 'anon']) {
        const ctx = await browser.newContext({ baseURL: base, viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
        const page = await ctx.newPage();
        if (user) await login(page, user);
        sessions[user || 'anon'] = page;
      }
      const page = sessions[user || 'anon'];
      const errors = [];
      const onErr = (e) => errors.push(e.message);
      page.on('pageerror', onErr);
      const res = await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.locator('main [aria-busy=true]').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        const targets = [...document.querySelectorAll('main a[href], main button, main input:not([type=hidden]), main select, main textarea')]
          .filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; });
        const small = targets.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 40 && r.width < 40 * 4 && !e.closest('p,li,dd,td,small,span:not([class])'); }).length;
        const h1 = document.querySelectorAll('h1').length;
        const unlabeled = [...document.querySelectorAll('main input:not([type=hidden]), main select, main textarea')].filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).length;
        const imgsNoAlt = [...document.querySelectorAll('main img')].filter((i) => !i.hasAttribute('alt')).length;
        return { overflow, targets: targets.length, small, h1, unlabeled, imgsNoAlt, title: document.title };
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `${key}-${name}.png`) });
      await page.screenshot({ path: path.join(out, `${key}-${name}-full.png`), fullPage: true });
      page.off('pageerror', onErr);
      results.push({ screen: key, viewport: name, url, status: res && res.status(), ...m, jsErrors: errors });
    }
    for (const p of Object.values(sessions)) await p.context().close();
  }
  await browser.close();
  fs.writeFileSync(path.join(root, 'docs/reports/final-qa/results/screens.json'), JSON.stringify(results, null, 2));
  console.log(`Captured ${results.length} screens.`);
})().catch((e) => { console.error(e); process.exit(1); });
