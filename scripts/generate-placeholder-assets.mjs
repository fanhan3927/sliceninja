/**
 * generate-placeholder-assets.mjs
 *
 * 零依赖生成 public/ 占位资源：
 *  - 图像：彩色圆形水果 PNG（西瓜/苹果/橙子/香蕉/猕猴桃/菠萝）、炸弹、道场背景。
 *    （dojo-bg.jpg 为 PNG 字节——浏览器按内容解码；替换正式素材时直接放真 JPG。）
 *  - 音频：先用 PCM 合成 WAV；若系统 PATH 上有 ffmpeg 则转成真 mp3，
 *    否则将 WAV 字节直接写入 .mp3 路径（decodeAudioData 按文件头识别，可正常播放）。
 *
 * 脚本失败不影响游戏：运行时会用 WebAudio 振荡器合成音效（见 src/game/audio.ts）。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const FRUIT_DIR = join(IMG_DIR, 'fruits');
const AUDIO_DIR = join(ROOT, 'public', 'audio');

// ---------------------------------------------------------------------------
// PNG 编码（RGBA8）
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
  }

  set(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = Math.max(0, Math.min(255, Math.round(r)));
    this.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    this.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    this.data[i + 3] = Math.max(0, Math.min(255, Math.round(a)));
  }

  /** 用逐像素函数绘制：fn(u, v) → [r, g, b, a]（u/v ∈ [-1, 1]，y 向下） */
  paint(fn) {
    for (let py = 0; py < this.height; py += 1) {
      const v = (py / (this.height - 1)) * 2 - 1;
      for (let px = 0; px < this.width; px += 1) {
        const u = (px / (this.width - 1)) * 2 - 1;
        const [r, g, b, a] = fn(u, v);
        this.set(px, py, r, g, b, a === undefined ? 255 : a);
      }
    }
  }

  save(path) {
    writeFileSync(path, encodePng(this.width, this.height, this.data));
    console.log(`  ✓ ${path}`);
  }
}

// ---------------------------------------------------------------------------
// 颜色 / 图形小工具
// ---------------------------------------------------------------------------

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 带高光与暗边的球体着色；base 为 [r,g,b] */
function shadeSphere(u, v, base, dark) {
  const d = Math.hypot(u, v);
  if (d > 1) return [0, 0, 0, 0];
  const edge = clamp01((d - 0.72) / 0.28);
  const hi = clamp01(1 - Math.hypot(u + 0.34, v + 0.38) / 0.72) ** 2;
  let c = mixRgb(base, dark, edge * 0.65);
  c = mixRgb(c, [255, 250, 235], hi * 0.42);
  const alpha = d > 0.985 ? (1 - d) / 0.015 * 255 : 255;
  return [c[0], c[1], c[2], alpha];
}

function ellipseInside(u, v, cx, cy, a, b, rot = 0) {
  const dx = u - cx;
  const dy = v - cy;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;
  return (rx / a) ** 2 + (ry / b) ** 2 <= 1;
}

// ---------------------------------------------------------------------------
// 各水果绘制（256×256，风格：扁平卡通圆 + 细节）
// ---------------------------------------------------------------------------

const SIZE = 256;

function drawFruit(kind) {
  const img = new Raster(SIZE, SIZE);
  img.paint((u, v) => {
    const d = Math.hypot(u, v);
    const ang = Math.atan2(v, u);
    switch (kind) {
      case 'watermelon': {
        if (d > 1) return [0, 0, 0, 0];
        const stripe = Math.sin(ang * 7) > 0.15;
        const base = stripe ? hexToRgb('#1b7a3d') : hexToRgb('#3fae55');
        return shadeSphere(u, v, base, hexToRgb('#14532d'));
      }
      case 'apple': {
        if (ellipseInside(u, v, 0.16, -0.88, 0.34, 0.16, -0.5)) return hexToRgb('#4caf50').concat(255);
        if (Math.abs(u - 0.02) < 0.045 && v < -0.72 && v > -1.0) return hexToRgb('#6d4c41').concat(255);
        return shadeSphere(u, v, hexToRgb('#e5383b'), hexToRgb('#8f1d1f'));
      }
      case 'orange': {
        if (d > 1) return [0, 0, 0, 0];
        const dimple = hash2(Math.round(u * 40), Math.round(v * 40)) < 0.06 ? -18 : 0;
        const c = shadeSphere(u, v, hexToRgb('#fb8c00').map((x) => x + dimple), hexToRgb('#b35a00'));
        if (Math.abs(u) < 0.06 && Math.abs(v + 0.92) < 0.09) return hexToRgb('#2e7d32').concat(255);
        return c;
      }
      case 'banana': {
        // 弯月形：环带 + 角度窗口（下弯的“微笑”）
        const inBand = d > 0.42 && d < 0.98;
        const inArc = ang > 0.18 && ang < Math.PI - 0.18;
        if (inBand && inArc) {
          const tipness = Math.min(Math.abs(ang - 0.18), Math.abs(ang - (Math.PI - 0.18)));
          const tip = tipness < 0.22;
          const base = tip ? hexToRgb('#8a6d1d') : hexToRgb('#f4d35e');
          const shade = d < 0.6 ? 0.82 : 1;
          return [base[0] * shade, base[1] * shade, base[2] * shade, 255];
        }
        return [0, 0, 0, 0];
      }
      case 'kiwi': {
        if (d > 1) return [0, 0, 0, 0];
        const fuzz = (hash2(Math.round(u * 90), Math.round(v * 90)) - 0.5) * 26;
        const base = hexToRgb('#8d6e63').map((x) => x + fuzz);
        return shadeSphere(u, v, base, hexToRgb('#4e342e'));
      }
      case 'pineapple': {
        if (ellipseInside(u, v, 0, -0.98, 0.5, 0.4)) {
          const leaf = (Math.abs(u) * 2 + Math.abs(v + 0.98)) < 0.9;
          return leaf ? hexToRgb('#43a047').concat(255) : [0, 0, 0, 0];
        }
        if (d > 0.92) return [0, 0, 0, 0];
        const cross = (Math.floor((u + v) * 7) + Math.floor((u - v) * 7)) % 2 === 0;
        const base = cross ? hexToRgb('#f9a825') : hexToRgb('#e08e0b');
        return shadeSphere(u, v, base, hexToRgb('#8a5a00'));
      }
      default:
        return [0, 0, 0, 0];
    }
  });
  return img;
}

