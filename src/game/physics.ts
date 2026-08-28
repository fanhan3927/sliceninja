/**
 * 物理模块：抛射运动、切割几何（折线切圆）。
 * 坐标系：逻辑画布 1280×720，y 向下，单位 px/s。
 */
import { GRAVITY_PX_PER_UNIT_SQ, LOGICAL_HEIGHT, LOGICAL_WIDTH, THROW_SPEED_PX_PER_UNIT } from './constants';
import type { ResolvedDifficulty } from './types';

/** 难度 gravity 值 → 像素加速度（px/s²） */
export function gravityPx(difficulty: ResolvedDifficulty): number {
  return difficulty.gravity * GRAVITY_PX_PER_UNIT_SQ;
}

/**
 * 切割几何核心：线段与圆相交判定。
 * 求圆心到线段最近点的距离，距离 <= 半径即相交（含端点情形）。
 */
export function segmentIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const ex = cx - px;
  const ey = cy - py;
  return ex * ex + ey * ey <= radius * radius;
}

/**
 * 抛射初速换算（抛物线推导）：
 *   vy0 = throwSpeed * THROW_SPEED_PX_PER_UNIT（px/s，向上为负）
 *   g   = gravity * GRAVITY_PX_PER_UNIT_SQ（px/s²）
 *   顶点高 h = vy0² / (2g)，滞空 t = 2 * vy0 / g。
 *   L1 默认值：vy0 ≈ 922px/s，g ≈ 710px/s² → h ≈ 599px、t ≈ 2.6s，
 *   即从底部（y≈770）抛出可达 y≈170，覆盖画布约 83% 高度后落回屏外。
 */
export function computeLaunchVelocity(
  difficulty: ResolvedDifficulty,
  fromX: number,
): { vx: number; vy: number } {
  const vy = -difficulty.throwSpeed * THROW_SPEED_PX_PER_UNIT * (0.95 + Math.random() * 0.1);
  // 水平速度：朝画布中轴漂移，叠加 ±90px/s 随机扰动，保证弧线多样且不贴边
  const toCenter = LOGICAL_WIDTH / 2 - fromX;
  const vx = toCenter * 0.06 + (Math.random() * 2 - 1) * 90;
  return { vx, vy };
}

/** 半隐式欧拉积分一步：先更新速度再更新位置（更稳定的抛物线） */
export function stepProjectile(
  body: { x: number; y: number; vx: number; vy: number; angle: number; spin: number },
  dtSec: number,
  gravity: number,
): void {
  body.vy += gravity * dtSec;
  body.x += body.vx * dtSec;
  body.y += body.vy * dtSec;
  body.angle += body.spin * dtSec;
}

/** 实体是否已落出屏幕底部（含半径缓冲） */
export function isBelowScreen(x: number, y: number, radius: number): boolean {
  void x;
  return y - radius > LOGICAL_HEIGHT + radius + 40;
}
