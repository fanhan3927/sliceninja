/**
 * 全局共享类型（React 层使用）。
 * 游戏引擎内部类型见 src/game/types.ts。
 */

/** 应用/游戏页状态机阶段 */
export type Phase = 'hall' | 'loading' | 'playing' | 'paused' | 'over';

/** 音频偏好（持久化到 sliceninja.settings） */
export interface AudioSettings {
  bgmMuted: boolean;
  sfxMuted: boolean;
}

/** 单局结算战绩（持久化到 sliceninja.recentRuns） */
export interface RunRecord {
  /** 结束时间戳（ms） */
  endedAt: number;
  score: number;
  level: number;
  bestCombo: number;
  sliced: number;
  missed: number;
}

/** 加载进度（图片 x/y · 音频 x/y） */
export interface LoadProgress {
  imagesLoaded: number;
  imagesTotal: number;
  audioLoaded: number;
  audioTotal: number;
  /** 至少一个资源彻底失败（可提供「强制开始」） */
  hasFailure: boolean;
  done: boolean;
}
