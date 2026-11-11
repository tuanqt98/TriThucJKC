// Screenshot /documents/{id} at the four review viewports.
// UI_DEMO_PASSWORD required. UI_CAPTURE_USER (default employee), UI_CAPTURE_DOC (default: user's current reading task),
// UI_CAPTURE_PHASE (before|after), UI_CAPTURE_SUFFIX (optional, e.g. "-acked"),
// UI_CAPTURE_TAB (optional mobile tab label prefix, e.g. "Tệp đính kèm"; mobile viewports only).
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
(async () => {
  const browser = await chromium.launch();
  const user = process.env.UI_CAPTURE_USER || 'employee';
  const phase = process.env.UI_CAPTURE_PHASE || 'after', suffix = process.env.UI_CAPTURE_SUFFIX || '';
  const tab = process.env.UI_CAPTURE_TAB;
  const sizes = [['desktop',1440,900],['tablet',768,1024],['mobile390',390,844],['mobile375',375,812]].filter(([, w]) => !tab || w < 768);
  for (const [name, width, height] of sizes) {
    const page = await browser.newPage({ baseURL: base, viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768, ignoreHTTPSErrors: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    await page.goto('/login');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(user);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.UI_DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    let doc = process.env.UI_CAPTURE_DOC;
    if (!doc) {
      const tasks = await (await page.request.get('/api/v1/my/reading')).json();
      doc = (tasks.find((t) => t.is_current) || tasks[0]).content_id;
    }
    await page.goto(`/documents/${doc}`);
    await page.locator('main h1, main h2').first().waitFor();
    await page.waitForLoadState('networkidle');
    if (tab) await page.getByRole('tab', { name: new RegExp('^' + tab) }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0));
    const out = path.resolve(__dirname, '../../docs/reports/ui-04');
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}.png`) });
    const me = await (await page.request.get('/api/v1/auth/me')).json();
    await page.request.post('/api/v1/auth/logout', { headers: { Origin: base, 'X-CSRF-Token': me.csrf_token } });
    await page.close();
  }
  await browser.close();
  console.log(`Captured ${phase}${suffix} for document detail at four viewports.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
