// Screenshot /knowledge/new (UI-07) at the four review viewports.
// UI_DEMO_PASSWORD required. UI_CAPTURE_PHASE before|after, UI_CAPTURE_SUFFIX, UI_CAPTURE_USER (default employee),
// UI_CAPTURE_PATH (default /knowledge/new), UI_CAPTURE_FILL=true fills a DEMO draft locally (not saved),
// UI_CAPTURE_STEP=files|preview clicks that step after filling.
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const path = require('node:path');
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
const root = path.resolve(__dirname, '../..');
const phase = process.env.UI_CAPTURE_PHASE || 'before', suffix = process.env.UI_CAPTURE_SUFFIX || '';
const target = process.env.UI_CAPTURE_PATH || '/knowledge/new';
const out = path.join(root, 'docs/reports/ui-07');
const DEMO = {
  'Tiêu đề': 'DEMO · Bám mực không đều trên bao bì màng khi chạy nhanh',
  'Mô tả vấn đề / kinh nghiệm': 'Trên lô bao bì màng DEMO, mực bám không đều ở vùng nền đặc khi tăng tốc máy.',
  'Điều kiện phát sinh': '- Sau khi đổi lô vật tư\n- Chủ yếu ở màu đậm',
  'Các bước kiểm tra': '1. So sánh với mẫu đã duyệt\n2. Kiểm tra nhãn lô vật tư',
  'Giải pháp / quy trình thao tác': 'Báo trưởng ca và áp dụng hướng dẫn kỹ thuật chính thức của bộ phận.',
};
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
    if (process.env.UI_CAPTURE_FILL === 'true') {
      for (const [label, value] of Object.entries(DEMO)) await page.getByLabel(new RegExp(`^${label}`)).first().fill(value);
      await page.getByLabel(/^Công đoạn/).selectOption({ label: 'In flexo / Bao bì' });
      const step = { files: /^Đính kèm/, preview: /^Xem trước/ }[process.env.UI_CAPTURE_STEP || ''];
      if (step && process.env.UI_CAPTURE_STEP === 'files' && !mobile) { await page.close(); continue; } // desktop shows files inline
      if (step) await page.getByRole(mobile ? 'tab' : 'button', { name: step }).first().click();
    }
    await page.evaluate(() => document.fonts.ready);
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
