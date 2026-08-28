/**
 * 游戏引擎总控：rAF 循环 + 状态机（idle/running/paused/over）。
 * 每帧：input(已由事件驱动) → blade → spawn → physics → slice test → particles → render。
 * 与 React 解耦：通过 onSnapshot(10Hz) / onEvent 外发；SFX 通过注入的 audio 播放。
 */
import { DT_CLAMP_MS, DEFAULT_DIFFICULTY, HIT_STOP_MS, LOW_FPS_THRESHOLD, LOW_FPS_WINDOW_MS, PARTICLE_LIMIT } from './constants';
import { cumulativeSlicedForLevel, getDifficulty } from './difficulty';
import { gravityPx } from './physics';
import { BladeTrail } from './blade';
import { GameWorld } from './world';
import { Scoring } from './scoring';
import { Spawner } from './spawner';
import { Renderer } from './renderer';
import { attachInput } from './input';
import type { AudioKey, AudioManager } from './audio';
import type { EngineState, GameEvent, GameSnapshot, FruitKindId } from './types';

export interface EngineOptions {
  /** 引擎只负责一次性音效与切片音；BGM 的启停由会话层控制 */
  audio: Pick<AudioManager, 'play' | 'playSlice'>;
  onSnapshot?: (snapshot: GameSnapshot) => void;
  onEvent?: (event: GameEvent) => void;
}

export interface GameController {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  /** 预载完成的图片表（缺失的 key 由渲染器程序化兜底） */
  setImages(images: ReadonlyMap<string, HTMLImageElement>): void;
}

