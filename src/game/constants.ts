/**
 * 全部数值的唯一来源（AGENTS.md：难度数字只来自 constants.ts + getDifficulty）。
 * DEFAULT_DIFFICULTY 各项与 PRD「动态难度」表一字不差。
 */
import type { DifficultyConfig } from './types';

/** 逻辑画布分辨率（PRD：1280×720 居中缩放） */
export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

/**
 * 物理单位换算（px/s）：
 * throwSpeed 7.2 → 7.2 * 128 ≈ 922 px/s 初速，配合 gravity 0.18 * 3944 ≈ 710 px/s²
 * 得到约 600px 抛物线顶点、约 2.6s 滞空（见 physics.ts 推导注释）。
 */
export const THROW_SPEED_PX_PER_UNIT = 128;
export const GRAVITY_PX_PER_UNIT_SQ = 3944;

/** 刀光判定（TECH_DESIGN：80ms 内位移 > 18px 才算挥砍；折线取最近 6–10 点） */
export const BLADE_WINDOW_MS = 80;
export const BLADE_MIN_SWIPE_DISTANCE = 18;
export const BLADE_MAX_POINTS = 10;
/** 轨迹渲染淡出时长（ms） */
export const BLADE_FADE_MS = 160;

/** 每帧 dt 上限（TECH_DESIGN：dt clamp 33ms） */
export const DT_CLAMP_MS = 33;

/** 粒子上限（TECH_DESIGN：粒子上限 120） */
export const PARTICLE_LIMIT = 120;
/** 单次切开生成的果汁粒子基准数 */
export const JUICE_PER_SLICE = 14;
/** fps 连续 2s < 45 时降低粒子 */
export const LOW_FPS_THRESHOLD = 45;
export const LOW_FPS_WINDOW_MS = 2000;

/** 命中停顿（PRD：切开 20–40ms hit-stop） */
export const HIT_STOP_MS = 28;

/** localStorage 键（PRD 第 5 节，一字不差） */
export const STORAGE_KEYS = {
  highScore: 'sliceninja.highScore',
  bestCombo: 'sliceninja.bestCombo',
  settings: 'sliceninja.settings',
  recentRuns: 'sliceninja.recentRuns',
} as const;

/** 最近战绩保留局数 */
export const MAX_RECENT_RUNS = 10;

/**
 * 默认难度表（与 PRD「动态难度」逐项对应）：
 * - spawnIntervalMs：1400，每级 -80，下限 420
 * - fruitsPerWave：L3+ 概率双抛，L6+ 概率三抛
 * - throwSpeed：7.2，每级 +0.35，上限 14
 * - gravity：0.18，每级 +0.012，上限 0.38
 * - bombChance：L1 = 0，L2 = 0.08，之后每级 +0.035，上限 0.32
 * - fruitRadius：42，每级 -1.2，下限 28
 * - comboWindowMs：900，每级 -30，下限 480
 * - 升级：累计切开 8 + Level * 2 个水果（前缀和阈值，见 difficulty.ts）
 */
export const DEFAULT_DIFFICULTY: DifficultyConfig = {
  spawnIntervalMs: { base: 1400, perLevel: -80, min: 420 },
  fruitsPerWave: {
    startDoubleLevel: 3,
    startTripleLevel: 6,
    // 双抛/三抛概率 PRD 未定值，此处给定并仅从本文件读取
    doubleChance: 0.35,
    tripleChance: 0.3,
  },
  throwSpeed: { base: 7.2, perLevel: 0.35, max: 14 },
  gravity: { base: 0.18, perLevel: 0.012, max: 0.38 },
  bombChance: { startLevel: 2, base: 0.08, perLevel: 0.035, max: 0.32 },
  fruitRadius: { base: 42, perLevel: -1.2, min: 28 },
  comboWindowMs: { base: 900, perLevel: -30, min: 480 },
  fruitsToLevelUp: { base: 8, perLevel: 2 },
  lives: 3,
  bombEndsGame: true,
  scorePerFruit: 1,
  // 连击奖励：爆发结束后 bonus = 连击个数 * comboBonus
  comboBonus: 3,
} as const;
