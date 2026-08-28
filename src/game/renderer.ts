/**
 * Canvas 2D 渲染器：逻辑坐标 1280×720，等比 letterbox 缩放。
 * 每帧顺序：背景 → 分瓣 → 实体（水果/炸弹）→ 粒子 → 刀光。
 * 图片缺失时逐层降级为程序化绘制，保证任何环境可玩。
 */
import { BLADE_FADE_MS, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './constants';
import { fruitKindById } from '../data/fruitKinds';
import type { BladeTrail } from './blade';
import type { GameWorld } from './world';
import type { Entity, FruitKindId, Half } from './types';

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  view: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private vignette: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
  }

  /** 背板尺寸变化时重算 letterbox 变换 */
  resize(backWidth: number, backHeight: number): void {
    const scale = Math.min(backWidth / LOGICAL_WIDTH, backHeight / LOGICAL_HEIGHT);
    this.view = {
      scale,
      offsetX: (backWidth - LOGICAL_WIDTH * scale) / 2,
      offsetY: (backHeight - LOGICAL_HEIGHT * scale) / 2,
    };
    this.vignette = null;
  }

  render(
    world: GameWorld,
    blade: BladeTrail,
    images: ReadonlyMap<string, HTMLImageElement>,
    nowMs: number,
  ): void {
    const { ctx } = this;
    const canvas = ctx.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0604';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { scale, offsetX, offsetY } = this.view;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.clip();

    this.drawBackground(images);
    for (const half of world.halves) this.drawHalf(half, images);
    for (const bomb of world.bombs) this.drawEntity(bomb, images, nowMs);
    for (const fruit of world.fruits) this.drawEntity(fruit, images, nowMs);
    this.drawParticles(world);
    this.drawBlade(blade, nowMs);

    ctx.restore();
  }

  // ---------- 背景 ----------

  private drawBackground(images: ReadonlyMap<string, HTMLImageElement>): void {
    const { ctx } = this;
    const bg = images.get('dojo-bg');
    if (bg && bg.complete && bg.naturalWidth > 0) {
      ctx.drawImage(bg, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
      grad.addColorStop(0, '#2a1a12');
      grad.addColorStop(0.55, '#1c110b');
      grad.addColorStop(1, '#120a06');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    if (!this.vignette) {
      const v = ctx.createRadialGradient(640, 320, 180, 640, 380, 760);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.52)');
      this.vignette = v;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  // ---------- 实体 ----------

  private drawEntity(
    entity: Entity,
    images: ReadonlyMap<string, HTMLImageElement>,
    nowMs: number,
  ): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity.angle);
    if (entity.kind === 'bomb') {
      const img = images.get('bomb');
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -entity.radius, -entity.radius, entity.radius * 2, entity.radius * 2);
      } else {
        this.drawProceduralSphere('#262b33', '#0c0e12', entity.radius);
      }
      // 危险警示环（呼吸闪烁）
      const pulse = 0.4 + 0.3 * Math.sin(nowMs / 130);
      ctx.strokeStyle = hexToRgba('#ff3b3b', pulse);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, entity.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const img = images.get(entity.kind);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -entity.radius, -entity.radius, entity.radius * 2, entity.radius * 2);
      } else {
        this.drawProceduralFruit(entity.kind, entity.radius);
      }
    }
    ctx.restore();
  }

  private drawProceduralSphere(light: string, dark: string, radius: number): void {
    const { ctx } = this;
    const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.35, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, light);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 程序化水果：按种类上色的圆形 + 细节（无图片时的兜底） */
  private drawProceduralFruit(kind: FruitKindId, radius: number): void {
    const { ctx } = this;
    const info = fruitKindById(kind);
    this.drawProceduralSphere(info.rind, info.rindDark, radius);
    // 顶部高光
    ctx.fillStyle = 'rgba(255,247,232,0.35)';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.32, -radius * 0.38, radius * 0.28, radius * 0.16, -0.6, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'watermelon') {
      ctx.strokeStyle = hexToRgba(info.rindDark, 0.85);
      ctx.lineWidth = radius * 0.14;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 0.9, Math.sin(a) * radius * 0.9);
        ctx.quadraticCurveTo(0, 0, Math.cos(a + 1.4) * radius * 0.9, Math.sin(a + 1.4) * radius * 0.9);
        ctx.stroke();
      }
    } else if (kind === 'apple' || kind === 'pineapple') {
      ctx.fillStyle = '#2f9e44';
      ctx.beginPath();
      ctx.ellipse(radius * 0.12, -radius * 0.95, radius * 0.3, radius * 0.13, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- 分瓣 ----------

  private drawHalf(half: Half, images: ReadonlyMap<string, HTMLImageElement>): void {
    const { ctx } = this;
    const info = fruitKindById(half.kind);
    ctx.save();
    ctx.translate(half.x, half.y);
    ctx.rotate(half.angle);
    const r = half.radius + 2;
    ctx.beginPath();
    if (half.side === -1) ctx.rect(-r, -r * 2, r * 2, r * 2);
    else ctx.rect(-r, 0, r * 2, r * 2);
    ctx.clip();
    const img = images.get(half.kind);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -half.radius, -half.radius, half.radius * 2, half.radius * 2);
    } else {
      this.drawProceduralFruit(half.kind, half.radius);
    }
    // 切面：果肉色薄边
    ctx.fillStyle = hexToRgba(info.flesh, 0.95);
    ctx.fillRect(-half.radius, half.side === -1 ? -1.2 : -0.4, half.radius * 2, 1.6);
    ctx.restore();
  }

  // ---------- 粒子 ----------

  private drawParticles(world: GameWorld): void {
    const { ctx } = this;
    for (const p of world.particles.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = hexToRgba(p.color.startsWith('#') ? p.color : '#ff6b3d', alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- 刀光 ----------

  /** 金色刀光：三遍描边（宽发光 → 暖金 → 白芯），逐段按年龄渐隐 */
  private drawBlade(blade: BladeTrail, nowMs: number): void {
    const { ctx } = this;
    const pts = blade.trailPoints(nowMs);
    if (pts.length < 2) return;
    const passes: ReadonlyArray<readonly [number, string, number]> = [
      [18, '#e8c36a', 0.2],
      [8, '#ffdf8e', 0.45],
      [3.2, '#fff7e8', 0.95],
    ];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [width, color, alphaBase] of passes) {
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        if (!a || !b) continue;
        const fade = Math.max(0, 1 - (nowMs - b.t) / BLADE_FADE_MS);
        if (fade <= 0) continue;
        ctx.strokeStyle = hexToRgba(color, alphaBase * fade);
        ctx.lineWidth = width * (0.35 + 0.65 * fade);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
}
