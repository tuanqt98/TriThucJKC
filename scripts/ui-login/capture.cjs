const { chromium } = require("../../starter/apps/web/node_modules/@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const output = path.resolve(__dirname,"../../docs/reports/ui-01");
const base = process.env.UI_BASE_URL || "https://localhost:18444";
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch();
  for(const [name,width,height] of [["desktop",1440,900],["mobile390",390,844],["mobile375",375,812]]){
    const page=await browser.newPage({viewport:{width,height},ignoreHTTPSErrors:process.env.UI_TEST_LOCAL_CA==="true",locale:"vi-VN",timezoneId:"Asia/Ho_Chi_Minh"});
    await page.goto(base+"/login");await page.getByLabel("Tên đăng nhập",{exact:true}).waitFor();await page.getByRole("button",{name:"Đăng nhập",exact:true}).waitFor();
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
    await page.mouse.move(0,0);await page.screenshot({path:path.join(output,`after-${name}.png`),fullPage:true});await page.close();
  }
  await browser.close();console.log("Captured actual login: 1440x900, 390x844, 375x812.");
})().catch(e=>{console.error(e.message);process.exit(1);});
