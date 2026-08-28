/**
 * 游戏世界：实体工厂 + 实体容器 + 切割/漏接处理。
 * 只做数据与机制，不做 React、不做音效（由 engine 订阅编排）。
 */
import { DEFAULT_DIFFICULTY, LOGICAL_HEIGHT, JUICE_PER_SLICE } from './constants';
import { ParticleSystem } from './particles';
import { fruitKindById } from '../data/fruitKinds';
import { isBelowScreen, segmentIntersectsCircle, stepProjectile } from './physics';
import type { BladeSegment } from './blade';
import type { SpawnRequest } from './spawner';
import type { Entity, FruitKindId, Half } from './types';

export interface SliceHit {
  kind: EntityKind;
  /** 命中点（事件与粒子用） */
  x: number;
  y: number;
  radius: number;
  cutAngle: number;
}

type EntityKind = Entity['kind'];

let nextId = 1;

/** 实体工厂：水果 */
export function createFruit(
  kind: FruitKindId,
  x: number,
  radius: number,
  vx: number,
  vy: number,
  angle: number,
  spin: number,
): Entity {
  return {
    id: nextId++,
    kind,
    x,
    y: LOGICAL_HEIGHT + radius + 10, // 底部屏外出生
    vx,
    vy,
    radius,
    angle,
    spin,
    sliced: false,
  };
}

/** 实体工厂：炸弹（同抛物线，半径略小） */
export function createBomb(
  x: number,
  radius: number,
  vx: number,
  vy: number,
  angle: number,
  spin: number,
): Entity {
  return {
    id: nextId++,
    kind: 'bomb',
    x,
    y: LOGICAL_HEIGHT + radius + 10,
    vx,
    vy,
    radius,
    angle,
    spin,
    sliced: false,
  };
}

export class GameWorld {
  fruits: Entity[] = [];
  bombs: Entity[] = [];
  halves: Half[] = [];
  particles = new ParticleSystem();

  level = 1;
  lives = DEFAULT_DIFFICULTY.lives;
  slicedCount = 0;
  missedCount = 0;

  reset(): void {
    this.fruits = [];
    this.bombs = [];
    this.halves = [];
    this.particles.clear();
    this.level = 1;
    this.lives = DEFAULT_DIFFICULTY.lives;
    this.slicedCount = 0;
    this.missedCount = 0;
  }

  spawn(requests: SpawnRequest[]): void {
    for (const r of requests) {
      if (r.kind === 'bomb') {
        this.bombs.push(createBomb(r.x, r.radius, r.vx, r.vy, r.angle, r.spin));
      } else {
        this.fruits.push(createFruit(r.kind, r.x, r.radius, r.vx, r.vy, r.angle, r.spin));
      }
    }
  }

  /**
   * 物理推进（水果/炸弹/分瓣/粒子），并做出界清理。
   * 返回本帧漏接的水果（炸弹出界不惩罚，直接消失；分瓣出界直接移除）。
   */
  step(dtSec: number, gravity: number): Entity[] {
    const missed: Entity[] = [];
    for (let i = this.fruits.length - 1; i >= 0; i -= 1) {
      const fruit = this.fruits[i];
      if (!fruit) continue;
      stepProjectile(fruit, dtSec, gravity);
      if (isBelowScreen(fruit.x, fruit.y, fruit.radius)) {
        this.fruits.splice(i, 1);
        missed.push(fruit);
      }
    }
    for (let i = this.bombs.length - 1; i >= 0; i -= 1) {
      const bomb = this.bombs[i];
      if (!bomb) continue;
      stepProjectile(bomb, dtSec, gravity);
      if (isBelowScreen(bomb.x, bomb.y, bomb.radius)) this.bombs.splice(i, 1);
    }
    for (let i = this.halves.length - 1; i >= 0; i -= 1) {
      const half = this.halves[i];
      if (!half) continue;
      stepProjectile(half, dtSec, gravity);
      if (isBelowScreen(half.x, half.y, half.radius)) this.halves.splice(i, 1);
    }
    this.particles.update(dtSec);
    return missed;
  }

  /**
   * 切割判定：对每个实体测试活跃刀光折线，命中即切开（水果生成两瓣 + 果汁）。
   * 返回命中的实体列表（engine 负责计分/音效/事件）。
   */
  processSlices(segments: BladeSegment[]): SliceHit[] {
    if (segments.length === 0) return [];
    const hits: SliceHit[] = [];
    hits.push(...this.sliceList(this.fruits, segments, true));
    hits.push(...this.sliceList(this.bombs, segments, false));
    return hits;
  }

  private sliceList(list: Entity[], segments: BladeSegment[], isFruit: boolean): SliceHit[] {
    const hits: SliceHit[] = [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const entity = list[i];
      if (!entity) continue;
      for (const seg of segments) {
        if (!segmentIntersectsCircle(seg.x1, seg.y1, seg.x2, seg.y2, entity.x, entity.y, entity.radius)) continue;
        hits.push({
          kind: entity.kind,
          x: entity.x,
          y: entity.y,
          radius: entity.radius,
          cutAngle: seg.angle,
        });
        if (isFruit) {
          this.splitFruit(entity, seg.angle);
        } else {
          this.particles.burstExplosion(entity.x, entity.y);
        }
        list.splice(i, 1);
        break; // 同一实体只被一条线段切开
      }
    }
    return hits;
  }

  /** 切开分瓣：沿切割线法线向两侧推开 + 果汁粒子（切开音效由 engine 播放） */
  private splitFruit(fruit: Entity, cutAngle: number): void {
    const kind = fruitKindById(fruit.kind as FruitKindId);
    this.particles.burstJuice(fruit.x, fruit.y, kind.juice, JUICE_PER_SLICE);
    const nx = -Math.sin(cutAngle);
    const ny = Math.cos(cutAngle);
    for (const side of [-1, 1] as const) {
      const push = 110 + Math.random() * 130;
      this.halves.push({
        id: nextId++,
        kind: fruit.kind as FruitKindId,
        x: fruit.x + nx * side * fruit.radius * 0.25,
        y: fruit.y + ny * side * fruit.radius * 0.25,
        vx: fruit.vx + nx * side * push + (Math.random() * 2 - 1) * 40,
        vy: fruit.vy + ny * side * push - 60,
        radius: fruit.radius,
        angle: cutAngle,
        spin: (Math.random() * 2 - 1) * 5 + side * 2,
        side,
        cutAngle,
      });
    }
  }
}
