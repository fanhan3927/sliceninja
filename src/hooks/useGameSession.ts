/**
 * useGameSession：游戏页会话编排（资源预载、引擎生命周期、事件→UI 桥接）。
 * 引擎与 React 解耦：引擎回调只经由最新引用（ref）转发，避免每帧重挂。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createGame } from '../game/engine';
import type { GameController } from '../game/engine';
import { AudioManager } from '../game/audio';
import { IMAGE_MANIFEST, preloadImages } from '../game/assets';
import type { GameEvent, GameFinalStats, GameSnapshot } from '../game/types';
import type { LoadProgress, Phase } from '../types';

/** 音频单例：大厅设置与游戏页共用同一 AudioContext / 预载结果 */
export const audioManager = new AudioManager();

export interface Banner {
  id: number;
  kind: 'combo' | 'levelup';
  text: string;
}

export interface RunCompletePayload {
  stats: GameFinalStats;
  reason: 'lives' | 'bomb';
}

interface UseGameSessionArgs {
  onPhaseChange: (phase: Phase) => void;
  onRunComplete: (payload: RunCompletePayload) => void;
}

interface SessionApi {
  progress: LoadProgress;
  attachCanvas: (el: HTMLCanvasElement | null) => void;
  snapshot: GameSnapshot | null;
  awaitingStart: boolean;
  banner: Banner | null;
  flashKey: number;
  /** 画布首次指针按下：解锁 AudioContext + 挥刀开始 */
  swipeStart: () => void;
  forceStart: () => void;
  togglePause: (phase: Phase) => void;
  restart: () => void;
}

const INITIAL_PROGRESS: LoadProgress = {
  imagesLoaded: 0,
  imagesTotal: IMAGE_MANIFEST.length,
  audioLoaded: 0,
  audioTotal: 0,
  hasFailure: false,
  done: false,
};

// ---- 模块级资源预载单例（StrictMode 双挂载 / 反复进出游戏页只加载一次） ----

interface AssetsResult {
  images: ReadonlyMap<string, HTMLImageElement>;
  imagesTotal: number;
  audioFailed: number;
}

let assetsPromise: Promise<AssetsResult> | null = null;
let progressReporter: ((patch: Partial<LoadProgress>) => void) | null = null;

function loadAssetsOnce(): Promise<AssetsResult> {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const [images, audioResult] = await Promise.all([
        preloadImages((loaded, total) => progressReporter?.({ imagesLoaded: loaded, imagesTotal: total })),
        audioManager.load((loaded, total) => progressReporter?.({ audioLoaded: loaded, audioTotal: total })),
      ]);
      return { images, imagesTotal: IMAGE_MANIFEST.length, audioFailed: audioResult.failed };
    })();
  }
  return assetsPromise;
}

export function useGameSession({ onPhaseChange, onRunComplete }: UseGameSessionArgs): SessionApi {
  const [progress, setProgress] = useState<LoadProgress>(INITIAL_PROGRESS);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [awaitingStart, setAwaitingStart] = useState(true);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const engineRef = useRef<GameController | null>(null);
  const imagesRef = useRef<ReadonlyMap<string, HTMLImageElement>>(new Map());
  const bannerIdRef = useRef(0);
  const awaitingStartRef = useRef(true);
  const onRunCompleteRef = useRef(onRunComplete);
  onRunCompleteRef.current = onRunComplete;

  /** 引擎事件 → UI（大字横幅 / 红闪 / 结算上报）。通过 ref 提供最新闭包。 */
  const eventHandlerRef = useRef<(event: GameEvent) => void>(() => undefined);
  eventHandlerRef.current = (event: GameEvent): void => {
    switch (event.type) {
      case 'combo':
        bannerIdRef.current += 1;
        setBanner({ id: bannerIdRef.current, kind: 'combo', text: `${event.count} 连击 +${event.bonus}` });
        break;
      case 'levelup':
        bannerIdRef.current += 1;
        setBanner({ id: bannerIdRef.current, kind: 'levelup', text: `Level ${event.level} · 出果加速！` });
        break;
      case 'miss':
      case 'bomb':
        setFlashKey((k) => k + 1);
        break;
      case 'over':
        audioManager.stopBgm();
        onRunCompleteRef.current({ stats: event.stats, reason: event.reason });
        break;
      case 'slice':
        break;
    }
  };

  // 仅记录 canvas 元素；引擎在 effect 中创建（StrictMode 卸载重挂时自愈）
  const attachCanvas = useCallback((el: HTMLCanvasElement | null): void => {
    setCanvasEl((prev) => (prev === el ? prev : el));
  }, []);

  // 引擎生命周期：随 canvas 挂载创建、卸载销毁
  useEffect(() => {
    if (!canvasEl) return;
    const engine = createGame(canvasEl, {
      audio: audioManager,
      onSnapshot: (s) => setSnapshot(s),
      onEvent: (event) => eventHandlerRef.current(event),
    });
    engine.setImages(imagesRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [canvasEl]);

  // 预载（一次性）；全部成功自动进入「挥刀开始」，有失败则停在 Loading 等待强制开始
  useEffect(() => {
    progressReporter = (patch) => setProgress((prev) => ({ ...prev, ...patch }));
    let cancelled = false;
    void loadAssetsOnce()
      .then((result) => {
        if (cancelled) return;
        imagesRef.current = result.images;
        engineRef.current?.setImages(result.images);
        const hasFailure = result.images.size < result.imagesTotal || result.audioFailed > 0;
        setProgress((prev) => ({ ...prev, done: true, hasFailure }));
        if (!hasFailure) {
          setAwaitingStart(true);
          awaitingStartRef.current = true;
          onPhaseChange('playing');
        }
      })
      .catch(() => {
        if (!cancelled) setProgress((prev) => ({ ...prev, done: true, hasFailure: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [onPhaseChange]);

  // 卸载（回大厅）时停 BGM（引擎销毁由上方 engine effect 的 cleanup 负责）
  useEffect(() => {
    return () => {
      audioManager.stopBgm();
    };
  }, []);

  // 横幅自动消失
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner((b) => (b && b.id === banner.id ? null : b)), 1200);
    return () => clearTimeout(timer);
  }, [banner]);

  const swipeStart = useCallback((): void => {
    // 首次指针手势：解锁 AudioContext（自动播放策略），随后开播 BGM
    if (!audioManager.isUnlocked()) {
      audioManager.startBgm(); // 记录 wantBgm，unlock 成功后自动开播
      void audioManager.unlock();
    }
    if (awaitingStartRef.current) {
      awaitingStartRef.current = false;
      setAwaitingStart(false);
      engineRef.current?.start();
      audioManager.startBgm();
    }
  }, []);

  const forceStart = useCallback((): void => {
    setAwaitingStart(true);
    awaitingStartRef.current = true;
    onPhaseChange('playing');
  }, [onPhaseChange]);

  const togglePause = useCallback(
    (phase: Phase): void => {
      const engine = engineRef.current;
      if (!engine) return;
      if (phase === 'paused') {
        engine.resume();
        onPhaseChange('playing');
      } else if (phase === 'playing') {
        engine.pause();
        onPhaseChange('paused');
      }
    },
    [onPhaseChange],
  );

  const restart = useCallback((): void => {
    engineRef.current?.start();
    audioManager.startBgm();
    setAwaitingStart(false);
    awaitingStartRef.current = false;
    onPhaseChange('playing');
  }, [onPhaseChange]);

  return {
    progress,
    attachCanvas,
    snapshot,
    awaitingStart,
    banner,
    flashKey,
    swipeStart,
    forceStart,
    togglePause,
    restart,
  };
}
