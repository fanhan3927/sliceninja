import { motion } from 'framer-motion';
import type { GameSnapshot } from '../game/types';
import { getDifficulty } from '../game/difficulty';
import type { AudioSettings } from '../types';

interface HudProps {
  snapshot: GameSnapshot;
  settings: AudioSettings;
  paused: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
}

function XMark({ lost }: { lost: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M3 3 L13 13 M13 3 L3 13"
        stroke={lost ? '#ff3b3b' : '#e8c36a'}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity={lost ? 0.35 : 0.95}
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="3" y="2.5" width="3.6" height="11" rx="1.2" fill="currentColor" />
      <rect x="9.4" y="2.5" width="3.6" height="11" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M4.5 2.8 L13 8 L4.5 13.2 Z" fill="currentColor" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2.5 6 H5.5 L9 3 V13 L5.5 10 H2.5 Z" fill="currentColor" />
      {muted ? (
        <path d="M11 5.5 L14.5 10.5 M14.5 5.5 L11 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M11 5.5 Q12.6 8 11 10.5 M12.6 4 Q15 8 12.6 12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-dojo-line/50 bg-dojo/55 text-ink backdrop-blur-sm transition-colors hover:border-gold/50 hover:text-gold"
    >
      {children}
    </motion.button>
  );
}

/** HUD：半透明不挡刀路——分数/连击（左）、等级与升级进度（中）、生命与控制（右） */
export default function Hud({ snapshot, settings, paused, onTogglePause, onToggleMute }: HudProps) {
  const muted = settings.bgmMuted && settings.sfxMuted;
  const need = getDifficulty(snapshot.level).fruitsToLevelUp;
  const pct = need > 0 ? Math.min(1, 1 - snapshot.fruitsToNextLevel / need) : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2.5 md:p-4">
      {/* 左：分数 + 当前连击 */}
      <div className="rounded-2xl border border-dojo-line/50 bg-dojo/55 px-3.5 py-2 backdrop-blur-sm md:px-4">
        <div className="hud-num text-2xl font-bold leading-none text-ink md:text-3xl">{snapshot.score}</div>
        <div className="mt-1 text-[9px] tracking-[0.25em] text-ink-dim">SCORE</div>
        {snapshot.combo >= 2 && (
          <motion.div
            key={snapshot.combo}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            className="mt-1.5 text-sm font-bold text-gold"
          >
            {snapshot.combo} 连击
          </motion.div>
        )}
        {snapshot.bestCombo >= 2 && (
          <div className="mt-0.5 text-[10px] text-ink-dim">本局最高 {snapshot.bestCombo} 连击</div>
        )}
      </div>

      {/* 中：等级 + 升级进度 */}
      <div className="rounded-2xl border border-dojo-line/50 bg-dojo/55 px-3.5 py-2 text-center backdrop-blur-sm md:px-4">
        <div className="hud-num text-lg font-bold leading-none text-gold">Lv.{snapshot.level}</div>
        <div className="mt-1.5 h-1.5 w-16 overflow-hidden rounded-full bg-dojo-line md:w-24">
          <div className="h-full rounded-full bg-gradient-to-r from-gold to-ember" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <div className="mt-1 hidden text-[10px] text-ink-dim md:block">
          再切 {snapshot.fruitsToNextLevel} 个升级
        </div>
      </div>

      {/* 右：生命 + 暂停 + 静音 */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 rounded-2xl border border-dojo-line/50 bg-dojo/55 px-3 py-2.5 backdrop-blur-sm"
          aria-label={`剩余生命 ${snapshot.lives}`}
        >
          {[0, 1, 2].map((i) => (
            <XMark key={i} lost={i >= snapshot.lives} />
          ))}
        </div>
        <IconBtn label={paused ? '继续' : '暂停'} onClick={onTogglePause}>
          {paused ? <PlayIcon /> : <PauseIcon />}
        </IconBtn>
        <IconBtn label={muted ? '取消静音' : '静音'} onClick={onToggleMute}>
          <SpeakerIcon muted={muted} />
        </IconBtn>
      </div>
    </div>
  );
}
