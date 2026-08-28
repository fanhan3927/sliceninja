# SliceNinja 纯前端开发指令

## 项目概述

使用 React + TypeScript + Vite + Tailwind 开发的浏览器《水果忍者》复刻。无后端。验收重点：**Canvas 循环、切割判定、Level 难度表、约定路径多媒体加载**。

先读 `PRD.md`、`TECH_DESIGN.md`、本文件。

## 开发规范

- 函数式组件 + Hooks；游戏逻辑放 `src/game/*` 纯模块。
- 不要把水果列表放进 `useState` 每帧更新。
- Tailwind 只用于大厅 / HUD / 弹窗；水果必须画在 canvas 上，禁止 DOM 水果节点冒充游戏。
- TypeScript 严格，禁止 `any`。
- 难度数字只来自 `constants.ts` + `getDifficulty`，禁止在 spawner 里写死 `1400`。
- 切割几何、难度公式、AudioContext 解锁三处必须有注释。

## 设计要求

- 深色主题：背景 `#140c08`，文字 `#fff7e8`，强调金橙渐变。
- 大厅先于游戏：大标题、最高分、主按钮。
- Loading 显示「图片 x/y · 音频 x/y」，禁止白屏直接进局。
- Game Over：分数、Level、连击、切开/漏切、再来一局 / 回大厅。
- 移动端可滑切，页面不滚动。
- Framer Motion 仅用于 UI 过渡，不驱动物理。

## 多媒体硬性约定

必须按 PRD 路径请求资源。同时实现：

1. `scripts/generate-placeholder-assets.mjs` 生成 public 占位图（及尽可能的占位音）。
2. `AudioManager` 在 fetch/decode 失败时用振荡器发声。

两条都要有，保证评审环境能出声、路径也正确。

## 注意事项

- 不要引入 Phaser / Pixi / 物理引擎，首版 Canvas 2D 足够。
- 不要引用官方 IP 素材。
- 保持实现完整但克制：无账号、无网络排行榜、无 ECS。
- `npm run dev` 必须能完整打一局。
- 结算时写 localStorage，游戏过程中不要频繁写盘。

## 完成定义

- [ ] 大厅 → Loading → 挥刀开始 → 完整一局
- [ ] 切割、漏切、炸弹、Combo、Level Up 行为正确且有音
- [ ] Level 升高后出果变密变快
- [ ] 最高分刷新并在大厅展示
- [ ] 无音频文件时合成音仍工作
- [ ] README 含启动步骤与资源路径
