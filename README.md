# SliceNinja（《水果忍者》Web 复刻）

纯前端浏览器游戏：滑动切割飞出的水果得分，避开炸弹；随 Level 加快出果、提高速度与炸弹率。无后端，最高分与静音偏好写入 `localStorage`。

## 启动

```bash
npm install
npm run gen:assets   # 生成 public/ 占位图与占位音（可选，缺失时运行时会用振荡器合成音）
npm run dev          # http://localhost:5173
```

其他命令：`npm run build`（类型检查 + 产物构建）、`npm run preview`（预览构建产物）、`npm run typecheck`。

## 验收 / QA 工具（可选）

```bash
npm run qa:unit      # 纯函数单测：切割几何、刀光速度阈值、难度表数值、升级前缀和、连击计分
npm run qa:browser   # 浏览器冒烟验收（需本机 Edge/Chrome 与 dev server，见 scripts/qa-smoke.mjs）
node scripts/qa-grind.mjs 90   # 90 秒自动挥砍探针：观察升级 / 炸弹 / 连击等随机路径
```

## 资源路径（PRD 硬性约定，运行时按此加载）

| 类型 | 路径 |
| --- | --- |
| 音频 | `/audio/bgm.mp3`、`/audio/slice-1.mp3`、`/audio/slice-2.mp3`、`/audio/slice-3.mp3`、`/audio/bomb.mp3`、`/audio/miss.mp3`、`/audio/combo.mp3`、`/audio/level-up.mp3`、`/audio/game-over.mp3` |
| 图像 | `/images/fruits/{watermelon,apple,orange,banana,kiwi,pineapple}.png`、`/images/bomb.png`、`/images/dojo-bg.jpg` |

- 占位资源：`npm run gen:assets` 由 `scripts/generate-placeholder-assets.mjs` 生成到 `public/`（优先尝试 ffmpeg 生成真 mp3；无 ffmpeg 时写入 WAV 字节占位，`decodeAudioData` 按内容识别，可正常播放）。
- 兜底：任何文件缺失/解码失败时，`src/game/audio.ts` 用 WebAudio 振荡器合成对应音效，不阻断开局。
- 正式素材：直接把同名文件放进 `public/audio/`、`public/images/` 即可，无需改代码。
- `dojo-bg.jpg` 占位实际为 PNG 字节（无 JPEG 编码器依赖），浏览器按内容解码；替换为真 JPG 后不变。

## localStorage 键名

| 键 | 内容 |
| --- | --- |
| `sliceninja.highScore` | 本机最高分 |
| `sliceninja.bestCombo` | 本机最高连击数 |
| `sliceninja.settings` | `{ bgmMuted, sfxMuted }` 音频偏好 |
| `sliceninja.recentRuns` | 最近 10 局战绩数组 |

## 结构速览

- `src/game/*`：纯 TS 游戏模块（引擎、物理、刀光、难度、粒子、渲染、输入、音频），不依赖 React。
- `src/components/*`：大厅 / HUD / 弹窗等 Tailwind UI；Framer Motion 只做 UI 过渡。
- `src/hooks/*`：`useLocalStats`（localStorage 战绩与设置）、`useGameSession`（加载/对局流程）。
- 逻辑分辨率 1280×720，Canvas 2D 等比缩放；`touch-action: none` 支持移动端滑切。

## 部署

**已部署到 GitHub Pages：https://fanhan3927.github.io/sliceninja/**（push 到 main 后由 `.github/workflows/deploy.yml` 自动构建部署；也可在 Actions 页手动触发 workflow_dispatch）。

手动部署到其他平台：

```bash
npm run build   # 产物在 dist/（含 public/audio、public/images 原样拷贝及 .nojekyll）
```

- `vite.config.ts` 已设 `base: './'`，产物可部署到任意静态子路径。
- 多媒体清单路径基于 `import.meta.env.BASE_URL` 拼接（见 `src/game/assets.ts`）：根路径部署下即 PRD 字面路径 `/audio/*`、`/images/*`；子路径（GitHub Pages）下自动解析为 `./audio/*` 落在仓库子目录。
- 推荐部署在域名根路径（Vercel / Netlify 默认）以严格匹配 PRD 路径约定。
- localStorage 逻辑保持纯本地，不涉及任何网络请求。
