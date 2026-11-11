// Screenshot /knowledge at the four review viewports.
// UI_DEMO_PASSWORD required. UI_CAPTURE_USER (default employee), UI_CAPTURE_PHASE (before|after),
// UI_CAPTURE_QUERY (URL query string without '?', e.g. "q=offset"), UI_CAPTURE_SUFFIX (e.g. "-search"),
// UI_CAPTURE_MOBILE_ONLY=true, UI_CAPTURE_OPEN_FILTERS=true (mobile: open the filter sheet).
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
(async () => {
  const browser = await chromium.launch();
  const user = process.env.UI_CAPTURE_USER || 'employee';
  const phase = process.env.UI_CAPTURE_PHASE || 'after', suffix = process.env.UI_CAPTURE_SUFFIX || '';
  const query = process.env.UI_CAPTURE_QUERY ? `?${process.env.UI_CAPTURE_QUERY}` : '';
  const sizes = [['desktop',1440,900],['tablet',768,1024],['mobile390',390,844],['mobile375',375,812]]
    .filter(([, w]) => process.env.UI_CAPTURE_MOBILE_ONLY !== 'true' || w < 768);
  for (const [name, width, height] of sizes) {
    const page = await browser.newPage({ baseURL: base, viewport: { width, height }, isMobile: width < 768, hasTouch: width < 768, ignoreHTTPSErrors: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    await page.goto('/login');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(user);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.UI_DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    await page.goto(`/knowledge${query}`);
    await page.waitForLoadState('networkidle');
    await page.locator('main [aria-busy=true]').waitFor({ state: 'detached' }).catch(() => {});
    if (process.env.UI_CAPTURE_OPEN_FILTERS === 'true' && width < 768)
      await page.getByRole('button', { name: /^Bộ lọc/ }).click();
    await page.evaluate(() => document.fonts.ready);
    for (const img of await page.locator('main img:visible').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((i) => i.decode().catch(() => {}));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const out = path.resolve(__dirname, '../../docs/reports/ui-05');
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}.png`) });
    const me = await (await page.request.get('/api/v1/auth/me')).json();
    await page.request.post('/api/v1/auth/logout', { headers: { Origin: base, 'X-CSRF-Token': me.csrf_token } });
    await page.close();
  }
  await browser.close();
  console.log(`Captured ${phase}${suffix} for /knowledge${query}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
