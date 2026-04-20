/**
 * Symbol sprites — loaded from PNG assets in public/assets/.
 * 9×9 palette-quantised pixel art.
 * Sprites are re-quantized automatically when the palette theme changes.
 */

import { PAL, PAL32, onThemeChange } from './PaletteDB.js';
import { quantize } from './PaletteQuantizer.js';

const SIZE = 9;

const BASE = import.meta.env.BASE_URL ?? '/';

const SPRITE_MANIFEST = {
  sym_cherry:  { path: 'symbols/cherry.png' },
  sym_blue:    { path: 'symbols/blue.png' },
  sym_red:     { path: 'symbols/red.png' },
  sym_void:    { path: 'symbols/void.png' },
  ui_reroll:   { path: 'ui/reroll.png' },
  ui_anvil:    { path: 'ui/anvil.png' },
  ui_arrow:    { path: 'ui/arrow_right.png' },
  ui_ball:     { path: 'ui/ball.png' },
  ui_skull:    { path: 'ui/skull.png' },
  menu_gear:   { path: 'menu/gear.png' },
  menu_book:   { path: 'menu/book.png' },
  menu_exit:   { path: 'menu/exit.png' },
  menu_retry:  { path: 'menu/retry.png' },
  relic_common:    { path: 'relics/relic_common.png' },
  relic_uncommon:  { path: 'relics/relic_uncommon.png' },
  relic_rare:      { path: 'relics/relic_rare.png' },
  relic_legendary: { path: 'relics/relic_legendary.png' },
};

const ANIM_MANIFEST = {
  coin_0: { path: 'currencies/coin_0.png', count: 4 },
  coin_1: { path: 'currencies/coin_1.png', count: 4 },
  coin_2: { path: 'currencies/coin_2.png', count: 4 },
  coin_3: { path: 'currencies/coin_3.png', count: 4 },
  ticket: { path: 'currencies/ticket.png', count: 4 },
};

const _cache = new Map();
const _animCache = new Map();
const _animFrameCounts = new Map();
const _rawImages = new Map();   // id → raw Image (for re-quantizing on theme change)

function _quantize(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  quantize(ctx, c.width, c.height);
  return c;
}

function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function preloadSprites() {
  const promises = [];
  const base = BASE + 'assets/';

  for (const [id, info] of Object.entries(SPRITE_MANIFEST)) {
    promises.push(
      _loadImage(base + info.path).then(img => {
        _rawImages.set(id, img);
        _cache.set(id, _quantize(img));
      })
    );
  }

  for (const [id, info] of Object.entries(ANIM_MANIFEST)) {
    promises.push(
      _loadImage(base + info.path).then(img => {
        _rawImages.set(id, img);
        _animFrameCounts.set(id, info.count);
        const sheet = _quantize(img);
        for (let f = 0; f < info.count; f++) {
          const fc = document.createElement('canvas');
          fc.width = SIZE; fc.height = SIZE;
          fc.getContext('2d').drawImage(sheet, f * SIZE, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
          _animCache.set(`${id}_${f}`, fc);
        }
      })
    );
  }

  await Promise.all(promises);
}

/** Re-run palette quantization on all cached sprites. Called on theme change. */
export function requantizeSprites() {
  for (const [id, raw] of _rawImages) {
    if (_cache.has(id)) {
      _cache.set(id, _quantize(raw));
    }
    const count = _animFrameCounts.get(id);
    if (count) {
      const sheet = _quantize(raw);
      for (let f = 0; f < count; f++) {
        const fc = document.createElement('canvas');
        fc.width = SIZE; fc.height = SIZE;
        fc.getContext('2d').drawImage(sheet, f * SIZE, 0, SIZE, SIZE, 0, 0, SIZE, SIZE);
        _animCache.set(`${id}_${f}`, fc);
      }
    }
  }
}

onThemeChange(() => requantizeSprites());

// ── Draw helpers ───────────────────────────────────────────────

export function drawSprite(ctx, symbolId, dx, dy, scale = 1) {
  const src = _cache.get(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, dx, dy, src.width * scale, src.height * scale);
}

export function drawSpriteCentered(ctx, symbolId, cx, cy, scale = 1) {
  const src = _cache.get(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const hw = (src.width * scale) / 2;
  const hh = (src.height * scale) / 2;
  ctx.drawImage(src, Math.floor(cx - hw), Math.floor(cy - hh), src.width * scale, src.height * scale);
}

// Animated sprite: cycles frames at `fps`
export function drawAnimSpriteCentered(ctx, id, cx, cy, scale = 1, time = 0, fps = 6) {
  const count = _animFrameCounts.get(id);
  if (!count) return;
  const frame = Math.floor(time * fps) % count;
  const src = _animCache.get(id + '_' + frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, Math.floor(cx - half), Math.floor(cy - half), SIZE * scale, SIZE * scale);
}

export function drawAnimFrameCentered(ctx, id, frame, cx, cy, scale = 1) {
  const src = _animCache.get(id + '_' + frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, Math.floor(cx - half), Math.floor(cy - half), SIZE * scale, SIZE * scale);
}

export function getAnimFrameCount(id) {
  return _animFrameCounts.get(id) || 0;
}

export function getSpriteIds() { return Object.keys(SPRITE_MANIFEST); }
export function getAnimSpriteIds() { return Object.keys(ANIM_MANIFEST); }

export const SPRITE_SIZE = SIZE;
export const TICKET_W = 15;
export const TICKET_H = 9;
