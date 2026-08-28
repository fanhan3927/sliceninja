/**
 * 难度纯函数：getDifficulty(level) 把 DEFAULT_DIFFICULTY 折算为当级数值。
 * 全局禁止在 spawner 等处写死难度数字（AGENTS.md）。
 */
import { DEFAULT_DIFFICULTY } from './constants';
import type { DifficultyConfig, RangeConfig, ResolvedDifficulty } from './types';

/** 折算 range：value = clamp(base + (level-1) * perLevel, min, max) */
function resolveRange(cfg: RangeConfig, level: number): number {
  const raw = cfg.base + (level - 1) * cfg.perLevel;
  if (cfg.min !== undefined) return Math.max(cfg.min, raw);
  if (cfg.max !== undefined) return Math.min(cfg.max, raw);
  return raw;
}

/**
 * 解析指定 Level 的运行时难度。
 *
 * 期望值核对（Level 5）：
 * - spawnIntervalMs = 1400 + 4*(-80) = 1080
 * - throwSpeed      = 7.2  + 4*0.35  = 8.6
 * - gravity         = 0.18 + 4*0.012 = 0.228
 * - bombChance      = 0.08 + (5-2)*0.035 = 0.185
 * - fruitRadius     = 42   - 4*1.2   = 37.2
 * - comboWindowMs   = 900  - 4*30    = 780
 */
export function getDifficulty(level: number): ResolvedDifficulty {
  const d: DifficultyConfig = DEFAULT_DIFFICULTY;
  const lv = Math.max(1, Math.floor(level));
  return {
    level: lv,
    spawnIntervalMs: resolveRange(d.spawnIntervalMs, lv),
    maxFruitsPerWave: lv >= d.fruitsPerWave.startTripleLevel ? 3 : lv >= d.fruitsPerWave.startDoubleLevel ? 2 : 1,
    doubleChance: d.fruitsPerWave.doubleChance,
    tripleChance: d.fruitsPerWave.tripleChance,
    throwSpeed: resolveRange(d.throwSpeed, lv),
    gravity: resolveRange(d.gravity, lv),
    bombChance: lv < d.bombChance.startLevel ? 0 : Math.min(d.bombChance.max, d.bombChance.base + (lv - d.bombChance.startLevel) * d.bombChance.perLevel),
    fruitRadius: resolveRange(d.fruitRadius, lv),
    comboWindowMs: resolveRange(d.comboWindowMs, lv),
    fruitsToLevelUp: d.fruitsToLevelUp.base + lv * d.fruitsToLevelUp.perLevel,
  };
}

/**
 * 升级阈值用前缀和实现（PRD：避免循环定义）。
 * 从 level L 升到 L+1 需要 fruitsToLevelUp(L) = base + L * perLevel 个水果；
 * 到达 level N 的累计切开数 = Σ_{L=1}^{N-1} fruitsToLevelUp(L) = (N-1)(N+8)。
 * sliceCountForLevel(1) = 0，sliceCountForLevel(2) = 10，
 * sliceCountForLevel(3) = 22，sliceCountForLevel(4) = 36 …
 */
export function cumulativeSlicedForLevel(level: number): number {
  const { base, perLevel } = DEFAULT_DIFFICULTY.fruitsToLevelUp;
  let total = 0;
  for (let lv = 1; lv < level; lv += 1) {
    total += base + lv * perLevel;
  }
  return total;
}

// 模块加载断言（PROMPTS 步骤 2）：Level 1 出果间隔 1400ms 且无炸弹。
// eslint-disable-next-line no-console
console.assert(
  getDifficulty(1).spawnIntervalMs === 1400 && getDifficulty(1).bombChance === 0,
  '[SliceNinja] Level 1 难度断言失败：spawnIntervalMs 应为 1400、bombChance 应为 0',
);
