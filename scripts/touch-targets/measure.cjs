// PO decision D (11/11/2026): touch targets >= 44px on UI-03, UI-04, UI-05B, UI-06, UI-08 without redesign.
// Measures the EFFECTIVE hit area of every interactive element in <main> by probing document.elementFromPoint
// outward from the element box (so transparent hit-area extensions count, drawn pixels do not), and takes
// viewport screenshots for a pixel Before/After comparison. Read-only: never submits forms.
// Usage: UI_DEMO_PASSWORD=... node scripts/touch-targets/measure.cjs <label>   (label: before | after)
const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const label = process.argv[2] || 'run';
const base = process.env.UI_BASE_URL || 'https://localhost:18444';
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/reports/touch-targets', label);
fs.mkdirSync(out, { recursive: true });
const pw = process.env.UI_DEMO_PASSWORD;
const MIN = 44;
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
  const mine = await j('/api/v1/my/learning');
  const course = mine.find((c) => c.status === 'COMPLETED') || mine[0];
  await ctx0.close();
  const screens = [
    ['ui03-documents', '/documents'],
    ['ui04-document-detail', `/documents/${doc.id}`],
    ['ui05b-knowledge-detail', `/knowledge/${art.id}`],
    ['ui06-incident-detail', `/incidents/${inc}`],
    ['ui08-my-courses', '/learning'],
    ['ui08-course', `/learning/${course.id}`],
  ];
  const results = [];
  for (const [vname, w, h] of views) {
    const mobile = w < 768;
    const ctx = await browser.newContext({ baseURL: base, viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await login(page, 'employee');
    for (const [key, url] of screens) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await page.locator('main [aria-busy=true]').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `${key}-${vname}.png`) });
      const targets = await page.evaluate((MIN) => {
        const sel = 'main a[href], main button, main [role=button], main [role=tab], main input:not([type=hidden]), main select, main textarea, main summary';
        const els = [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        });
        const hits = (e, x, y) => {
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
          const t = document.elementFromPoint(x, y);
          return !!t && (t === e || e.contains(t));
        };
        const out = [];
        for (const e of els) {
          e.scrollIntoView({ block: 'center', inline: 'nearest' });
          const r = e.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (!hits(e, cx, cy)) continue; // covered (e.g. by a sticky bar) at this scroll position
          const reach = (dx, dy, start) => { let d = start; while (d < 60 && hits(e, cx + dx * (d + 1), cy + dy * (d + 1))) d++; return d; };
          const up = reach(0, -1, 0), down = reach(0, 1, 0), left = reach(-1, 0, 0), right = reach(1, 0, 0);
          const hitH = up + down + 1, hitW = left + right + 1;
          const inline = !!e.closest('p,li:not([role]),dd,td') && e.tagName === 'A' && getComputedStyle(e).display === 'inline';
          out.push({
            tag: e.tagName.toLowerCase(),
            text: (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
            cls: (e.className && typeof e.className === 'string' ? e.className : '').split(' ')[0].replace(/__[A-Za-z0-9_-]+$/, ''),
            box: [Math.round(r.width), Math.round(r.height)],
            hit: [hitW, hitH],
            inline,
            small: !inline && (hitH < MIN || hitW < MIN),
          });
        }
        window.scrollTo(0, 0);
        return out;
      }, MIN);
      const small = targets.filter((t) => t.small);
      results.push({ screen: key, viewport: vname, targets: targets.length, small: small.length, smallTargets: small });
      console.log(`${label} ${key} ${vname}: ${targets.length} targets, ${small.length} < ${MIN}px` + (small.length ? ' → ' + small.map((s) => `"${s.text}" ${s.hit.join('x')}`).join('; ') : ''));
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'targets.json'), JSON.stringify(results, null, 2) + '\n');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
