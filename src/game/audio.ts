/**
 * AudioManager：Web Audio 双通道。
 * 1) 文件通道：load() 阶段 fetch + decodeAudioData（与 PRD 路径一一对应）；
 * 2) 合成通道：任一文件 fetch/decode 失败时，play() 用 OscillatorNode/噪声合成对应音效。
 * 浏览器自动播放策略：AudioContext 创建后处于 suspended，必须由首次指针手势调用 unlock()。
 */
import { AUDIO_MANIFEST } from './assets';
import type { AudioAsset } from './assets';

export type AudioKey = (typeof AUDIO_MANIFEST)[number]['key'];

export interface AudioLoadResult {
  loaded: number;
  failed: number;
  total: number;
}

export type AudioProgressCallback = (loaded: number, total: number) => void;

const SLICE_KEYS: readonly AudioKey[] = ['slice-1', 'slice-2', 'slice-3'];

/** BGM 合成循环的和弦进行（A 小调 i–VI–III–VII，Hz） */
const BGM_CHORDS: readonly number[][] = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];
const BGM_BAR_SECONDS = 1.7;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers = new Map<AudioKey, AudioBuffer>();
  private failedKeys = new Set<AudioKey>();

  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmSynthNodes: OscillatorNode[] = [];
  private bgmSynthTimer: ReturnType<typeof setTimeout> | null = null;
  private bgmBarIndex = 0;

  private wantBgm = false;
  private unlocked = false;

  bgmMuted = false;
  sfxMuted = false;

  /** 预加载全部音频；单个失败不抛错，只记入 failedKeys（运行时转合成）。 */
  async load(onProgress?: AudioProgressCallback): Promise<AudioLoadResult> {
    const total = AUDIO_MANIFEST.length;
    let loaded = 0;
    let failed = 0;
    onProgress?.(0, total);

    await Promise.all(
      AUDIO_MANIFEST.map(async (asset) => {
        try {
          const buffer = await this.fetchAndDecode(asset);
          this.buffers.set(asset.key, buffer);
        } catch {
          this.failedKeys.add(asset.key);
          failed += 1;
        } finally {
          loaded += 1;
          onProgress?.(loaded, total);
        }
      }),
    );

    return { loaded: loaded - failed, failed, total };
  }

  /** 文件是否可用（false 时 play 会走合成通道） */
  hasFile(key: AudioKey): boolean {
    return this.buffers.has(key);
  }

  failedCount(): number {
    return this.failedKeys.size;
  }

  /**
   * 首次指针手势调用：resume AudioContext。
   * 解锁后若此前已请求过 BGM，则立即开播。
   */
  async unlock(): Promise<void> {
    this.unlocked = true;
    const ctx = this.ensureContext();
    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      /* 某些浏览器 resume 可能 reject，忽略 */
    }
    if (this.wantBgm) this.startBgm();
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** 播放一次性音效（文件优先，失败转合成）。 */
  play(key: AudioKey, volumeScale = 1): void {
    if (this.sfxMuted) return;
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') return; // 未解锁前不出声，避免排队爆发
    const asset = this.assetByKey(key);
    const buffer = this.buffers.get(key);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = asset.volume * volumeScale;
      src.connect(gain).connect(this.ensureSfxGain(ctx));
      src.start();
    } else {
      this.synthOneShot(ctx, key, asset.volume * volumeScale);
    }
  }

  /** 切片音：三个变体随机（PRD：切割音效 3 个变体随机）。 */
  playSlice(): void {
    const key = SLICE_KEYS[Math.floor(Math.random() * SLICE_KEYS.length)] ?? 'slice-1';
    this.play(key, 1);
  }

  startBgm(): void {
    this.wantBgm = true;
    if (this.bgmMuted || !this.unlocked) return;
    this.stopBgmNodes();
    const ctx = this.ensureContext();
    const buffer = this.buffers.get('bgm');
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.ensureBgmGain(ctx));
      src.start();
      this.bgmSource = src;
    } else {
      this.startBgmSynth(ctx);
    }
  }

  stopBgm(): void {
    this.wantBgm = false;
    this.stopBgmNodes();
  }

  setBgmMuted(muted: boolean): void {
    this.bgmMuted = muted;
    if (muted) {
      this.stopBgmNodes();
    } else if (this.wantBgm && this.unlocked) {
      this.startBgm();
    }
  }

  setSfxMuted(muted: boolean): void {
    this.sfxMuted = muted;
  }

  dispose(): void {
    this.stopBgmNodes();
    this.wantBgm = false;
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.sfxGain = null;
      this.bgmGain = null;
    }
  }

  // ---------- 内部实现 ----------

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  private ensureSfxGain(ctx: AudioContext): GainNode {
    if (!this.sfxGain) {
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(ctx.destination);
    }
    return this.sfxGain;
  }

  private ensureBgmGain(ctx: AudioContext): GainNode {
    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.value = 1;
      this.bgmGain.connect(ctx.destination);
    }
    return this.bgmGain;
  }

  private assetByKey(key: AudioKey): AudioAsset {
    return AUDIO_MANIFEST.find((a) => a.key === key) ?? { key, src: '', volume: 0.7 };
  }

  private async fetchAndDecode(asset: AudioAsset): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const res = await fetch(asset.src);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${asset.src}`);
    const bytes = await res.arrayBuffer();
    return await ctx.decodeAudioData(bytes);
  }

  /** 停掉 BGM 的文件源与合成源 */
  private stopBgmNodes(): void {
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
      } catch {
        /* already stopped */
      }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
    if (this.bgmSynthTimer !== null) {
      clearTimeout(this.bgmSynthTimer);
      this.bgmSynthTimer = null;
    }
    for (const osc of this.bgmSynthNodes) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
      osc.disconnect();
    }
    this.bgmSynthNodes = [];
  }

  /**
   * 合成 BGM：简单和弦垫循环（TECH_DESIGN：BGM 简单和弦循环）。
   * 用 setTimeout 按小节调度，每个和弦 3 个 triangle 振荡器 + 缓入缓出包络。
   */
  private startBgmSynth(ctx: AudioContext): void {
    const scheduleBar = (): void => {
      const chord = BGM_CHORDS[this.bgmBarIndex % BGM_CHORDS.length] ?? BGM_CHORDS[0];
      this.bgmBarIndex += 1;
      const t0 = ctx.currentTime + 0.05;
      const dur = BGM_BAR_SECONDS;
      const out = this.ensureBgmGain(ctx);
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.05, t0 + 0.25);
        env.gain.setValueAtTime(0.05, t0 + dur - 0.35);
        env.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(env).connect(out);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
        this.bgmSynthNodes.push(osc);
        osc.onended = () => {
          this.bgmSynthNodes = this.bgmSynthNodes.filter((n) => n !== osc);
        };
      }
      this.bgmSynthTimer = setTimeout(() => {
        if (this.wantBgm && !this.bgmMuted) scheduleBar();
      }, dur * 1000);
    };
    scheduleBar();
  }

  /**
   * 合成一次性音效（文件失败兜底）：
   * 切片 ~880Hz 短脉冲（TECH_DESIGN）、炸弹低频噪声、miss 下滑音、combo/level-up 琶音等。
   */
  private synthOneShot(ctx: AudioContext, key: AudioKey, volume: number): void {
    const t0 = ctx.currentTime;
    const out = this.ensureSfxGain(ctx);

    const tone = (
      freq: number,
      start: number,
      dur: number,
      gain: number,
      type: OscillatorType = 'sine',
      endFreq?: number,
    ): void => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + start);
      if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + start + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0 + start);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * volume), t0 + start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(env).connect(out);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.03);
    };

    const noise = (dur: number, gain: number, lowpassHz: number): void => {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpassHz;
      const env = ctx.createGain();
      env.gain.value = gain * volume;
      src.connect(filter).connect(env).connect(out);
      src.start(t0);
    };

    switch (key) {
      case 'slice-1':
        tone(1180, 0, 0.07, 0.5, 'triangle', 320);
        break;
      case 'slice-2':
        tone(880, 0, 0.08, 0.5, 'triangle', 260);
        break;
      case 'slice-3':
        tone(1480, 0, 0.06, 0.45, 'triangle', 420);
        break;
      case 'bomb':
        noise(0.5, 0.9, 900);
        tone(70, 0, 0.55, 0.9, 'sine', 36);
        break;
      case 'miss':
        tone(440, 0, 0.28, 0.55, 'sine', 150);
        break;
      case 'combo':
        tone(523.25, 0, 0.12, 0.5, 'triangle');
        tone(659.26, 0.09, 0.12, 0.5, 'triangle');
        tone(783.99, 0.18, 0.16, 0.55, 'triangle');
        break;
      case 'level-up':
        tone(523.25, 0, 0.1, 0.5, 'triangle');
        tone(659.26, 0.08, 0.1, 0.5, 'triangle');
        tone(783.99, 0.16, 0.1, 0.5, 'triangle');
        tone(1046.5, 0.24, 0.22, 0.6, 'triangle');
        break;
      case 'game-over':
        tone(392, 0, 0.3, 0.55, 'sine');
        tone(311.13, 0.25, 0.3, 0.55, 'sine');
        tone(233.08, 0.5, 0.5, 0.6, 'sine', 110);
        break;
      case 'bgm':
        // BGM 走 startBgm 的合成循环，不通过一次性通道
        this.startBgmSynth(ctx);
        break;
    }
  }
}
