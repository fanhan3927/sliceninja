/**
 * 计分与连击（Combo）。
 * 规则（PRD）：短窗口（comboWindowMs）连续切开 ≥3 个水果触发 Combo：
 * 第 3 个水果给 count * comboBonus 奖分，同窗口内每多切 1 个再给 comboBonus。
 */
export interface ComboAwarded {
  count: number;
  bonus: number;
}

export class Scoring {
  score = 0;
  bestCombo = 0;

  private sliceTimes: number[] = [];

  reset(): void {
    this.score = 0;
    this.bestCombo = 0;
    this.sliceTimes = [];
  }

  /**
   * 注册一次切片。窗口内的历史时间戳保留，返回本切片触发的连击奖励（未达 3 连返回 null）。
   */
  registerSlice(nowMs: number, windowMs: number, comboBonus: number): ComboAwarded | null {
    this.sliceTimes.push(nowMs);
    this.sliceTimes = this.sliceTimes.filter((t) => nowMs - t <= windowMs);
    const count = this.sliceTimes.length;
    if (count >= 2) this.bestCombo = Math.max(this.bestCombo, count);
    if (count >= 3) {
      const bonus = count === 3 ? count * comboBonus : comboBonus;
      this.score += bonus;
      return { count, bonus };
    }
    return null;
  }

  /** 当前窗口内的活跃连击数（HUD 展示用，窗口过后归零） */
  activeCount(nowMs: number, windowMs: number): number {
    this.sliceTimes = this.sliceTimes.filter((t) => nowMs - t <= windowMs);
    return this.sliceTimes.length;
  }
}
