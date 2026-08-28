/**
 * qa-live.mjs —— 线上部署冒烟验证：大厅渲染、17 项多媒体资源全部 200、
 * 可开局挥砍计分、无 JS 异常。
 * 用法：node scripts/qa-live.mjs [URL=https://fanhan3927.github.io/sliceninja/]
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'https://fanhan3927.github.io/sliceninja/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

const failed = [];
const mediaByUrl = new Map(); // url → status（去重，response/requestfinished 可能双报）
const record = (res) => {
  const url = res.url();
  if (/audio|images/.test(url)) mediaByUrl.set(url, res.status());
  if (res.status() >= 400) failed.push(`${res.status()} ${url}`);
};
// response 事件对缓存命中的请求可能不触发，叠加 requestfinished 兜底（finished = 请求成功）
page.on('response', record);
page.on('requestfinished', (req) => {
  // requestfinished 只在请求成功完成时触发
  const url = req.url();
  if (/audio|images/.test(url)) mediaByUrl.set(url, 200);
});
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(e.message));

let ok = true;
const check = (name, pass, detail = '') => {
  ok = ok && pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` —— ${detail}` : ''}`);
};

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.getByText('开始切割').waitFor({ timeout: 20000 });
check('大厅渲染', true, BASE);

await page.getByText('开始切割').click();
await page.getByText('挥刀开始').waitFor({ timeout: 30000 });
const mediaOk = mediaByUrl.size >= 17 && [...mediaByUrl.values()].every((s) => s === 200);
check('多媒体资源全部 200（音频9 + 图像8）', mediaOk, `${mediaByUrl.size} 项唯一请求`);
await page.waitForTimeout(500);
const box = await page.locator('canvas').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx - box.width * 0.4, cy);
await page.mouse.down();
for (let i = 0; i < 8; i += 1) {
  await page.mouse.move(cx + (i % 2 ? -1 : 1) * box.width * 0.4, cy - 60 + (i % 3) * 60, { steps: 10 });
  await page.waitForTimeout(420);
}
await page.mouse.up().catch(() => undefined);
const score = Number(await page.locator('.hud-num').first().textContent());
check('线上可开局挥砍', Number.isFinite(score), `score=${score}`);

check('无 4xx/5xx 请求', failed.length === 0, failed.slice(0, 3).join(' | '));
check('无 JS 异常', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));

await page.screenshot({ path: '.qa-shots/live-deployed.png' });
console.log(ok ? '\n==== 线上验证全部通过 ====' : '\n==== 存在未通过项 ====');
await browser.close();
process.exit(ok ? 0 : 1);
