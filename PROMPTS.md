# 分步提示词（直接复制给 Coding Agent）

按顺序执行。始终遵守同目录 `PRD.md`、`TECH_DESIGN.md`、`AGENTS.md`。

---

## 1. 初始化项目

根据三份文档，用 Vite 初始化 React + TypeScript 项目，安装 Tailwind CSS 与 Framer Motion。目录按 `TECH_DESIGN.md` 建空模块文件。

`index.html` / 根样式：背景 `#140c08`，引入 Noto Serif SC。写简短 `README.md`（启动命令、资源路径、localStorage 键名）。

**验收**：`npm run dev` 打开空白深色页。

---

## 2. 类型、难度纯函数、资源清单、音频管理

实现：

- `src/game/types.ts`
- `src/game/constants.ts` — DEFAULT_DIFFICULTY 数字与 PRD 完全一致
- `src/game/difficulty.ts` — `getDifficulty(level)`；模块加载时 `console.assert` Level 1 的 `spawnIntervalMs === 1400` 且 `bombChance === 0`；注释写出 Level 5 期望值
- `src/game/assets.ts` — IMAGE / AUDIO manifest，URL 与 PRD 一字不差
- `src/game/audio.ts` — `load(onProgress)`、`unlock()`、`play`、`playSlice` 三切片随机、BGM loop、静音、文件失败则振荡器合成
- `scripts/generate-placeholder-assets.mjs` — 彩色圆水果 PNG + 炸弹；能生成则生成 mp3

**验收**：断言通过；manifest 路径正确。

---

## 3. 游戏引擎（核心，一次写完可跑）

在 `src/game/` 实现 physics / blade / 实体工厂 / particles / spawner / scoring / renderer / input / engine。

规则：

- 逻辑分辨率 1280×720
- 折线切圆 + 速度阈值；切开分瓣
- 3 Miss 结束；炸弹默认立即结束
- dt clamp 33ms；pause 停物理与出果
- `createGame(canvas, { audio, onSnapshot, onEvent })`
- 不要接 React

**验收**：临时在页面挂 canvas 能挥砍计分。

---

## 4. 大厅与设置 UI

实现 `Hall`、`SettingsPanel`、`useLocalStats`：

- 大标题 SliceNinja、玩法三句、本机最高分、开始切割
- BGM / SFX 开关写入 localStorage
- Framer Motion 做按钮与面板过渡
- 移动端排版不挤

**验收**：刷新后最高分与静音状态仍在。

---

## 5. 游戏页：Loading、Canvas、HUD、结算

实现 `GameView` / `GameCanvas` / `LoaderOverlay` / `Hud` / `GameOverModal`。

流程：点开始 → 预载资源显示进度 → 「挥刀开始」→ 首次 pointer `unlock` + `engine.start` + BGM。

HUD：Score、Combo、Level、3 命、暂停、静音。  
事件播对应音效。  
结算写 `highScore` / `bestCombo` / `recentRuns`（最多 10）。  
canvas：`touch-action: none; cursor: crosshair;` 并 preventDefault。

**验收**：完整一局可玩，有刀光与声音，升级后节奏变快。

---

## 6. App 状态机联调

`App.tsx` 用 `phase` 在大厅 / 加载 / 游戏 / 结算间切换，暂停不卸载引擎。处理窗口 resize 时 canvas 映射。连续低 fps 降低粒子。加载失败提供「强制开始（占位音）」。

**验收清单（必须逐条点过）**：

1. `npm run dev` 冷启动
2. 运行占位资源脚本（若存在）
3. 切中有分瓣、粒子、切片音
4. 漏 3 个结束
5. 切炸弹结束
6. 打到 Level 3+，出果变密并开始出炸弹
7. 结算后大厅最高分更新，刷新仍在
8. 删除 public/audio 后仍有合成音且不崩
9. 窄屏可滑切、页面不滚动
10. 暂停后果实停空中，继续后恢复

---

## 7. 部署（可选）

配置 Vite `base`，说明可部署到 Vercel / Netlify / GitHub Pages。确认 `public/audio` 与 `public/images` 会被原样拷贝。不要把 localStorage 逻辑改成网络请求。
