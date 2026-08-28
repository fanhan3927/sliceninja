# 技术设计（纯前端）

## 技术栈

- React 18 + TypeScript + Vite
- Tailwind CSS
- Framer Motion（大厅、弹窗、Level Up / Combo 字幕；**不要**用它驱动游戏循环）
- 游戏渲染：HTML Canvas 2D + `requestAnimationFrame`
- 音频：自研 `AudioManager`（Web Audio API + 文件 fetch；失败则 OscillatorNode）
- 路由：单页即可（大厅 / 游戏用 React 状态机切换）；若需要深链接可加 React Router，非必须
- 持久化：`localStorage`

## 项目结构

```
src/
  components/
    Hall.tsx
    SettingsPanel.tsx
    GameView.tsx
    GameCanvas.tsx
    Hud.tsx
    LoaderOverlay.tsx
    GameOverModal.tsx
  game/
    engine.ts
    world.ts
    blade.ts
    physics.ts
    spawner.ts
    difficulty.ts
    scoring.ts
    particles.ts
    renderer.ts
    input.ts
    audio.ts
    assets.ts
    constants.ts
    types.ts
  hooks/
    useGameSession.ts
    useLocalStats.ts
  data/
    fruitKinds.ts
  types/
    index.ts
  App.tsx
  main.tsx
  index.css
public/
  audio/
  images/fruits/
scripts/
  generate-placeholder-assets.mjs
```

## 数据管理

- 游戏实体与每帧状态：`src/game` 内存对象，**禁止**每帧 `setState`。
- React 只存：`phase: 'hall' | 'loading' | 'playing' | 'paused' | 'over'`、节流后的 HUD snapshot（10Hz）、设置与本机战绩。
- 最高分 / 静音 / 最近 10 局：`localStorage`，封装在 `useLocalStats`。
- 难度：`DEFAULT_DIFFICULTY` 常量 + `getDifficulty(level)` 纯函数。无服务端覆盖。

`DifficultyConfig` 与运行时参数：

```ts
export type DifficultyConfig = {
  spawnIntervalMs: { base: number; perLevel: number; min: number };
  fruitsPerWave: { startDoubleLevel: number; startTripleLevel: number; doubleChance: number; tripleChance: number };
  throwSpeed: { base: number; perLevel: number; max: number };
  gravity: { base: number; perLevel: number; max: number };
  bombChance: { startLevel: number; base: number; perLevel: number; max: number };
  fruitRadius: { base: number; perLevel: number; min: number };
  comboWindowMs: { base: number; perLevel: number; min: number };
  fruitsToLevelUp: { base: number; perLevel: number };
  lives: number;
  bombEndsGame: boolean;
  scorePerFruit: number;
  comboBonus: number;
};
```

数字必须与 PRD 表一致。

## 游戏循环要点

- 逻辑分辨率 1280×720，canvas CSS 等比缩放，`input.ts` 做坐标映射。
- 每帧：input → blade → spawn → physics → slice test → particles → render。
- 切割：最近 6–10 个指针点折线 vs 圆；80ms 内位移 > 18px 才算挥砍。
- 出生：y 在画布下方，vx 朝中轴，vy 由 throwSpeed 映射。
- 粒子上限 120；dt clamp 33ms。
- 事件向外抛：`slice | miss | bomb | combo | levelup | over`，UI 与音频订阅。

## 音频清单

```ts
const AUDIO_MANIFEST = [
  { key: 'bgm', src: '/audio/bgm.mp3', loop: true, volume: 0.35 },
  { key: 'slice-1', src: '/audio/slice-1.mp3', volume: 0.7 },
  { key: 'slice-2', src: '/audio/slice-2.mp3', volume: 0.7 },
  { key: 'slice-3', src: '/audio/slice-3.mp3', volume: 0.7 },
  { key: 'bomb', src: '/audio/bomb.mp3', volume: 0.9 },
  { key: 'miss', src: '/audio/miss.mp3', volume: 0.6 },
  { key: 'combo', src: '/audio/combo.mp3', volume: 0.75 },
  { key: 'level-up', src: '/audio/level-up.mp3', volume: 0.7 },
  { key: 'game-over', src: '/audio/game-over.mp3', volume: 0.8 },
];
```

双通道：文件优先，404 则合成（切片 ~880Hz 短脉冲，炸弹低频噪声，BGM 简单和弦循环）。首次 pointerdown `unlock()`。

## 占位资源

`scripts/generate-placeholder-assets.mjs` 用 Canvas / 纯 PNG 字节写出彩色圆形水果与炸弹；音频尽量 ffmpeg 生成短 mp3。脚本失败不影响运行时合成音路径。

## 性能

- 游戏循环与 React 解耦。
- fps 连续 2s < 45 则减少粒子。
- 图片一次性预载，不在热路径 decode。
