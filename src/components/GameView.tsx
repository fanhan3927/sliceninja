import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GameCanvas from './GameCanvas';
import GameOverModal from './GameOverModal';
import type { RunResultView } from './GameOverModal';
import Hud from './Hud';
import LoaderOverlay from './LoaderOverlay';
import { audioManager, useGameSession } from '../hooks/useGameSession';
import type { RunCompletePayload } from '../hooks/useGameSession';
import type { AudioSettings, Phase } from '../types';

interface GameViewProps {
  phase: Phase;
  onPhaseChange: (phase: Phase) => void;
  settings: AudioSettings;
  onToggleMute: () => void;
  onExit: () => void;
  onRunComplete: (payload: RunCompletePayload) => void;
  runResult: RunResultView | null;
}

/** 「挥刀开始」提示：首次滑动即开局（同时解锁 AudioContext） */
function StartHint() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.svg
        width="120"
        height="46"
        viewBox="0 0 120 46"
        animate={{ x: [-6, 6, -6] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
      >
        <path d="M8 36 Q60 2 112 22" stroke="url(#bladeGrad)" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path
          d="M104 14 L114 22 L102 27"
          stroke="#e8c36a"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="bladeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e8c36a" stopOpacity="0.2" />
            <stop offset="1" stopColor="#fff7e8" />
          </linearGradient>
        </defs>
      </motion.svg>
      <motion.p
        className="font-display text-3xl font-black text-ink drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] md:text-4xl"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
      >
        挥刀开始
      </motion.p>
      <p className="text-xs text-ink-dim">按住拖动即可切割水果</p>
    </motion.div>
  );
}

/** 暂停覆盖层（引擎保持挂载，物理与出果已冻结） */
function PauseOverlay({ onResume, onExit, score }: { onResume: () => void; onExit: () => void; score: number }) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/55 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h2 className="font-display text-3xl font-black text-ink">暂停</h2>
      <p className="hud-num text-sm text-ink-dim">当前 {score} 分</p>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onResume}
        className="w-44 rounded-full bg-gradient-to-r from-gold to-ember py-3 font-bold text-[#24140a]"
      >
        继续切割
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onExit}
        className="w-44 rounded-full border border-dojo-line py-3 text-sm text-ink-dim transition-colors hover:border-gold/50 hover:text-gold"
      >
        回大厅
      </motion.button>
    </motion.div>
  );
}

/**
 * 游戏页容器：Loading → 挥刀开始 → 对局 →（暂停）→ 结算。
 * 全部叠加在 16:9 画布上；暂停不卸载引擎（App 阶段切换时 GameView 保持挂载）。
 */
export default function GameView({
  phase,
  onPhaseChange,
  settings,
  onToggleMute,
  onExit,
  onRunComplete,
  runResult,
}: GameViewProps) {
  const {
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
  } = useGameSession({ onPhaseChange, onRunComplete });

  // 设置变化 → 音频管理器（BGM/SFX 静音即时生效）
  useEffect(() => {
    audioManager.setBgmMuted(settings.bgmMuted);
    audioManager.setSfxMuted(settings.sfxMuted);
  }, [settings]);

  const paused = phase === 'paused';
  const showHud = phase !== 'loading' && snapshot !== null;

  return (
    <div className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-dojo">
      <div
        className="relative overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.65)]"
        style={{ width: 'min(100%, calc(100dvh / 9 * 16))', aspectRatio: '16 / 9' }}
      >
        <GameCanvas canvasRef={attachCanvas} onPointerDown={swipeStart} />

        {/* 命中惩罚 / 炸弹红闪（key 变化触发重播） */}
        {flashKey > 0 && (
          <motion.div
            key={flashKey}
            className="pointer-events-none absolute inset-0 z-10"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              background:
                'radial-gradient(85% 85% at 50% 50%, transparent 50%, rgba(255,59,59,0.6) 100%)',
            }}
          />
        )}

        {showHud && snapshot && (
          <Hud
            snapshot={snapshot}
            settings={settings}
            paused={paused}
            onTogglePause={() => togglePause(phase)}
            onToggleMute={onToggleMute}
          />
        )}

        {/* 中央大字（Combo / Level Up，Framer Motion 只做 UI 过渡） */}
        <AnimatePresence>
          {banner && (
            <motion.div
              key={banner.id}
              className="pointer-events-none absolute inset-x-0 top-[18%] z-20 text-center"
              initial={{ opacity: 0, scale: 0.7, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.18 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            >
              <span className="font-display bg-gradient-to-br from-gold to-ember bg-clip-text text-4xl font-black text-transparent drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)] md:text-5xl">
                {banner.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{phase === 'playing' && awaitingStart && <StartHint />}</AnimatePresence>

        <AnimatePresence>
          {phase === 'loading' && <LoaderOverlay progress={progress} onForceStart={forceStart} />}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'paused' && snapshot && (
            <PauseOverlay onResume={() => togglePause(phase)} onExit={onExit} score={snapshot.score} />
          )}
        </AnimatePresence>

        {phase === 'over' && <GameOverModal result={runResult} onRestart={restart} onExit={onExit} />}
      </div>
    </div>
  );
}
