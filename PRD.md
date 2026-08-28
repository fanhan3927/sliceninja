# SliceNinja（《水果忍者》Web 复刻）纯前端 PRD

## 产品概述

SliceNinja 是浏览器内可即时游玩的经典《水果忍者》复刻：滑动切割飞出的水果得分，避开炸弹；随 Level 加快出果、提高速度并提高炸弹率。本包为**纯前端**：无登录、无服务端，最高分与静音偏好写入 `localStorage`。目标是验证画面质量、切割手感、动态难度公式、以及约定路径的多媒体加载。

## 核心功能

1. **大厅**
   - 全屏深色道场风落地页：标题 SliceNinja、一句玩法、本机最高分、主按钮「开始切割」。
   - 次级入口：玩法说明（三步：划切水果、避开炸弹、漏切三次结束）、设置（BGM / SFX 静音）。

2. **画面与基础玩法**
   - 逻辑画布 1280×720，居中缩放；木纹/夜色道场背景。
   - HUD：分数、连击、生命（3 叉）、Level、本局最高连击、静音、暂停。
   - 水果种类：西瓜、苹果、橙子、香蕉、猕猴桃、菠萝；另有炸弹。
   - 底部抛物线抛出，受重力下落。
   - 按下拖动产生金色刀光轨迹；折线与水果碰撞圆相交且滑动足够快即切开。
   - 切开：两瓣飞开 + 果汁粒子 + 切割音效（3 个变体随机）。
   - 漏切落地 = 1 Miss；3 Miss = Game Over。切中炸弹默认立即结束。
   - 短窗口连续切开 ≥3 触发 Combo 加分与中央大字。

3. **动态难度（必须集中配置、可验证）**
   - Level 主轴。升级：累计切开 `8 + Level * 2` 个水果（用前缀和阈值实现，避免循环定义）。
   - 默认数值（只允许来自 `src/game/constants.ts`）：
     - `spawnIntervalMs`：1400，每级 -80，下限 420
     - `fruitsPerWave`：L3+ 概率双抛，L6+ 概率三抛
     - `throwSpeed`：7.2，每级 +0.35，上限 14
     - `gravity`：0.18，每级 +0.012，上限 0.38
     - `bombChance`：L1 = 0，L2 = 0.08，之后每级 +0.035，上限 0.32
     - `fruitRadius`：42，每级 -1.2，下限 28
     - `comboWindowMs`：900，每级 -30，下限 480
   - 升级瞬间 Level Up 字样 + 音效；出果节奏肉眼变快。

4. **音频与图像多媒体**
   - 路径必须按下列清单加载；文件可为占位，加载失败用 WebAudio 振荡器合成，不得阻断开局。
   - 音频：
     - `/audio/bgm.mp3`
     - `/audio/slice-1.mp3` `/audio/slice-2.mp3` `/audio/slice-3.mp3`
     - `/audio/bomb.mp3` `/audio/miss.mp3` `/audio/combo.mp3`
     - `/audio/level-up.mp3` `/audio/game-over.mp3`
   - 图像：
     - `/images/fruits/{watermelon,apple,orange,banana,kiwi,pineapple}.png`
     - `/images/bomb.png`
     - `/images/dojo-bg.jpg`
   - 进局前 Loading：图片 x/y · 音频 x/y；首次指针手势解锁 AudioContext 后再播 BGM（处理自动播放策略）。

5. **本机战绩**
   - `localStorage` 键：`sliceninja.highScore`、`sliceninja.bestCombo`、`sliceninja.settings`、`sliceninja.recentRuns`（最多 10 局）。
   - Game Over 展示本局分数 / Level / 连击 / 切开与漏切，并更新最高分。
   - 再来一局、返回大厅。

## 设计要求

- 简洁现代的忍者道场：背景 `#140c08`，文字 `#fff7e8`，强调金 `#e8c36a` → `#ff6b3d` 渐变，炸弹红 `#ff3b3b`。
- 深色主题；刀光锐利；切开 20–40ms hit-stop。
- HUD 半透明不挡刀路；按钮大、少字。
- 移动端触控可玩：`touch-action: none`，禁止页面滚动与双击缩放。
- 标题可用衬线（Noto Serif SC）；HUD 数字等宽。
- 不使用官方《水果忍者》商标与原版素材。

## 验收标准

| 验证点 | 通过标准 |
| --- | --- |
| 画面与玩法 | 抛物线出果、刀光切中、分瓣+粒子、切片音 |
| 动态难度 | Level 变化可见；间隔/速度/炸弹率按表变化 |
| 多媒体 | 按路径加载；Loading 有进度；无文件时合成音仍响 |
| 纯前端完整度 | 大厅→加载→对局→结算→最高分回写 localStorage |
