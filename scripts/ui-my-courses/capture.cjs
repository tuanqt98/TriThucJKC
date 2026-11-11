// Screenshot UI-08 pages at the four review viewports.
// UI_DEMO_PASSWORD required. UI_CAPTURE_PHASE before|after, UI_CAPTURE_SUFFIX, UI_CAPTURE_USER (default employee),
// UI_CAPTURE_PATH (default /learning), UI_CAPTURE_CLICK (optional button/tab name to click before capture).
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
const root = path.resolve(__dirname, '../..');
const phase = process.env.UI_CAPTURE_PHASE || 'before', suffix = process.env.UI_CAPTURE_SUFFIX || '';
const target = process.env.UI_CAPTURE_PATH || '/learning';
const out = path.join(root, 'docs/reports/ui-08');
(async () => {
  const browser = await chromium.launch();
  for (const [name, width, height] of [['desktop',1440,900],['tablet',768,1024],['mobile390',390,844],['mobile375',375,812]]) {
    const mobile = width < 768;
    const page = await browser.newPage({ baseURL: base, viewport: { width, height }, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    await page.goto('/login');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(process.env.UI_CAPTURE_USER || 'employee');
    await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.UI_DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    await page.goto(target);
    await page.waitForLoadState('networkidle');
    await page.locator('main [aria-busy=true]').waitFor({ state: 'detached' }).catch(() => {});
    if (process.env.UI_CAPTURE_CLICK)
      await page.getByRole('button', { name: new RegExp(`^${process.env.UI_CAPTURE_CLICK}`) }).first().click();
    await page.evaluate(() => document.fonts.ready);
    for (const img of await page.locator('main img:visible').all()) await img.evaluate((i) => i.decode().catch(() => {}));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}.png`) });
    const me = await (await page.request.get('/api/v1/auth/me')).json();
    await page.request.post('/api/v1/auth/logout', { headers: { Origin: base, 'X-CSRF-Token': me.csrf_token } });
    await page.close();
  }
  await browser.close();
  console.log(`Captured ${phase}${suffix} for ${target}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
