import { AnimatePresence, motion } from 'framer-motion';
import type { AudioSettings } from '../types';

interface SettingsPanelProps {
  open: boolean;
  settings: AudioSettings;
  onChange: (patch: Partial<AudioSettings>) => void;
  onClose: () => void;
}

function ToggleRow({
  label,
  hint,
  checked,
  onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-2xl border border-dojo-line/70 bg-dojo/60 px-4 py-3 text-left transition-colors hover:border-gold/40"
    >
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] text-ink-dim">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-ember' : 'bg-dojo-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink shadow transition-all duration-200 ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

/** 设置面板：BGM / SFX 开关（写入 sliceninja.settings） */
export default function SettingsPanel({ open, settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label="设置"
            className="w-full max-w-sm rounded-3xl border border-dojo-line bg-dojo-soft p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-ink">设置</h2>
            <div className="mt-5 grid gap-3">
              <ToggleRow
                label="背景音乐"
                hint="道场循环 BGM"
                checked={!settings.bgmMuted}
                onToggle={() => onChange({ bgmMuted: !settings.bgmMuted })}
              />
              <ToggleRow
                label="游戏音效"
                hint="切割 / 炸弹 / 升级等"
                checked={!settings.sfxMuted}
                onToggle={() => onChange({ sfxMuted: !settings.sfxMuted })}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-gold to-ember py-3 font-bold text-[#24140a]"
            >
              完成
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
