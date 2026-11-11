// Screenshot /incidents/<id> at the four review viewports (UI-06).
// UI_DEMO_PASSWORD required; UI_INCIDENT_ID (default: "main" of .local/ui06.json).
// UI_CAPTURE_PHASE before|after, UI_CAPTURE_SUFFIX, UI_CAPTURE_USER (default employee),
// UI_CAPTURE_EXPAND=true (mobile: expand every section before capturing).
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
const root = path.resolve(__dirname, '../..');
const id = process.env.UI_INCIDENT_ID || JSON.parse(fs.readFileSync(path.join(root, '.local/ui06.json'), 'utf8')).main.id;
const phase = process.env.UI_CAPTURE_PHASE || 'before', suffix = process.env.UI_CAPTURE_SUFFIX || '';
const out = path.join(root, 'docs/reports/ui-06');
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
    await page.goto(`/incidents/${id}`);
    await page.waitForLoadState('networkidle');
    await page.locator('main [aria-busy=true]').waitFor({ state: 'detached' }).catch(() => {});
    if (process.env.UI_CAPTURE_EXPAND === 'true' && mobile)
      for (let n = 0; n < 30 && (await page.locator('main button[aria-expanded=false]').count()); n++)
        await page.locator('main button[aria-expanded=false]').first().click();
    await page.evaluate(() => document.fonts.ready);
    for (const img of await page.locator('main img:visible').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((i) => i.decode().catch(() => {}));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}-full.png`), fullPage: true });
    await page.screenshot({ path: path.join(out, `${phase}-${name}${suffix}.png`) });
    const me = await (await page.request.get('/api/v1/auth/me')).json();
    await page.request.post('/api/v1/auth/logout', { headers: { Origin: base, 'X-CSRF-Token': me.csrf_token } });
    await page.close();
  }
  await browser.close();
  console.log(`Captured ${phase}${suffix} for /incidents/${id}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
