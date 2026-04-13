/**
 * Palette quantizer — snap every pixel to the nearest palette color.
 * Kills anti-aliasing fringes from arc() and diagonal lines.
 * Uses a cache so repeated colors (99%+ of pixels) are instant.
 */

import { PAL } from './PaletteDB.js';

// Pre-compute palette as RGB arrays
const COLORS = [];
for (const hex of Object.values(PAL)) {
  COLORS.push([
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]);
}

// Cache: packed RGB24 → palette index
const _cache = new Map();

/**
 * Quantize all pixels on ctx to the nearest PAL color.
 * Call after all drawing, before CRT post-process.
 */
export function quantize(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  for (let i = 0; i < n; i++) {
    const oi = i << 2;
    const r = d[oi], g = d[oi + 1], b = d[oi + 2];
    const key = (r << 16) | (g << 8) | b;

    let best = _cache.get(key);
    if (best === undefined) {
      let minDist = Infinity;
      let bestIdx = 0;
      for (let c = 0; c < COLORS.length; c++) {
        const dr = r - COLORS[c][0];
        const dg = g - COLORS[c][1];
        const db = b - COLORS[c][2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          bestIdx = c;
        }
      }
      best = bestIdx;
      _cache.set(key, best);
    }

    d[oi]     = COLORS[best][0];
    d[oi + 1] = COLORS[best][1];
    d[oi + 2] = COLORS[best][2];
  }

  ctx.putImageData(img, 0, 0);
}
