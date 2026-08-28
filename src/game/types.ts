/**
 * 游戏引擎类型定义（纯 TS，不依赖 React / DOM 之外的任何库）。
 */

/** 水果种类 id，与 PRD 图像清单一致 */
export type FruitKindId =
  | 'watermelon'
  | 'apple'
  | 'orange'
  | 'banana'
  | 'kiwi'
  | 'pineapple';

/** 实体类型 */
export type EntityKind = FruitKindId | 'bomb';

/** TECH_DESIGN.md 规定的难度配置形状（数字与 PRD 表一致，见 constants.ts） */
export type RangeConfig = { base: number; perLevel: number; min?: number; max?: number };

export interface DifficultyConfig {
  spawnIntervalMs: RangeConfig;
  fruitsPerWave: {
    /** L3+ 概率双抛 */
    startDoubleLevel: number;
    /** L6+ 概率三抛 */
    startTripleLevel: number;
    doubleChance: number;
    tripleChance: number;
  };
  throwSpeed: RangeConfig;
  gravity: RangeConfig;
  bombChance: { startLevel: number; base: number; perLevel: number; max: number };
  fruitRadius: RangeConfig;
  comboWindowMs: RangeConfig;
  /** 从 level 升到 level+1 需要累计切开 base + level * perLevel 个水果 */
  fruitsToLevelUp: { base: number; perLevel: number };
  lives: number;
  bombEndsGame: boolean;
  scorePerFruit: number;
  comboBonus: number;
}

/** getDifficulty(level) 的解析结果（扁平数值，供引擎直接使用） */
export interface ResolvedDifficulty {
  level: number;
  spawnIntervalMs: number;
  /** 波次内水果数（1/2/3），由 spawner 结合概率决定实际值 */
  maxFruitsPerWave: number;
  doubleChance: number;
  tripleChance: number;
  throwSpeed: number;
  gravity: number;
  bombChance: number;
  fruitRadius: number;
  comboWindowMs: number;
  /** 从当前 level 升到下一级需要切开的水果数 */
  fruitsToLevelUp: number;
}

/** 引擎事件（UI 与音频订阅；TECH_DESIGN：slice | miss | bomb | combo | levelup | over） */
export type GameEvent =
  | { type: 'slice'; x: number; y: number; kind: FruitKindId; points: number }
  | { type: 'miss'; livesLeft: number }
  | { type: 'bomb'; x: number; y: number }
  | { type: 'combo'; count: number; bonus: number }
  | { type: 'levelup'; level: number }
  | {
      type: 'over';
      reason: 'lives' | 'bomb';
      stats: GameFinalStats;
    };

/** 结算数据 */
export interface GameFinalStats {
  score: number;
  level: number;
  bestCombo: number;
  sliced: number;
  missed: number;
}

/** HUD 快照（引擎 10Hz 节流外发，React 不得每帧 setState） */
export interface GameSnapshot {
  state: EngineState;
  score: number;
  combo: number;
  bestCombo: number;
  level: number;
  lives: number;
  sliced: number;
  missed: number;
  /** 下一级还差多少个水果 */
  fruitsToNextLevel: number;
  fps: number;
  /** fps 连续过低后引擎自动降低的粒子比例（1 → 正常） */
  particleScale: number;
}

export type EngineState = 'idle' | 'running' | 'paused' | 'over';

/** 单个游戏实体（水果 / 炸弹） */
export interface Entity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** 自转角速度（rad/s）与当前角度 */
  angle: number;
  spin: number;
  /** 是否已被切开（切开后实体移除、生成两瓣） */
  sliced: boolean;
}

/** 切开后的一瓣 */
export interface Half {
  id: number;
  kind: FruitKindId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  /** -1 左瓣 / +1 右瓣（相对切割线） */
  side: -1 | 1;
  /** 切割线相对水平面的角度（渲染分瓣用） */
  cutAngle: number;
}

/** 果汁/火花粒子 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** 剩余寿命（s） */
  life: number;
  maxLife: number;
  color: string;
}

/** 刀光轨迹点 */
export interface BladePoint {
  x: number;
  y: number;
  t: number;
}
