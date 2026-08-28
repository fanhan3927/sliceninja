import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' 使构建产物可部署到任意静态子路径（GitHub Pages 子目录等）。
// 注意：PRD 硬性约定多媒体为根绝对路径 /audio/* /images/*（见 src/game/assets.ts），
// 部署在域名根路径（Vercel / Netlify 默认）时二者都成立；若部署在子路径，
// 需要同步调整 assets.ts 的 manifest 前缀。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
});
