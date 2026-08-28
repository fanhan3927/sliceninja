import { motion } from 'framer-motion';
import type { RunRecord } from '../types';

interface HallProps {
  highScore: number;
  bestCombo: number;
  recentRuns: RunRecord[];
  onStart: () => void;
  onOpenSettings: () => void;
}

const HOW_TO = ['滑动切割飞出的水果', '避开炸弹，切中立即结束', '漏切 3 个水果游戏结束'];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

/** 大厅：道场风落地页（标题 / 玩法三句 / 本机战绩 / 主按钮） */
export default function Hall({ highScore, bestCombo, recentRuns, onStart, onOpenSettings }: HallProps) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 py-8">
      {/* 背景氛围：顶部暖光 + 底部暗角（纯 CSS，无图片依赖） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 0%, rgba(232,195,106,0.14), transparent 70%), radial-gradient(90% 70% at 50% 115%, rgba(0,0,0,0.55), transparent 60%)',
        }}
      />

      <motion.div variants={container} initial="hidden" animate="show" className="relative flex w-full max-w-md flex-col items-center">
        <motion.p variants={item} className="text-[11px] tracking-[0.5em] text-ink-dim">
          纯前端 · 果 斩 道 场
        </motion.p>

        <motion.h1
          variants={item}
          className="font-display mt-3 bg-gradient-to-br from-gold to-ember bg-clip-text text-center text-6xl font-black tracking-tight text-transparent md:text-7xl"
        >
          SliceNinja
        </motion.h1>

        <motion.p variants={item} className="mt-3 max-w-[34ch] text-center text-sm leading-relaxed text-ink-dim">
          滑动切割飞出的水果，避开炸弹——等级越高，出果越快越密。
        </motion.p>

        {/* 本机战绩 */}
        <motion.div variants={item} className="mt-7 flex items-center gap-8">
          <div className="text-center">
            <div className="hud-num text-4xl font-bold text-gold">{highScore}</div>
            <div className="mt-1 text-[11px] tracking-widest text-ink-dim">本机最高分</div>
          </div>
          <div className="h-10 w-px bg-dojo-line" />
          <div className="text-center">
            <div className="hud-num text-4xl font-bold text-ink">{bestCombo}</div>
            <div className="mt-1 text-[11px] tracking-widest text-ink-dim">最高连击</div>
          </div>
        </motion.div>

        {/* 主按钮 */}
        <motion.button
          variants={item}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="mt-8 w-full max-w-xs rounded-full bg-gradient-to-r from-gold to-ember py-4 text-lg font-bold text-[#24140a] shadow-[0_10px_30px_rgba(255,107,61,0.35)]"
        >
          开始切割
        </motion.button>

        <motion.button
          variants={item}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenSettings}
          className="mt-3 rounded-full border border-dojo-line px-8 py-2.5 text-sm text-ink-dim transition-colors hover:border-gold/50 hover:text-gold"
        >
          设置
        </motion.button>

        {/* 玩法说明（三步） */}
        <motion.ol
          variants={item}
          className="mt-8 grid w-full gap-2.5 rounded-2xl border border-dojo-line/70 bg-dojo-soft/60 p-4 backdrop-blur-sm"
        >
          {HOW_TO.map((line, i) => (
            <li key={line} className="flex items-center gap-3 text-sm text-ink-dim">
              <span className="hud-num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/40 text-[11px] text-gold">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </motion.ol>

        {/* 最近战绩（最多展示 3 局） */}
        {recentRuns.length > 0 && (
          <motion.div variants={item} className="mt-5 w-full">
            <div className="mb-2 text-[11px] tracking-widest text-ink-dim">最近战绩</div>
            <ul className="grid grid-cols-3 gap-2">
              {recentRuns.slice(0, 3).map((run) => (
                <li
                  key={run.endedAt}
                  className="rounded-xl border border-dojo-line/60 bg-dojo-soft/40 px-2 py-2 text-center"
                >
                  <div className="hud-num text-base font-bold text-ink">{run.score}</div>
                  <div className="mt-0.5 text-[10px] text-ink-dim">
                    Lv.{run.level} · 连击{run.bestCombo}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
