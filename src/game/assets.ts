/**
 * 多媒体清单（PRD「音频与图像多媒体」，URL 与 PRD 一字不差）。
 * 路径基于 import.meta.env.BASE_URL 前缀拼接：
 *  - 默认 base '/'（dev / 根路径部署）：即 PRD 字面路径 /audio/*.mp3、/images/*；
 *  - base './'（GitHub Pages 等子路径部署）：解析为 ./audio/*，自动落在仓库子目录下。
 * 文件可为占位；加载失败由 AudioManager 用振荡器合成，不得阻断开局。
 */

export interface ImageAsset {
  key: string;
  src: string;
}

export interface AudioAsset {
  key: string;
  src: string;
  loop?: boolean;
  volume: number;
}

/** base 前缀（dev 为 '/'，构建时跟随 vite.config 的 base） */
const BASE: string = import.meta.env.BASE_URL;

/** 图像清单：6 种水果 + 炸弹 + 道场背景 */
export const IMAGE_MANIFEST: readonly ImageAsset[] = [
  { key: 'watermelon', src: `${BASE}images/fruits/watermelon.png` },
  { key: 'apple', src: `${BASE}images/fruits/apple.png` },
  { key: 'orange', src: `${BASE}images/fruits/orange.png` },
  { key: 'banana', src: `${BASE}images/fruits/banana.png` },
  { key: 'kiwi', src: `${BASE}images/fruits/kiwi.png` },
  { key: 'pineapple', src: `${BASE}images/fruits/pineapple.png` },
  { key: 'bomb', src: `${BASE}images/bomb.png` },
  { key: 'dojo-bg', src: `${BASE}images/dojo-bg.jpg` },
] as const;

/** 音频清单（TECH_DESIGN.md AUDIO_MANIFEST 原样） */
export const AUDIO_MANIFEST: readonly AudioAsset[] = [
  { key: 'bgm', src: `${BASE}audio/bgm.mp3`, loop: true, volume: 0.35 },
  { key: 'slice-1', src: `${BASE}audio/slice-1.mp3`, volume: 0.7 },
  { key: 'slice-2', src: `${BASE}audio/slice-2.mp3`, volume: 0.7 },
  { key: 'slice-3', src: `${BASE}audio/slice-3.mp3`, volume: 0.7 },
  { key: 'bomb', src: `${BASE}audio/bomb.mp3`, volume: 0.9 },
  { key: 'miss', src: `${BASE}audio/miss.mp3`, volume: 0.6 },
  { key: 'combo', src: `${BASE}audio/combo.mp3`, volume: 0.75 },
  { key: 'level-up', src: `${BASE}audio/level-up.mp3`, volume: 0.7 },
  { key: 'game-over', src: `${BASE}audio/game-over.mp3`, volume: 0.8 },
] as const;

// ---------- 图片预载（一次性预载，热路径不 decode；结果进程内缓存） ----------

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

/** 预载全部图片；单张失败不阻断（渲染器按 key 程序化兜底）。重复调用复用缓存。 */
export async function preloadImages(
  onProgress?: (loaded: number, total: number) => void,
): Promise<ReadonlyMap<string, HTMLImageElement>> {
  const total = IMAGE_MANIFEST.length;
  let loaded = 0;
  const report = (): void => {
    loaded += 1;
    onProgress?.(loaded, total);
  };
  const entries = await Promise.all(
    IMAGE_MANIFEST.map(async (asset): Promise<readonly [string, HTMLImageElement] | null> => {
      const cached = imageCache.get(asset.key);
      if (cached) {
        report();
        return [asset.key, cached];
      }
      try {
        const img = await loadImage(asset.src);
        imageCache.set(asset.key, img);
        report();
        return [asset.key, img];
      } catch {
        report();
        return null;
      }
    }),
  );
  const result = new Map<string, HTMLImageElement>();
  for (const entry of entries) {
    if (entry) result.set(entry[0], entry[1]);
  }
  return result;
}
