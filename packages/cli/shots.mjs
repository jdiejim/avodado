import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewportSize:{width:1440,height:1000}, deviceScaleFactor:1 });
for (const [path, name] of [['/blocks','blocks'],['/playground','playground'],['/demo','demo']]) {
  await p.goto('http://localhost:3000'+path, {waitUntil:'networkidle'});
  await p.waitForTimeout(900);
  await p.screenshot({ path: `/tmp/site-${name}.png` });
}
await b.close();
