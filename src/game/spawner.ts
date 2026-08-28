/**
 * 出果器：按难度 spawnIntervalMs 周期生成波次（1/2/3 个水果或炸弹）。
 * 难度数字全部来自 getDifficulty(level)（禁止写死 1400 之类，AGENTS.md）。
 */
import { LOGICAL_WIDTH } from './constants';
import { getDifficulty } from './difficulty';
import { computeLaunchVelocity } from './physics';
import { pickFruitKind } from '../data/fruitKinds';
import type { EntityKind, FruitKindId, ResolvedDifficulty } from './types';

export interface SpawnRequest {
  kind: EntityKind;
  x: number;
  radius: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
}

const FIRST_WAVE_DELAY_MS = 700; // 开局后首个波次的等待时间

export class Spawner {
  private timerMs = 0;

  reset(): void {
    // 让首个波次在 ~FIRST_WAVE_DELAY_MS 后出现
    this.timerMs = getDifficulty(1).spawnIntervalMs - FIRST_WAVE_DELAY_MS;
  }

  /** 推进计时，返回本帧需要生成的实体请求（通常 0 或 1 个波次） */
  update(dtMs: number, difficulty: ResolvedDifficulty): SpawnRequest[] {
    this.timerMs += dtMs;
    const requests: SpawnRequest[] = [];
    while (this.timerMs >= difficulty.spawnIntervalMs) {
      this.timerMs -= difficulty.spawnIntervalMs;
      requests.push(...this.buildWave(difficulty));
    }
    return requests;
  }

  /** 波次构成：L3+ 概率双抛、L6+ 概率三抛；每个位置按 bombChance 判定炸弹 */
  private buildWave(d: ResolvedDifficulty): SpawnRequest[] {
    let count = 1;
    if (d.maxFruitsPerWave >= 3 && Math.random() < d.tripleChance) count = 3;
    else if (d.maxFruitsPerWave >= 2 && Math.random() < d.doubleChance) count = 2;

    const xs = waveSpawnXs(count);
    const requests: SpawnRequest[] = [];
    let bombCount = 0;
    for (let i = 0; i < count; i += 1) {
      const isBomb = Math.random() < d.bombChance;
      if (isBomb) bombCount += 1;
      const x = xs[i] ?? LOGICAL_WIDTH / 2;
      const { vx, vy } = computeLaunchVelocity(d, x);
      const radius = isBomb ? d.fruitRadius * 0.85 : d.fruitRadius;
      requests.push({
        kind: isBomb ? 'bomb' : (pickFruitKind().id as FruitKindId),
        x,
        radius,
        vx,
        vy,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * 2.4,
      });
    }
    // 保底：一刷全炸弹时把最后一个换成水果，避免不可能躲开的局面
    if (bombCount === count && count > 0) {
      const last = requests[requests.length - 1];
      if (last) {
        last.kind = pickFruitKind().id as FruitKindId;
        last.radius = d.fruitRadius;
      }
    }
    return requests;
  }
}

/** 波次内出生点：均分画布横带 + 抖动，避免全部重叠 */
function waveSpawnXs(count: number): number[] {
  const margin = 0.16 * LOGICAL_WIDTH;
  const span = LOGICAL_WIDTH - margin * 2;
  const xs: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (count === 1) {
      xs.push(margin + Math.random() * span);
    } else {
      const slot = margin + (span / (count - 1)) * i;
      xs.push(Math.min(LOGICAL_WIDTH - 60, Math.max(60, slot + (Math.random() * 2 - 1) * 70)));
    }
  }
  return xs;
}
