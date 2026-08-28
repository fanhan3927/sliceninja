import { useCallback, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import Hall from './components/Hall';
import SettingsPanel from './components/SettingsPanel';
import GameView from './components/GameView';
import type { RunResultView } from './components/GameOverModal';
import { useAudioSettings, useLocalStats } from './hooks/useLocalStats';
import type { Phase } from './types';

/**
 * App 状态机：hall → loading → playing ⇄ paused → over。
 * 阶段切换不卸载游戏页组件（引擎保持挂载，暂停只冻结物理）。
 */
export default function App() {
  const [phase, setPhase] = useState<Phase>('hall');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { stats, applyRun } = useLocalStats();
  const { settings, update, toggleMasterMute } = useAudioSettings();
  const [runResult, setRunResult] = useState<RunResultView | null>(null);

  const handleStart = useCallback((): void => {
    setRunResult(null);
    setPhase('loading');
  }, []);

  /** 结算回写 localStorage（highScore / bestCombo / recentRuns）并进入 over 阶段 */
  const handleRunComplete = useCallback(
    ({ stats: finalStats, reason }: { stats: import('./game/types').GameFinalStats; reason: 'lives' | 'bomb' }): void => {
      const result = applyRun(finalStats);
      setRunResult({ stats: finalStats, isNewHighScore: result.isNewHighScore, reason });
      setPhase('over');
    },
    [applyRun],
  );

  return (
    <MotionConfig reducedMotion="user">
      {phase === 'hall' ? (
        <>
          <Hall
            highScore={stats.highScore}
            bestCombo={stats.bestCombo}
            recentRuns={stats.recentRuns}
            onStart={handleStart}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <SettingsPanel
            open={settingsOpen}
            settings={settings}
            onChange={update}
            onClose={() => setSettingsOpen(false)}
          />
        </>
      ) : (
        <GameView
          phase={phase}
          onPhaseChange={setPhase}
          settings={settings}
          onToggleMute={toggleMasterMute}
          onExit={() => setPhase('hall')}
          onRunComplete={handleRunComplete}
          runResult={runResult}
        />
      )}
    </MotionConfig>
  );
}