export function createGame(canvas: HTMLCanvasElement, options: EngineOptions): GameController {
  const renderer = new Renderer(canvas);
  const world = new GameWorld();
  const blade = new BladeTrail();
  const spawner = new Spawner();
  const scoring = new Scoring();

  let images: ReadonlyMap<string, HTMLImageElement> = new Map();
  let state: EngineState = 'idle';
  let destroyed = false;
  let rafId = 0;
  let lastNow = performance.now();
  let hitStopMs = 0;
  let snapshotTimer = 0;
  let fpsEma = 60;
  let lowFpsMs = 0;
  let particleScale = 1;

  const emit = (event: GameEvent): void => {
    options.onEvent?.(event);
  };

  const playSfx = (key: AudioKey): void => {
    options.audio.play(key);
  };

  // ---------- 画布尺寸 / 坐标映射 ----------

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    renderer.resize(w, h);
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  /** 指针坐标 → 逻辑坐标（letterbox 逆变换） */
  const toLogical = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const backX = (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    const backY = (clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
    const { scale, offsetX, offsetY } = renderer.view;
    return { x: (backX - offsetX) / scale, y: (backY - offsetY) / scale };
  };

  // ---------- 输入 ----------

  const detachInput = attachInput(canvas, toLogical, {
    onDown(pos, tMs) {
      if (state !== 'running') return;
      blade.reset();
      blade.add(pos.x, pos.y, tMs);
    },
    onMove(pos, tMs) {
      if (state !== 'running') return;
      blade.add(pos.x, pos.y, tMs);
    },
    onUp() {
      blade.reset();
    },
  });

  // ---------- 规则处理 ----------

  const gameOver = (reason: 'lives' | 'bomb'): void => {
    if (state === 'over') return;
    state = 'over';
    playSfx('game-over');
    emit({
      type: 'over',
      reason,
      stats: {
        score: scoring.score,
        level: world.level,
        bestCombo: scoring.bestCombo,
        sliced: world.slicedCount,
        missed: world.missedCount,
      },
    });
  };

  const handleMisses = (missedCount: number): void => {
    for (let i = 0; i < missedCount; i += 1) {
      world.missedCount += 1;
      world.lives -= 1;
      playSfx('miss');
      emit({ type: 'miss', livesLeft: world.lives });
      if (world.lives <= 0) {
        gameOver('lives');
        return;
      }
    }
  };

  const handleHits = (hits: ReturnType<GameWorld['processSlices']>, nowMs: number): void => {
    const difficulty = getDifficulty(world.level);
    let bombHit = false;
    for (const hit of hits) {
      if (hit.kind === 'bomb') {
        bombHit = true;
        hitStopMs = 70;
        playSfx('bomb');
        emit({ type: 'bomb', x: hit.x, y: hit.y });
        if (DEFAULT_DIFFICULTY.bombEndsGame) {
          gameOver('bomb');
          return;
        }
      } else {
        world.slicedCount += 1;
        scoring.score += DEFAULT_DIFFICULTY.scorePerFruit;
        hitStopMs = HIT_STOP_MS; // PRD：切开 20–40ms hit-stop
        options.audio.playSlice();
        emit({
          type: 'slice',
          x: hit.x,
          y: hit.y,
          kind: hit.kind as FruitKindId,
          points: DEFAULT_DIFFICULTY.scorePerFruit,
        });
        const combo = scoring.registerSlice(nowMs, difficulty.comboWindowMs, DEFAULT_DIFFICULTY.comboBonus);
        if (combo) {
          playSfx('combo');
          emit({ type: 'combo', count: combo.count, bonus: combo.bonus });
        }
      }
    }
    if (!bombHit) {
      // 升级检查（前缀和阈值，见 difficulty.ts）
      while (world.slicedCount >= cumulativeSlicedForLevel(world.level + 1)) {
        world.level += 1;
        playSfx('level-up');
        emit({ type: 'levelup', level: world.level });
      }
    }
  };

  // ---------- 主循环 ----------

  const buildSnapshot = (nowMs: number): GameSnapshot => {
    const difficulty = getDifficulty(world.level);
    return {
      state,
      score: scoring.score,
      combo: scoring.activeCount(nowMs, difficulty.comboWindowMs),
      bestCombo: scoring.bestCombo,
      level: world.level,
      lives: world.lives,
      sliced: world.slicedCount,
      missed: world.missedCount,
      fruitsToNextLevel: Math.max(0, cumulativeSlicedForLevel(world.level + 1) - world.slicedCount),
      fps: Math.round(fpsEma),
      particleScale,
    };
  };

  const frame = (nowMs: number): void => {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    const rawDt = nowMs - lastNow;
    lastNow = nowMs;
    const dtMs = Math.min(DT_CLAMP_MS, Math.max(0, rawDt)); // dt clamp 33ms
    const dtSec = dtMs / 1000;
    if (rawDt > 0 && rawDt < 500) fpsEma = fpsEma * 0.92 + (1000 / rawDt) * 0.08;

    if (state === 'running') {
      // fps 连续 2s < 45 → 逐级降低粒子（最低 0.3）
      if (fpsEma < LOW_FPS_THRESHOLD) lowFpsMs += rawDt;
      else lowFpsMs = 0;
      if (lowFpsMs >= LOW_FPS_WINDOW_MS && particleScale > 0.3) {
        particleScale = Math.max(0.3, particleScale * 0.55);
        lowFpsMs = 0;
      }

      const difficulty = getDifficulty(world.level);
      if (hitStopMs > 0) {
        hitStopMs = Math.max(0, hitStopMs - dtMs);
      } else {
        const requests = spawner.update(dtMs, difficulty);
        if (requests.length > 0) world.spawn(requests);
        const missedFruits = world.step(dtSec, gravityPx(difficulty)).length;
        if (missedFruits > 0) handleMisses(missedFruits);
      }
      if (state === 'running') {
        const segments = blade.activeSegments(nowMs);
        if (segments.length > 0) handleHits(world.processSlices(segments), nowMs);
      }
    } else if (state === 'over') {
      // 结束后剩余果实继续坠落（不再出果、不可切割）
      world.step(dtSec, gravityPx(getDifficulty(world.level)));
    }
    // paused / idle：物理与出果全部冻结，仅保持渲染

    world.particles.cap(Math.max(30, Math.round(PARTICLE_LIMIT * particleScale)));
    blade.prune(nowMs);
    renderer.render(world, blade, images, nowMs);

    snapshotTimer += dtMs;
    if (snapshotTimer >= 100) {
      snapshotTimer = 0;
      options.onSnapshot?.(buildSnapshot(nowMs));
    }
  };

  rafId = requestAnimationFrame(frame);

  // ---------- 控制器 ----------

  return {
    start() {
      world.reset();
      spawner.reset();
      scoring.reset();
      blade.reset();
      hitStopMs = 0;
      state = 'running';
      lastNow = performance.now();
    },
    pause() {
      if (state === 'running') state = 'paused';
    },
    resume() {
      if (state === 'paused') {
        state = 'running';
        lastNow = performance.now();
      }
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      detachInput();
    },
    setImages(next) {
      images = next;
    },
  };
}
