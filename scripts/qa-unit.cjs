/**
 * qa-unit.cjs —— 纯函数单测（由 qa-unit.mjs 用 esbuild 打包后运行）。
 * 覆盖：切割几何（折线切圆）、刀光速度阈值、难度表数值、升级前缀和、连击计分。
 */
const assert = require('node:assert');
const { segmentIntersectsCircle, computeLaunchVelocity } = require('./.qa-tmp/physics.cjs');
const { BladeTrail } = require('./.qa-tmp/blade.cjs');
const { getDifficulty, cumulativeSlicedForLevel } = require('./.qa-tmp/difficulty.cjs');
const { Scoring } = require('./.qa-tmp/scoring.cjs');

let passed = 0;
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const t = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
};

// ---- 切割几何：线段 vs 圆 ----
t('线段穿过圆心 → 命中', () => assert.ok(segmentIntersectsCircle(0, 360, 1280, 360, 640, 360, 42)));
t('线段从圆边缘掠过（距离 < r）→ 命中', () =>
  assert.ok(segmentIntersectsCircle(0, 360, 1280, 360, 640, 395, 42)));
t('线段远离圆 → 未命中', () => assert.ok(!segmentIntersectsCircle(0, 360, 1280, 360, 640, 520, 42)));
t('短线段端点接触圆 → 命中', () => assert.ok(segmentIntersectsCircle(600, 360, 630, 360, 660, 360, 42)));
t('斜线切圆 → 命中', () => assert.ok(segmentIntersectsCircle(500, 200, 800, 500, 640, 340, 42)));

// ---- 刀光阈值：80ms 内位移 > 18px ----
t('快速挥砍 → 产生活跃切割段', () => {
  const blade = new BladeTrail();
  const t0 = 1000;
  for (let i = 0; i < 8; i += 1) blade.add(100 + i * 60, 360, t0 + i * 10); // 480px / 80ms
  const segs = blade.activeSegments(t0 + 70);
  assert.ok(segs.length >= 6, `segments=${segs.length}`);
  assert.ok(Math.abs(segs[0].angle) < 0.01, '切割线角度应接近水平');
});
t('缓慢拖动（80ms 内 < 18px）→ 不判定为挥砍', () => {
  const blade = new BladeTrail();
  const t0 = 1000;
  for (let i = 0; i < 8; i += 1) blade.add(100 + i * 2, 360, t0 + i * 10); // 14px / 80ms
  assert.strictEqual(blade.activeSegments(t0 + 70).length, 0);
});
t('旧点被剪枝，不参与判定', () => {
  const blade = new BladeTrail();
  blade.add(100, 360, 0);
  blade.add(500, 360, 50);
  assert.strictEqual(blade.activeSegments(3000).length, 0); // 全部点已过期
});

// ---- 难度表（PRD 数值） ----
t('Level 1：spawnIntervalMs=1400、bombChance=0（PROMPT 断言）', () => {
  const d1 = getDifficulty(1);
  assert.strictEqual(d1.spawnIntervalMs, 1400);
  assert.strictEqual(d1.bombChance, 0);
  assert.strictEqual(d1.throwSpeed, 7.2);
  assert.strictEqual(d1.gravity, 0.18);
  assert.strictEqual(d1.fruitRadius, 42);
  assert.strictEqual(d1.comboWindowMs, 900);
});
t('Level 5：间隔 1080 / 速度 8.6 / 重力 0.228 / 炸弹率 0.185 / 半径 37.2 / 窗口 780', () => {
  const d5 = getDifficulty(5);
  assert.strictEqual(d5.spawnIntervalMs, 1080);
  assert.strictEqual(d5.throwSpeed, 8.6);
  assert.ok(approx(d5.gravity, 0.228), `gravity=${d5.gravity}`);
  assert.ok(approx(d5.bombChance, 0.185), `bombChance=${d5.bombChance}`);
  assert.ok(approx(d5.fruitRadius, 37.2), `fruitRadius=${d5.fruitRadius}`);
  assert.strictEqual(d5.comboWindowMs, 780);
});
t('Level 2 起出现炸弹：bombChance=0.08', () => assert.strictEqual(getDifficulty(2).bombChance, 0.08));
t('高等级触底/封顶：间隔 420、速度 14、重力 0.38、炸弹率 0.32、半径 28、窗口 480', () => {
  const d = getDifficulty(50);
  assert.strictEqual(d.spawnIntervalMs, 420);
  assert.strictEqual(d.throwSpeed, 14);
  assert.strictEqual(d.gravity, 0.38);
  assert.strictEqual(d.bombChance, 0.32);
  assert.strictEqual(d.fruitRadius, 28);
  assert.strictEqual(d.comboWindowMs, 480);
});
t('升级前缀和：到 L2 累计 10、L3 22、L4 36', () => {
  assert.strictEqual(cumulativeSlicedForLevel(2), 10);
  assert.strictEqual(cumulativeSlicedForLevel(3), 22);
  assert.strictEqual(cumulativeSlicedForLevel(4), 36);
});

// ---- 抛射初速换算 ----
t('抛射初速：vy ≈ -throwSpeed*128（±5% 抖动），朝中轴漂移', () => {
  const d = getDifficulty(1);
  const v = computeLaunchVelocity(d, 200); // 左侧出生 → vx 应为正（向中轴）
  assert.ok(v.vy <= -7.2 * 128 * 0.95 && v.vy >= -7.2 * 128 * 1.05, `vy=${v.vy}`);
  assert.ok(v.vx > -200 && v.vx < 320, `vx=${v.vx}`);
});

// ---- 连击计分 ----
t('窗口内 3 连击 → 奖分 3*comboBonus，HUD 连击数=3', () => {
  const s = new Scoring();
  const r1 = s.registerSlice(1000, 900, 3);
  const r2 = s.registerSlice(1200, 900, 3);
  const r3 = s.registerSlice(1400, 900, 3);
  assert.strictEqual(r1, null);
  assert.strictEqual(r2, null);
  assert.ok(r3 && r3.count === 3 && r3.bonus === 9, JSON.stringify(r3));
  assert.strictEqual(s.score, 9);
  assert.strictEqual(s.activeCount(1500, 900), 3);
});
t('窗口过期后连击归零；第 4 切只加增量奖分', () => {
  const s = new Scoring();
  s.registerSlice(1000, 900, 3);
  s.registerSlice(1200, 900, 3);
  const r3 = s.registerSlice(1400, 900, 3);
  assert.ok(r3 && r3.count === 3);
  const r4 = s.registerSlice(1600, 900, 3); // 同窗口第 4 个
  assert.ok(r4 && r4.count === 4 && r4.bonus === 3, JSON.stringify(r4));
  assert.strictEqual(s.score, 12); // 9 + 3
  assert.strictEqual(s.activeCount(3000, 900), 0);
  assert.strictEqual(s.bestCombo, 4);
});

console.log(`\n==== 单测结果：${passed} 项全部通过 ====`);
