import { AnimatePresence, motion } from 'framer-motion';
import type { GameFinalStats } from '../game/types';

export interface RunResultView {
  stats: GameFinalStats;
  isNewHighScore: boolean;
  reason: 'lives' | 'bomb';
}

interface GameOverModalProps {
  result: RunResultView | null;
  onRestart: () => void;
  onExit: () => void;
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-dojo-line/60 bg-dojo/50 px-2 py-2.5 text-center">
      <div className={`hud-num text-xl font-bold ${accent ? 'text-gold' : 'text-ink'}`}>{value}</div>
      <div className="mt-0.5 text-[10px] tracking-widest text-ink-dim">{label}</div>
    </div>
  );
}

/** 结算弹窗：本局分数 / Level / 连击 / 切开与漏切 + 破纪录标记；再来一局 / 回大厅 */
export default function GameOverModal({ result, onRestart, onExit }: GameOverModalProps) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-6 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-label="结算"
            className="w-full max-w-sm rounded-3xl border border-dojo-line bg-dojo-soft/95 p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
          >
            <p className="text-center text-xs tracking-[0.4em] text-ink-dim">
              {result.reason === 'bomb' ? '切中炸弹' : '三次漏切'}
            </p>
            <h2 className="font-display mt-2 text-center text-3xl font-black text-ink">游戏结束</h2>

            <div className="mt-4 text-center">
              <div className="hud-num bg-gradient-to-br from-gold to-ember bg-clip-text text-6xl font-black text-transparent">
                {result.stats.score}
              </div>
              {result.isNewHighScore && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.12, 1], opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="mx-auto mt-2 inline-block rounded-full border border-gold/50 bg-gold/10 px-4 py-1 text-xs font-bold tracking-widest text-gold"
                >
                  新纪录！
                </motion.div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <StatCell label="LEVEL" value={result.stats.level} accent />
              <StatCell label="最高连击" value={result.stats.bestCombo} accent />
              <StatCell label="切开" value={result.stats.sliced} />
              <StatCell label="漏切" value={result.stats.missed} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onRestart}
                className="rounded-full bg-gradient-to-r from-gold to-ember py-3 font-bold text-[#24140a]"
              >
                再来一局
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onExit}
                className="rounded-full border border-dojo-line py-3 text-sm text-ink-dim transition-colors hover:border-gold/50 hover:text-gold"
              >
                回大厅
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
