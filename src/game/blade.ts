/**
 * 刀光轨迹：记录最近指针点，提供
 *  1) activeSegments —— 满足「80ms 窗口内位移 > 18px」的挥砍折线（切割判定输入）；
 *  2) trailPoints    —— 渲染用的渐隐轨迹点。
 */
import { BLADE_FADE_MS, BLADE_MAX_POINTS, BLADE_MIN_SWIPE_DISTANCE, BLADE_WINDOW_MS } from './constants';
import type { BladePoint } from './types';

export interface BladeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 切割线方向角（rad），用于分瓣飞开方向 */
  angle: number;
}

const TRAIL_KEEP_MS = Math.max(BLADE_FADE_MS, BLADE_WINDOW_MS * 2);

export class BladeTrail {
  private points: BladePoint[] = [];

  reset(): void {
    this.points = [];
  }

  add(x: number, y: number, tMs: number): void {
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 1.5 && tMs - last.t < 24) return; // 去抖
    this.points.push({ x, y, t: tMs });
    if (this.points.length > BLADE_MAX_POINTS) {
      this.points.splice(0, this.points.length - BLADE_MAX_POINTS);
    }
  }

  /** 丢弃过旧点，避免悬停后突然挥动误判 */
  prune(nowMs: number): void {
    while (this.points.length > 0) {
      const first = this.points[0];
      if (first && nowMs - first.t > TRAIL_KEEP_MS) this.points.shift();
      else break;
    }
  }

  /**
   * 活跃切割折线：取最近 BLADE_WINDOW_MS 内的点，
   * 整段窗口位移 > BLADE_MIN_SWIPE_DISTANCE 才视为一次挥砍（TECH_DESIGN 阈值）。
   */
  activeSegments(nowMs: number): BladeSegment[] {
    this.prune(nowMs);
    const recent = this.points.filter((p) => nowMs - p.t <= BLADE_WINDOW_MS);
    if (recent.length < 2) return [];
    const first = recent[0];
    const last = recent[recent.length - 1];
    if (!first || !last) return [];
    if (Math.hypot(last.x - first.x, last.y - first.y) <= BLADE_MIN_SWIPE_DISTANCE) return [];
    const segments: BladeSegment[] = [];
    for (let i = 1; i < recent.length; i += 1) {
      const a = recent[i - 1];
      const b = recent[i];
      if (!a || !b) continue;
      segments.push({
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      });
    }
    return segments;
  }

  /** 渲染轨迹点（含渐隐窗口内的全部点） */
  trailPoints(nowMs: number): BladePoint[] {
    this.prune(nowMs);
    return this.points.filter((p) => nowMs - p.t <= BLADE_FADE_MS);
  }
}
