/**
 * qa-smoke.mjs —— SliceNinja 浏览器冒烟验收（可选 QA 工具，不属于运行时）。
 *
 * 用法：
 *   1) npm i --no-save playwright-core
 *   2) node scripts/qa-smoke.mjs        （需先 npm run dev）
 *
 * 覆盖 PROMPTS 步骤 6 验收清单：冷启动、切中计分、漏 3 结束、结算持久化、
 * 删除 public/audio 后合成音不崩、暂停冻结、窄屏滑切不滚动。
 * 使用系统 Edge/Chrome（channel 启动），无需下载浏览器。
 */
import { chromium } from 'playwright-core';
import { mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.QA_BASE ?? 'http://localhost:5173';
const SHOT_DIR = join(process.cwd(), '.qa-shots');
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` —— ${detail}` : ''}`);
};

async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (e) {
      console.log(`channel ${channel} 启动失败：${e.message}`);
    }
  }
  throw new Error('未找到可用的 Edge/Chrome');
}

async function swipe(page, x1, y1, x2, y2, steps = 10) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
}

async function readScore(page) {
  const raw = await page.locator('.hud-num').first().textContent().catch(() => null);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

try {
  // ---- 1. 冷启动：大厅深色页 ----
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByText('开始切割').waitFor({ timeout: 15000 });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('1 冷启动大厅可见', true);
  check('1 背景色 #140c08', bg === 'rgb(20, 12, 8)', bg);
  await page.screenshot({ path: join(SHOT_DIR, '01-hall.png') });

  // ---- 2. 设置持久化（静音写入 localStorage，刷新仍在） ----
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('dialog', { name: '设置' }).waitFor({ timeout: 5000 });
  const bgmSwitch = page.getByRole('switch').first();
  await bgmSwitch.click();
  const mutedNow = await bgmSwitch.getAttribute('aria-checked');
  check('2 关闭 BGM 开关', mutedNow === 'false', `aria-checked=${mutedNow}`);
  await page.screenshot({ path: join(SHOT_DIR, '02-settings.png') });
  await page.getByRole('button', { name: '完成' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('开始切割').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByRole('dialog', { name: '设置' }).waitFor({ timeout: 5000 });
  const mutedAfterReload = await page.getByRole('switch').first().getAttribute('aria-checked');
  check('2 刷新后静音状态保留', mutedAfterReload === 'false', `aria-checked=${mutedAfterReload}`);
  await page.getByRole('button', { name: '完成' }).click();

  // ---- 3. 开始 → Loading → 挥刀开始 ----
  await page.getByText('开始切割').click();
  await page.locator('canvas').waitFor({ timeout: 10000 });
  await page.getByText('挥刀开始').waitFor({ timeout: 30000 });
  const canvasBox = await page.locator('canvas').boundingBox();
  check('3 进入游戏页且画布就绪', !!canvasBox && canvasBox.width > 100, JSON.stringify(canvasBox));
  await page.screenshot({ path: join(SHOT_DIR, '03-ready.png') });

  // ---- 4. 暂停冻结（开局立即测，避免漏 3 提前结束；L1 无炸弹：canvas 帧应完全静止） ----
  const cx = canvasBox.x + canvasBox.width / 2;
  const cy = canvasBox.y + canvasBox.height / 2;
  await swipe(page, cx - canvasBox.width * 0.4, cy, cx + canvasBox.width * 0.4, cy - 40); // 触发开局
  await page.waitForTimeout(1300); // 等水果到空中
  await page.getByRole('button', { name: '暂停' }).click();
  await page.getByText('暂停', { exact: true }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(500); // 刀光余迹淡出
  const frame1 = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  await page.waitForTimeout(700);
  const frame2 = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  check('4 暂停后果实停空中（canvas 帧静止）', frame1 === frame2, frame1 === frame2 ? '两帧一致' : '帧仍在变化');
  await page.screenshot({ path: join(SHOT_DIR, '05-paused.png') });
  await page.getByRole('button', { name: '继续切割' }).click();
  await page.waitForTimeout(400);

  // ---- 5. 挥刀计分（L1 无炸弹，可放心横扫） ----
  const scoreBefore = await readScore(page);
  for (let i = 0; i < 10; i += 1) {
    const dir = i % 2 === 0 ? 1 : -1;
    await swipe(page, cx - dir * canvasBox.width * 0.42, cy - 80 + (i % 4) * 55, cx + dir * canvasBox.width * 0.42, cy - 60 + (i % 3) * 70);
    await page.waitForTimeout(500);
  }
  const scoreAfter = await readScore(page);
  check('5 挥砍后计分增长', scoreAfter > scoreBefore, `before=${scoreBefore} after=${scoreAfter}`);
  await page.screenshot({ path: join(SHOT_DIR, '04-slicing.png') });

  // ---- 6. 漏 3 个 → 结算 + localStorage 回写（不再挥刀，等自然漏接） ----
  await page.getByText('游戏结束').waitFor({ timeout: 60000 });
  await page.waitForTimeout(600);
  const storage = await page.evaluate(() => ({
    highScore: localStorage.getItem('sliceninja.highScore'),
    bestCombo: localStorage.getItem('sliceninja.bestCombo'),
    recentRuns: localStorage.getItem('sliceninja.recentRuns'),
  }));
  const runs = storage.recentRuns ? JSON.parse(storage.recentRuns) : [];
  check('6 结算弹窗出现', true);
  check('6 highScore 已写入', Number(storage.highScore) > 0, storage.highScore);
  check('6 recentRuns ≥1 且 ≤10', runs.length >= 1 && runs.length <= 10, `len=${runs.length}`);
  await page.screenshot({ path: join(SHOT_DIR, '06-gameover.png') });

  // ---- 7. 刷新后大厅最高分仍在 ----
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('开始切割').waitFor({ timeout: 15000 });
  const hallText = await page.evaluate(() => document.body.textContent);
  check('7 大厅展示最高分', hallText.includes(String(Number(storage.highScore))), `highScore=${storage.highScore}`);

  // ---- 8. 删除 public/audio：合成音兜底 + 强制开始 ----
  const audioDir = join(process.cwd(), 'public', 'audio');
  const audioBak = join(process.cwd(), 'public', 'audio_bak');
  if (existsSync(audioDir)) {
    renameSync(audioDir, audioBak);
    try {
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('开始切割').click();
      await page.getByRole('button', { name: /强制开始/ }).waitFor({ timeout: 25000 });
      await page.screenshot({ path: join(SHOT_DIR, '08-forcestart.png') });
      await page.getByRole('button', { name: /强制开始/ }).click();
      await page.getByText('挥刀开始').waitFor({ timeout: 15000 });
      const box2 = await page.locator('canvas').boundingBox();
      await swipe(page, box2.x + box2.width * 0.15, box2.y + box2.height * 0.5, box2.x + box2.width * 0.85, box2.y + box2.height * 0.45);
      await page.waitForTimeout(1200);
      const pageErrorsOnly = consoleErrors.filter((e) => !e.startsWith('pageerror'));
      const jsExceptions = consoleErrors.filter((e) => e.startsWith('pageerror'));
      check('8 无音频文件时可玩（强制开始 + 挥刀）', true);
      check('8 无 JS 异常（404 资源错误可容忍）', jsExceptions.length === 0, `console 总条数=${pageErrorsOnly.length}`);
      await page.screenshot({ path: join(SHOT_DIR, '08-synth-gameplay.png') });
    } finally {
      renameSync(audioBak, audioDir);
    }
  } else {
    check('8 删除 public/audio 测试', false, '目录不存在，跳过');
  }

  // ---- 9. 窄屏（375×812）可滑切、页面不滚动 ----
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByText('开始切割').waitFor({ timeout: 15000 });
  const hallScroll = await page.evaluate(() => ({
    scrollY: window.scrollY,
    overflow: document.documentElement.scrollHeight - window.innerHeight,
  }));
  check('9 窄屏大厅无横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow=${hallScroll.overflow}px`);
  await page.screenshot({ path: join(SHOT_DIR, '09-mobile-hall.png') });
  await page.getByText('开始切割').click();
  await page.getByText('挥刀开始').waitFor({ timeout: 30000 });
  const box3 = await page.locator('canvas').boundingBox();
  await swipe(page, box3.x + box3.width * 0.12, box3.y + box3.height * 0.55, box3.x + box3.width * 0.88, box3.y + box3.height * 0.5);
  await page.waitForTimeout(300);
  const gameScroll = await page.evaluate(() => ({
    scrollY: window.scrollY,
    overflowY: document.documentElement.scrollHeight - window.innerHeight,
  }));
  check('9 窄屏游戏页不滚动', gameScroll.scrollY === 0, JSON.stringify(gameScroll));
  await page.screenshot({ path: join(SHOT_DIR, '09-mobile-game.png') });

  // ---- 10. 控制台错误汇总（1/3/9 的公共项） ----
  const realErrors = consoleErrors.filter((e) => !e.includes('Failed to load resource'));
  check('10 全程无控制台 JS 错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
} catch (err) {
  check('脚本执行中断', false, String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n==== 验收结果：${results.length - failed.length}/${results.length} 通过 ====`);
if (failed.length > 0) {
  console.log('未通过项：');
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` —— ${f.detail}` : ''}`);
  process.exit(1);
}
