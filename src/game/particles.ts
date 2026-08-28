/**
 * 果汁 / 爆炸粒子。上限由 engine 按帧率动态调整（粒子上限 120，低 fps 减半再减半）。
 */
import type { Particle } from './types';

const JUICE_GRAVITY = 900; // px/s²，果汁比水果本体下坠更快更“水”

export class ParticleSystem {
  particles: Particle[] = [];

  clear(): void {
    this.particles = [];
  }

  /** 切开水果时的果汁飞溅 */
  burstJuice(x: number, y: number, color: string, count: number, scale = 1): void {
    const n = Math.max(2, Math.round(count * scale));
    for (let i = 0; i < n; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 260;
      const life = 0.35 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        radius: 2 + Math.random() * 3.5 * (0.7 + scale * 0.5),
        life,
        maxLife: life,
        color,
      });
    }
  }

  /** 炸弹爆炸：红/橙/白混合 + 更高初速 */
  burstExplosion(x: number, y: number, scale = 1): void {
    const colors = ['#ff3b3b', '#ff6b3d', '#ffb74f', '#fff7e8'];
    const n = Math.max(8, Math.round(30 * scale));
    for (let i = 0; i < n; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 420;
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 4.5,
        life,
        maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)] ?? '#ff6b3d',
      });
    }
  }

  update(dtSec: number): void {
    const { particles } = this;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      if (!p) continue;
      p.vy += JUICE_GRAVITY * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.life -= dtSec;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  /** 限制总量：超限淘汰最旧粒子 */
  cap(limit: number): void {
    if (this.particles.length > limit) {
      this.particles.splice(0, this.particles.length - limit);
    }
  }
}