function drawBomb() {
  const img = new Raster(SIZE, SIZE);
  img.paint((u, v) => {
    const d = Math.hypot(u, v);
    if (d > 1) {
      // 引信与火花
      if (Math.abs(u) < 0.05 && v < -0.82 && v > -1.18) return hexToRgb('#8d6e63').concat(255);
      const sd = Math.hypot(u - 0.1, v + 1.24);
      if (sd < 0.16) {
        const t = clamp01(1 - sd / 0.16);
        return mixRgb(hexToRgb('#ff3b3b'), hexToRgb('#ffd54f'), t).concat(255);
      }
      return [0, 0, 0, 0];
    }
    // 弹体 + 红色警示描边
    let c = shadeSphere(u, v, hexToRgb('#262b33'), hexToRgb('#0c0e12'));
    if (d > 0.9) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 240);
      c = mixRgb(c, hexToRgb('#ff3b3b'), 0.5 * pulse);
    }
    return c;
  });
  return img;
}

function drawDojoBg() {
  const W = 1280;
  const H = 720;
  const img = new Raster(W, H);
  const plank = 96;
  const seam = (row) => (row * 53) % 320;
  img.paint((u, v) => {
    const x = ((u + 1) / 2) * (W - 1);
    const y = ((v + 1) / 2) * (H - 1);
    const row = Math.floor(y / plank);
    const hueShift = (hash2(row, 7) - 0.5) * 14;
    let c = mixRgb(hexToRgb('#1c110b'), hexToRgb('#2e1c12'), hash2(row, 3) * 0.8);
    c = c.map((ch) => ch + hueShift);
    if (y % plank < 3) c = mixRgb(c, [0, 0, 0], 0.5); // 横向板缝
    if ((x + seam(row)) % 320 < 4) c = mixRgb(c, [0, 0, 0], 0.4); // 竖向错缝
    const dc = Math.hypot(u, v * 0.72);
    c = c.map((ch) => ch * (1 - 0.5 * dc * dc)); // 暗角
    const glow = clamp01(1 - Math.hypot(u, v + 0.9) / 0.9) ** 2 * 0.18; // 顶部暖光
    return [c[0] + 232 * glow, c[1] + 195 * glow * 0.7, c[2] + 106 * glow * 0.4, 255];
  });
  return img;
}

// ---------------------------------------------------------------------------
// 音频合成（WAV PCM16 单声道）
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 22050;

function encodeWav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function silence(durSec) {
  return new Float32Array(Math.ceil(durSec * SAMPLE_RATE));
}

function addTone(buf, { freq, endFreq, start = 0, dur, gain = 0.6, type = 'sine' }) {
  const startIdx = Math.floor(start * SAMPLE_RATE);
  const n = Math.min(buf.length - startIdx, Math.floor(dur * SAMPLE_RATE));
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const f = endFreq !== undefined ? lerp(freq, endFreq, t / dur) : freq;
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    const s = type === 'triangle' ? Math.asin(Math.sin(phase)) * (2 / Math.PI) : Math.sin(phase);
    const attack = Math.min(1, t / 0.008);
    const release = Math.exp(-t / (dur * 0.42));
    buf[startIdx + i] += s * gain * attack * release;
  }
}

function addNoise(buf, { start = 0, dur, gain = 0.5, lowpassHz = 4000 }) {
  const startIdx = Math.floor(start * SAMPLE_RATE);
  const n = Math.min(buf.length - startIdx, Math.floor(dur * SAMPLE_RATE));
  const a = 1 / (1 + 1 / (2 * Math.PI * (lowpassHz / SAMPLE_RATE)));
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    const t = i / SAMPLE_RATE;
    const x = Math.random() * 2 - 1;
    y += a * (x - y);
    const release = Math.exp(-t / (dur * 0.4));
    buf[startIdx + i] += y * gain * release;
  }
}

