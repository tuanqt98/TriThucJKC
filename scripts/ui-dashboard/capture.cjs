const { chromium } = require('../../starter/apps/web/node_modules/@playwright/test');
const path = require('node:path');
(async () => {
 const browser=await chromium.launch();
 for(const [name,width,height] of [['desktop',1440,900],['tablet',768,1024],['mobile390',390,844],['mobile375',375,812]]) {
  const page=await browser.newPage({baseURL:"https://localhost:18444",viewport:{width,height},ignoreHTTPSErrors:true,locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
  await page.goto('https://localhost:18444/login');
  await page.getByLabel('Tên đăng nhập',{exact:true}).fill('employee');
  await page.getByLabel('Mật khẩu',{exact:true}).fill(process.env.UI_DEMO_PASSWORD);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.waitForURL('https://localhost:18444/');
  await page.getByRole('heading',{name:'Tri thức nổi bật',exact:true}).waitFor();
  await page.getByText('Đang tải nhiệm vụ…',{exact:true}).waitFor({state:'hidden'});
  await page.evaluate(()=>document.fonts.ready);
  for(const img of await page.locator("main img").all()){await img.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());}
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.resolve('docs/reports/ui-02',`${process.env.UI_CAPTURE_PHASE||'after'}-${name}-full.png`),fullPage:true});
  await page.screenshot({path:path.resolve('docs/reports/ui-02',`${process.env.UI_CAPTURE_PHASE||'after'}-${name}.png`),fullPage:false});
  const me=await (await page.request.get('/api/v1/auth/me')).json();
  await page.request.post('/api/v1/auth/logout',{headers:{Origin:'https://localhost:18444','X-CSRF-Token':me.csrf_token}});
  await page.close();
 }
 await browser.close();
 console.log('Dashboard captured at four requested viewports.');
})().catch(e=>{console.error(e.message);process.exit(1);});
