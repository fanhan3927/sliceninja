import { AnimatePresence, motion } from 'framer-motion';
import type { LoadProgress } from '../types';

interface LoaderOverlayProps {
  progress: LoadProgress;
  onForceStart: () => void;
}

/** 进局前 Loading：图片 x/y · 音频 x/y；资源有失败时提供「强制开始（占位音）」 */
export default function LoaderOverlay({ progress, onForceStart }: LoaderOverlayProps) {
  const totalSum = progress.imagesTotal + progress.audioTotal;
  const loadedSum = progress.imagesLoaded + progress.audioLoaded;
  const pct = totalSum > 0 ? loadedSum / totalSum : 0;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-dojo/95 backdrop-blur-sm"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="font-display text-2xl font-bold text-gold">进入道场…</div>

      <div className="w-64 max-w-[70%]">
        <div className="h-2 overflow-hidden rounded-full bg-dojo-line">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold to-ember"
            animate={{ width: `${Math.round(pct * 100)}%` }}
            transition={{ ease: 'easeOut', duration: 0.25 }}
          />
        </div>
        <div className="hud-num mt-2.5 text-center text-xs text-ink-dim">
          图片 {progress.imagesLoaded}/{progress.imagesTotal} · 音频 {progress.audioLoaded}/
          {progress.audioTotal}
        </div>
      </div>

      <AnimatePresence>
        {progress.done && progress.hasFailure && (
          <motion.div
            className="pointer-events-auto text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-xs text-ink-dim">部分资源加载失败，将改用振荡器合成占位音</p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onForceStart}
              className="mt-3 rounded-full border border-gold/60 px-6 py-2.5 text-sm font-bold text-gold transition-colors hover:bg-gold/10"
            >
              强制开始（占位音）
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
