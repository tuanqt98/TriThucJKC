// Screenshot /knowledge/<id> at the four review viewports (UI-05B).
// UI_DEMO_PASSWORD and UI_ARTICLE_ID required. UI_CAPTURE_PHASE: before | proposal | after.
// "proposal" renders the design PROPOSAL (scripts/ui-knowledge-detail/proposal/*) inside the real
// UI-05 app frame using the real API response of that article; it is not production code.
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
const id = process.env.UI_ARTICLE_ID;
const phase = process.env.UI_CAPTURE_PHASE || 'before';
const suffix = process.env.UI_CAPTURE_SUFFIX || '';
const out = path.resolve(__dirname, '../../docs/reports/ui-05b');
(async () => {
  if (!id) throw new Error('Cần UI_ARTICLE_ID');
  const browser = await chromium.launch();
  const sizes = [['desktop',1440,900],['tablet',768,1024],['mobile390',390,844],['mobile375',375,812]];
  for (const [name, width, height] of sizes) {
    const mobile = width < 768;
    const page = await browser.newPage({ baseURL: base, viewport: { width, height }, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    await page.goto('/login');
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(process.env.UI_CAPTURE_USER || 'employee');
    await page.getByLabel('Mật khẩu', { exact: true }).fill(process.env.UI_DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    if (phase === 'proposal') {
      // Real app frame (UI-05 /knowledge), then swap <main> for the proposal markup fed by real API data.
      await page.goto('/knowledge');
      await page.locator('main [aria-busy=true]').waitFor({ state: 'detached' }).catch(() => {});
      await page.waitForLoadState('networkidle');
      const css = fs.readFileSync(path.join(__dirname, 'proposal/proposal.css'), 'utf8');
      const js = fs.readFileSync(path.join(__dirname, 'proposal/render.js'), 'utf8');
      await page.addStyleTag({ content: css });
      await page.evaluate(`(${js})(${JSON.stringify({ id, tab: process.env.UI_PROPOSAL_TAB || 'content' })})`);
      await page.locator('main[data-proposal-ready]').waitFor();
    } else {
      await page.goto(`/knowledge/${id}`);
      await page.waitForLoadState('networkidle');
      await page.locator('main [aria-busy=true]').waitFor({ state: 'detached' }).catch(() => {});
      // phase "after": UI_CAPTURE_TAB=files|approval opens that mobile tab of the real UI-05B page.
      const tab = { files: /^Ảnh & tệp/, approval: /^Phê duyệt$/ }[process.env.UI_CAPTURE_TAB || ''];
      if (tab && mobile) await page.getByRole('tab', { name: tab }).click();
      if (tab && !mobile) { await page.close(); continue; }
    }
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
  console.log(`Captured ${phase}${suffix} for /knowledge/${id}.`);
})().catch((e) => { console.error(e.message); process.exit(1); });
