/**
 * 本机战绩与音频偏好的 localStorage 封装。
 * 键名（PRD 第 5 节）：sliceninja.highScore / sliceninja.bestCombo / sliceninja.settings / sliceninja.recentRuns。
 * 只在结算/用户改设置时写盘（AGENTS.md：游戏过程中不频繁写盘）。
 */
import { useCallback, useState } from 'react';
import { MAX_RECENT_RUNS, STORAGE_KEYS } from '../game/constants';
import type { AudioSettings, RunRecord } from '../types';

export interface GameFinalStatsInput {
  score: number;
  level: number;
  bestCombo: number;
  sliced: number;
  missed: number;
}

export interface LocalStats {
  highScore: number;
  bestCombo: number;
  recentRuns: RunRecord[];
}

export interface ApplyRunResult {
  stats: LocalStats;
  isNewHighScore: boolean;
  isNewBestCombo: boolean;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式等写入失败时静默降级 */
  }
}

function readNumber(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return 0;
    const n = Number(JSON.parse(raw));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function loadLocalStats(): LocalStats {
  return {
    highScore: readNumber(STORAGE_KEYS.highScore),
    bestCombo: readNumber(STORAGE_KEYS.bestCombo),
    recentRuns: readJson<RunRecord[]>(STORAGE_KEYS.recentRuns, []).slice(0, MAX_RECENT_RUNS),
  };
}

/** 结算写盘：更新最高分/最高连击/最近战绩（最多 10 局），返回是否破纪录。 */
export function applyRunResult(run: GameFinalStatsInput): ApplyRunResult {
  const prev = loadLocalStats();
  const isNewHighScore = run.score > prev.highScore;
  const isNewBestCombo = run.bestCombo > prev.bestCombo;
  const record: RunRecord = { endedAt: Date.now(), ...run };
  const next: LocalStats = {
    highScore: Math.max(prev.highScore, run.score),
    bestCombo: Math.max(prev.bestCombo, run.bestCombo),
    recentRuns: [record, ...prev.recentRuns].slice(0, MAX_RECENT_RUNS),
  };
  writeJson(STORAGE_KEYS.highScore, next.highScore);
  writeJson(STORAGE_KEYS.bestCombo, next.bestCombo);
  writeJson(STORAGE_KEYS.recentRuns, next.recentRuns);
  return { stats: next, isNewHighScore, isNewBestCombo };
}

export function loadAudioSettings(): AudioSettings {
  return readJson<AudioSettings>(STORAGE_KEYS.settings, { bgmMuted: false, sfxMuted: false });
}

export function saveAudioSettings(settings: AudioSettings): void {
  writeJson(STORAGE_KEYS.settings, settings);
}

/** React 绑定：本机战绩（大厅展示 + 结算回写） */
export function useLocalStats(): {
  stats: LocalStats;
  applyRun: (run: GameFinalStatsInput) => ApplyRunResult;
} {
  const [stats, setStats] = useState<LocalStats>(loadLocalStats);
  const applyRun = useCallback((run: GameFinalStatsInput): ApplyRunResult => {
    const result = applyRunResult(run);
    setStats(result.stats);
    return result;
  }, []);
  return { stats, applyRun };
}

const DEFAULT_SETTINGS: AudioSettings = { bgmMuted: false, sfxMuted: false };

/** React 绑定：音频偏好（大厅设置面板 + HUD 静音共用，写入 sliceninja.settings） */
export function useAudioSettings(): {
  settings: AudioSettings;
  update: (patch: Partial<AudioSettings>) => void;
  toggleMasterMute: () => void;
} {
  const [settings, setSettings] = useState<AudioSettings>(() => {
    const loaded = loadAudioSettings();
    return { ...DEFAULT_SETTINGS, ...loaded };
  });
  const update = useCallback((patch: Partial<AudioSettings>): void => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAudioSettings(next);
      return next;
    });
  }, []);
  const toggleMasterMute = useCallback((): void => {
    setSettings((prev) => {
      const allMuted = prev.bgmMuted && prev.sfxMuted;
      const next: AudioSettings = allMuted ? { bgmMuted: false, sfxMuted: false } : { bgmMuted: true, sfxMuted: true };
      saveAudioSettings(next);
      return next;
    });
  }, []);
  return { settings, update, toggleMasterMute };
}