function synthSfx(name) {
  switch (name) {
    case 'slice-1':
    case 'slice-2':
    case 'slice-3': {
      const base = name === 'slice-1' ? 1180 : name === 'slice-2' ? 880 : 1480;
      const buf = silence(0.16);
      addTone(buf, { freq: base, endFreq: base * 0.28, dur: 0.09, gain: 0.55, type: 'triangle' });
      addNoise(buf, { dur: 0.06, gain: 0.18, lowpassHz: 6000 });
      return buf;
    }
    case 'bomb': {
      const buf = silence(0.7);
      addNoise(buf, { dur: 0.55, gain: 0.9, lowpassHz: 800 });
      addTone(buf, { freq: 70, endFreq: 36, dur: 0.55, gain: 0.9 });
      return buf;
    }
    case 'miss': {
      const buf = silence(0.35);
      addTone(buf, { freq: 440, endFreq: 150, dur: 0.3, gain: 0.55 });
      return buf;
    }
    case 'combo': {
      const buf = silence(0.45);
      addTone(buf, { freq: 523.25, start: 0, dur: 0.12, gain: 0.5, type: 'triangle' });
      addTone(buf, { freq: 659.26, start: 0.09, dur: 0.12, gain: 0.5, type: 'triangle' });
      addTone(buf, { freq: 783.99, start: 0.18, dur: 0.18, gain: 0.55, type: 'triangle' });
      return buf;
    }
    case 'level-up': {
      const buf = silence(0.55);
      [
        [523.25, 0],
        [659.26, 0.08],
        [783.99, 0.16],
        [1046.5, 0.24],
      ].forEach(([f, s], i) => addTone(buf, { freq: f, start: s, dur: i === 3 ? 0.24 : 0.1, gain: 0.5, type: 'triangle' }));
      return buf;
    }
    case 'game-over': {
      const buf = silence(1.1);
      addTone(buf, { freq: 392, start: 0, dur: 0.3, gain: 0.5 });
      addTone(buf, { freq: 311.13, start: 0.25, dur: 0.3, gain: 0.5 });
      addTone(buf, { freq: 233.08, start: 0.5, dur: 0.55, gain: 0.55, endFreq: 110 });
      return buf;
    }
    case 'bgm': {
      // 四小节和弦垫循环（Am F C G），与运行时合成通道同一进行
      const bar = 1.7;
      const chords = [
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66],
      ];
      const buf = silence(bar * chords.length);
      chords.forEach((chord, ci) => {
        for (const f of chord) {
          addTone(buf, {
            freq: f,
            start: ci * bar,
            dur: bar,
            gain: 0.11,
            type: 'triangle',
          });
        }
        addTone(buf, { freq: chord[0] / 2, start: ci * bar, dur: bar, gain: 0.08 });
      });
      return buf;
    }
    default:
      return silence(0.2);
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function hasFfmpeg() {
  const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: process.platform === 'win32' });
  return res.status === 0;
}

function writeAudio(ffmpegAvailable) {
  mkdirSync(AUDIO_DIR, { recursive: true });
  const names = ['bgm', 'slice-1', 'slice-2', 'slice-3', 'bomb', 'miss', 'combo', 'level-up', 'game-over'];
  let mp3Count = 0;
  for (const name of names) {
    const wav = encodeWav(synthSfx(name));
    const target = join(AUDIO_DIR, `${name}.mp3`);
    let wroteMp3 = false;
    if (ffmpegAvailable) {
      const tmp = join(AUDIO_DIR, `${name}.wav.tmp`);
      writeFileSync(tmp, wav);
      const res = spawnSync(
        'ffmpeg',
        ['-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '96k', target],
        { stdio: 'ignore', shell: process.platform === 'win32' },
      );
      if (res.status === 0) wroteMp3 = true;
    }
    if (!wroteMp3) writeFileSync(target, wav); // WAV 字节写入 .mp3 路径，decodeAudioData 按头识别
    if (existsSync(tmp)) rmSync(tmp); // 清理临时 WAV，避免泄漏进 public/audio
    else mp3Count += 1;
    console.log(`  ✓ ${target}${wroteMp3 ? ' (ffmpeg mp3)' : ' (wav 字节占位)'}`);
  }
  return { total: names.length, mp3Count };
}

function main() {
  console.log('生成占位图像…');
  mkdirSync(FRUIT_DIR, { recursive: true });
  for (const kind of ['watermelon', 'apple', 'orange', 'banana', 'kiwi', 'pineapple']) {
    drawFruit(kind).save(join(FRUIT_DIR, `${kind}.png`));
  }
  drawBomb().save(join(IMG_DIR, 'bomb.png'));
  drawDojoBg().save(join(IMG_DIR, 'dojo-bg.jpg'));

  console.log('生成占位音频…');
  const ffmpegAvailable = hasFfmpeg();
  const { total, mp3Count } = writeAudio(ffmpegAvailable);
  console.log(`完成：8 张图 + ${total} 个音频（真 mp3 ${mp3Count} 个${ffmpegAvailable ? '' : '，未检测到 ffmpeg'}）。`);
}

main();
