/**
 * qa-grind.mjs —— 自动游玩探针：按住指针沿利萨茹轨迹连续挥砍，
 * 验证升级（出果变密）、炸弹结束、连击横幅等随机路径，并解析结算弹窗。
 * 用法：node scripts/qa-grind.mjs [最长秒数=90]
 */
import { chromium } from 'playwright-core';

const BASE = process.env.QA_BASE ?? 'http://localhost:5173';
const MAX_MS = Number(process.argv[2] ?? 90) * 1000;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByText('开始切割').click();
await page.getByText('挥刀开始').waitFor({ timeout: 30000 });
await page.waitForTimeout(500); // 等 LoaderOverlay 退出动画结束，避免首笔被覆盖层吞掉
const box = await page.locator('canvas').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const rx = box.width * 0.42;
const ry = box.height * 0.3;

let maxLevel = 1;
let maxScore = 0;
let comboSeen = false;
let levelLog = '';
let over = false;

// 按住不放：恒速锯齿路径反复扫过水果飞行带（y 200~560），
// 每次横穿用 steps=8 插值，保证 80ms 判定窗口内始终有 >=2 个轨迹点。
const left = box.x + box.width * 0.08;
const right = box.x + box.width * 0.92;
let y = cy - 60;
let goingRight = true;
await page.mouse.move(left, y);
await page.mouse.down();
const started = Date.now();
while (Date.now() - started < MAX_MS) {
  const targetX = goingRight ? right : left;
  y += goingRight ? 55 : -55;
  if (y > cy + 170) y = cy - 170;
  if (y < cy - 170) y = cy + 170;
  y = Math.min(box.y + box.height * 0.82, Math.max(box.y + box.height * 0.2, y));
  await page.mouse.move(targetX, y, { steps: 10 });
  goingRight = !goingRight;
  // 每 ~4 次横穿采样一次 HUD
  const levelText = await page.evaluate(() =>
    [...document.querySelectorAll('.hud-num')].map((el) => el.textContent).join('|'),
  );
  const m = levelText.match(/Lv\.(\d+)/);
  if (m && Number(m[1]) > maxLevel) {
    maxLevel = Number(m[1]);
    levelLog += ` t=${Math.round((Date.now() - started) / 1000)}s→Lv${maxLevel}`;
  }
  const score = Number(levelText.split('|')[0]);
  if (Number.isFinite(score)) maxScore = Math.max(maxScore, score);
  if (await page.locator('text=连击 +').count() > 0) comboSeen = true;
  if (await page.getByText('游戏结束').count() > 0) {
    over = true;
    break;
  }
}
await page.mouse.up().catch(() => undefined);
await page.waitForTimeout(800);
await page.screenshot({ path: '.qa-shots/grind-final.png' });

let overReason = '未结束';
let modalStats = '';
if (over || (await page.getByText('游戏结束').count()) > 0) {
  overReason = (await page.locator('p:has-text("切中炸弹"), p:has-text("三次漏切")').first().textContent().catch(() => '')) || '未知';
  modalStats = (await page.getByRole('dialog', { name: '结算' }).textContent().catch(() => '')) ?? '';
}
console.log(`\n结果：最高等级=${maxLevel}${levelLog} 最高分=${maxScore} 连击横幅=${comboSeen}`);
console.log(`结束原因=${overReason}（漏切<3 即为炸弹结束）`);
console.log(`结算弹窗摘录=${modalStats.slice(0, 120)}`);
console.log(`JS异常=${errors.length}`);
if (errors.length > 0) console.log(errors.slice(0, 5).join('\n'));
await browser.close();
